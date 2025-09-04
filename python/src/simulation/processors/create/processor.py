"""
Create step processor for Arena-style entity creation.

This processor handles the creation of entities with specified arrival patterns
and routes them to their initial processing steps.
"""

import logging
import random
from datetime import timedelta
from typing import Optional, Generator
from sqlalchemy import create_engine, insert, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from ..base import StepProcessor
from ....utils.column_resolver import ColumnResolver
from ..utils import extract_distribution_config, extract_distribution_config_with_time_unit
from ....distributions import generate_from_distribution
from ....utils.time_units import TimeUnitConverter

logger = logging.getLogger(__name__)


class CreateStepProcessor(StepProcessor):
    """
    Processor for Create step modules that generate entities dynamically.
    
    This processor implements Arena-style Create modules that:
    - Generate entities according to specified interarrival time distributions
    - Create entities in the specified database table
    - Route created entities to their initial processing step
    - Support entity limits and arrival patterns
    """
    
    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config, simulator=None):
        super().__init__(env, engine, resource_manager, entity_manager, event_tracker, config, simulator)
        # Callback for routing entities to initial steps (set by simulator)
        self.entity_router_callback = None
        
        # Initialize column resolver for strict column type resolution
        db_config = getattr(entity_manager, 'db_config', None)
        if not db_config:
            raise ValueError("db_config is required for CreateStepProcessor - cannot use hardcoded column names")
        self.column_resolver = ColumnResolver(db_config)
    
    def can_handle(self, step_type: str) -> bool:
        """Check if this processor can handle the given step type."""
        return step_type == "create"
    

    def validate_step(self, step: 'Step') -> bool:
        """Validate that the step configuration is correct for Create modules."""
        if not step.create_config:
            logger.error(f"Create step {step.step_id} missing create_config")
            return False
        
        config = step.create_config
        
        # Validate required fields
        if not config.entity_table:
            logger.error(f"Create step {step.step_id} missing entity_table")
            return False
            
        if not config.interarrival_time:
            logger.error(f"Create step {step.step_id} missing interarrival_time")
            return False
            
        # Validate that the step has next_steps for routing entities
        if not step.next_steps:
            logger.error(f"Create step {step.step_id} missing next_steps for entity routing")
            return False
            
        # Validate interarrival_time format (dict with 'distribution' OR 'formula', or direct formula string)
        if isinstance(config.interarrival_time, str):
            # Formula string format - valid
            pass
        elif isinstance(config.interarrival_time, dict):
            # Dict format - must have either 'distribution' or 'formula' key
            if 'distribution' not in config.interarrival_time and 'formula' not in config.interarrival_time:
                logger.error(f"Create step {step.step_id} interarrival_time dict must have 'distribution' or 'formula' key")
                return False
        else:
            logger.error(f"Create step {step.step_id} interarrival_time must be string (formula) or dict")
            return False
            
        return True
    
    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                entity_table: str, event_table: str, event_tracker=None) -> Generator:
        """
        Process the Create step by scheduling non-blocking entity arrivals.
        
        Args:
            entity_id: Not used for Create steps (entities are created, not processed)
            step: Create step configuration
            flow: Event flow configuration
            entity_table: Not used (entity table comes from create_config)
            event_table: Event table name for relationship setup
            
        Yields:
            None - this method returns immediately after scheduling first arrival
        """
        if not self.validate_step(step):
            logger.error(f"Invalid Create step configuration: {step.step_id}")
            return
            
        config = step.create_config
        logger.info(f"Starting Create module {step.step_id} for entity table '{config.entity_table}'")
        
        # Determine maximum entities to create
        max_entities = self._get_max_entities(config)
        logger.info(f"Create module {step.step_id} will generate up to {max_entities} entities")
        
        # Schedule the first arrival (non-blocking)
        self._schedule_next_arrival(step, flow, config, event_table, 0, max_entities)
        
        # Return immediately - arrivals will continue independently
        return None
        yield  # Make this a generator (required by interface)
    
    def _schedule_next_arrival(self, step: 'Step', flow: 'EventFlow', config: 'CreateConfig', 
                              event_table: str, entities_created: int, max_entities: int):
        """Schedule the next entity arrival as a separate non-blocking process."""
        # Generate interarrival time
        try:
            dist_config, time_unit = extract_distribution_config_with_time_unit(config.interarrival_time)
            interarrival_value = generate_from_distribution(dist_config)
            # Use specified time_unit or fall back to base_time_unit
            time_unit_to_use = time_unit if time_unit is not None else self.config.base_time_unit
            interarrival_minutes = TimeUnitConverter.to_minutes(interarrival_value, time_unit_to_use)
            
            # Schedule the arrival event
            self.env.process(self._entity_arrival_event(
                interarrival_minutes, step, flow, config, event_table, entities_created, max_entities
            ))
            
        except Exception as e:
            logger.error(f"Error scheduling arrival for Create module {step.step_id}: {e}", exc_info=True)
    
    def _entity_arrival_event(self, delay: float, step: 'Step', flow: 'EventFlow', 
                             config: 'CreateConfig', event_table: str, entities_created: int, max_entities: int):
        """Handle a single arrival event (possibly batch)."""
        try:
            # Wait for interarrival time
            yield self.env.timeout(delay)
            
            # Check if we should stop creating entities
            if max_entities != -1 and entities_created >= max_entities:
                logger.info(f"Create module {step.step_id} reached max entities ({max_entities})")
                return
            
            # Check termination conditions
            if self.simulator:
                should_terminate, reason = self.simulator._check_termination_conditions()
                if should_terminate:
                    logger.info(f"Create module {step.step_id} stopping - {reason}")
                    return
            
            # Determine how many entities to create in this arrival
            batch_size = self._get_entities_per_arrival(config)
            
            # Ensure we don't exceed max_entities
            if max_entities != -1:
                remaining_entities = max_entities - entities_created
                batch_size = min(batch_size, remaining_entities)
            
            # Create and route batch of entities
            successfully_created = 0
            for i in range(batch_size):
                created_entity_id = self._create_entity(config.entity_table, event_table)
                
                if created_entity_id:
                    # Increment entities processed counter for termination tracking
                    if self.simulator:
                        self.simulator.increment_entities_processed()
                    
                    # Route entity to first next step
                    first_next_step = step.next_steps[0]
                    self._route_entity_to_next_step(created_entity_id, first_next_step, flow, 
                                                   config.entity_table, event_table)
                    successfully_created += 1
                else:
                    logger.warning(f"Create module {step.step_id} failed to create entity")
            
            new_entities_created = entities_created + successfully_created
            
            if successfully_created > 0:
                if batch_size == 1:
                    logger.debug(f"Create module {step.step_id} created entity ({new_entities_created}/{max_entities if max_entities != -1 else '∞'})")
                else:
                    logger.debug(f"Create module {step.step_id} created {successfully_created} entities in batch ({new_entities_created}/{max_entities if max_entities != -1 else '∞'})")
            
            # Schedule next arrival if we haven't reached the limit
            if max_entities == -1 or new_entities_created < max_entities:
                self._schedule_next_arrival(step, flow, config, event_table, new_entities_created, max_entities)
            else:
                logger.info(f"Create module {step.step_id} completed. Created {new_entities_created} entities")
                
        except Exception as e:
            logger.error(f"Error in arrival event for Create module {step.step_id}: {e}", exc_info=True)
    
    def _get_entities_per_arrival(self, config: 'CreateConfig') -> int:
        """Get number of entities to create in this arrival."""
        if config.entities_per_arrival is None:
            return 1  # Default single entity
        
        # Support both integer and distribution
        if isinstance(config.entities_per_arrival, int):
            return config.entities_per_arrival
        else:
            # It's a distribution formula
            try:
                dist_config = extract_distribution_config(config.entities_per_arrival)
                return max(1, int(generate_from_distribution(dist_config)))
            except Exception as e:
                logger.warning(f"Error generating entities_per_arrival: {e}, using default 1")
                return 1
    
    def _get_max_entities(self, config: 'CreateConfig') -> int:
        """
        Determine maximum number of entities to create.
        
        Args:
            config: Create configuration
            
        Returns:
            Maximum entities to create, or -1 for unlimited
        """
        if config.max_entities is None or config.max_entities == 'n/a':
            return -1  # Unlimited - let simulation duration control termination
        
        return int(config.max_entities)
    
    def _create_entity(self, entity_table: str, event_table: str) -> Optional[int]:
        """
        Create a new entity in the specified table.
        
        Args:
            entity_table: Name of the entity table
            event_table: Name of the event table (for tracking)
            
        Returns:
            ID of created entity or None on failure
        """
        # Create a process-specific engine for this entity creation
        process_engine = create_engine(
            f"sqlite:///{self.entity_manager.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Create entity using EntityManager
                entity_id = self.entity_manager.create_entity(session, entity_table)
                
                if entity_id:
                    # Handle inventory selection if required for this entity table
                    self._handle_inventory_selection(entity_id, entity_table, session)
                    
                    session.commit()
                    
                    # Entity arrival time is now automatically tracked via created_at column
                    
                    # Update entity count
                    self.entity_manager.entity_count += 1
                    
                    return entity_id
                else:
                    logger.error(f"Failed to create entity in table {entity_table}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error creating entity in {entity_table}: {e}", exc_info=True)
            return None
        finally:
            process_engine.dispose()
    
    def _route_entity_to_next_step(self, entity_id: int, next_step_id: str, flow: 'EventFlow',
                                  entity_table: str, event_table: str):
        """
        Route the created entity to its next processing step.
        
        Args:
            entity_id: ID of the created entity
            next_step_id: ID of the next step to route to
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
        """
        try:
            if self.entity_router_callback:
                # Use the simulator's callback for proper integration
                self.entity_router_callback(entity_id, next_step_id, flow, entity_table, event_table)
            else:
                logger.warning(f"No entity router callback set. Entity {entity_id} cannot be routed to step {next_step_id}")
            
        except Exception as e:
            logger.error(f"Error routing entity {entity_id} to next step {next_step_id}: {e}", 
                        exc_info=True)
    
    
    def _find_step_by_id(self, step_id: str, flow: 'EventFlow') -> Optional['Step']:
        """
        Find a step by its ID within a flow.
        
        Args:
            step_id: Step ID to find
            flow: Event flow to search in
            
        Returns:
            Step object or None if not found
        """
        for step in flow.steps:
            if step.step_id == step_id:
                return step
        return None
    
    def _handle_inventory_selection(self, entity_id: int, entity_table: str, session):
        """
        Handle inventory selection for an entity if inventory requirements are configured.
        
        Args:
            entity_id: ID of the created entity
            entity_table: Name of the entity table
            session: SQLAlchemy session for database operations
        """
        try:
            # Check if this entity table has inventory requirements
            inventory_req = self._get_inventory_requirement(entity_table)
            if not inventory_req:
                return  # No inventory requirements for this entity type
            
            logger.debug(f"Processing inventory selection for entity {entity_id} in table {entity_table}")
            
            # Select inventory items based on requirements
            selected_items = self._select_inventory_items(inventory_req)
            
            if selected_items:
                # Populate bridge table with selected items
                self._populate_bridge_table(entity_id, selected_items, inventory_req.bridge_table, session)
                logger.debug(f"Populated bridge table {inventory_req.bridge_table} with {len(selected_items)} items for entity {entity_id}")
            
        except Exception as e:
            logger.error(f"Error handling inventory selection for entity {entity_id}: {e}", exc_info=True)
    
    def _get_inventory_requirement(self, entity_table: str):
        """
        Get inventory requirement configuration for the given entity table.
        
        Args:
            entity_table: Name of the entity table
            
        Returns:
            InventoryRequirement object or None if not found
        """
        if not self.config.event_simulation or not self.config.event_simulation.entities:
            return None
        
        for inventory_req in self.config.event_simulation.entities:
            if inventory_req.entity_table == entity_table:
                return inventory_req
        
        return None
    
    def _select_inventory_items(self, inventory_req):
        """
        Select inventory items based on the selection strategy and quantity requirements.
        
        Args:
            inventory_req: InventoryRequirement configuration
            
        Returns:
            List of tuples (inventory_id, quantity_needed)
        """
        try:
            # Get available inventory items
            available_items = self._get_available_inventory_items(inventory_req.inventory_table)
            
            if not available_items:
                logger.warning(f"No available inventory items in table {inventory_req.inventory_table}")
                return []
            
            # Determine how many different items to select
            num_items = self._evaluate_quantity_formula(inventory_req.quantity)
            num_items = min(num_items, len(available_items))  # Can't select more than available
            
            if num_items <= 0:
                return []
            
            # Select items based on strategy
            if inventory_req.selection_strategy == "random":
                selected_items = random.sample(available_items, num_items)
            else:
                # For now, default to random selection
                logger.warning(f"Selection strategy '{inventory_req.selection_strategy}' not implemented, using random")
                selected_items = random.sample(available_items, num_items)
            
            # Determine quantity needed for each selected item
            result = []
            for item_id in selected_items:
                quantity_needed = self._evaluate_quantity_formula(inventory_req.unit_quantity)
                result.append((item_id, max(1, quantity_needed)))  # Ensure at least 1
            
            return result
            
        except Exception as e:
            logger.error(f"Error selecting inventory items: {e}", exc_info=True)
            return []
    
    def _get_available_inventory_items(self, inventory_table: str):
        """
        Get list of available inventory item IDs from the inventory table.
        
        Args:
            inventory_table: Name of the inventory table
            
        Returns:
            List of inventory item IDs
        """
        try:
            # Create a direct connection to avoid session issues
            with self.engine.connect() as connection:
                pk_column = self.column_resolver.get_primary_key(inventory_table)
                quantity_column = self.column_resolver.get_inventory_quantity_column(inventory_table)
                query = text(f'SELECT "{pk_column}" FROM "{inventory_table}" WHERE "{quantity_column}" > 0 ORDER BY "{pk_column}"')
                results = connection.execute(query).fetchall()
                return [row[0] for row in results]
                
        except Exception as e:
            logger.error(f"Error getting available inventory items from {inventory_table}: {e}")
            return []
    
    def _evaluate_quantity_formula(self, formula):
        """
        Evaluate a quantity formula (can be int or distribution formula).
        
        Args:
            formula: Integer value or distribution formula string
            
        Returns:
            Integer quantity value
        """
        try:
            if isinstance(formula, int):
                return formula
            
            # It's a distribution formula
            dist_config = extract_distribution_config(formula)
            return max(1, int(generate_from_distribution(dist_config)))
            
        except Exception as e:
            logger.warning(f"Error evaluating quantity formula '{formula}': {e}, using default 1")
            return 1
    
    def _populate_bridge_table(self, entity_id: int, selected_items, bridge_table: str, session):
        """
        Populate the bridge table with selected inventory items.
        
        Args:
            entity_id: ID of the entity
            selected_items: List of tuples (inventory_id, quantity_needed)
            bridge_table: Name of the bridge table
            session: SQLAlchemy session
        """
        try:
            # Resolve FK column names using ColumnResolver
            entity_fk_col = self.column_resolver.get_entity_fk_column(bridge_table)
            inventory_fk_col = self.column_resolver.get_inventory_fk_column(bridge_table)
            quantity_req_col = self.column_resolver.get_entity_invreq_column(bridge_table)

            for inventory_id, quantity_needed in selected_items:
                # Insert into bridge table using resolved column names
                insert_stmt = text(f'''
                    INSERT INTO "{bridge_table}" ("{entity_fk_col}", "{inventory_fk_col}", "{quantity_req_col}")
                    VALUES (:entity_id, :inventory_id, :quantity_needed)
                ''')

                session.execute(insert_stmt, {
                    "entity_id": entity_id,
                    "inventory_id": inventory_id,
                    "quantity_needed": quantity_needed
                })

        except Exception as e:
            logger.error(f"Error populating bridge table {bridge_table}: {e}", exc_info=True)
            raise  # Re-raise to trigger transaction rollback
