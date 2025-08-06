"""
Create step processor for Arena-style entity creation.

This processor handles the creation of entities with specified arrival patterns
and routes them to their initial processing steps.
"""

import logging
from datetime import timedelta
from typing import Optional, Generator
from sqlalchemy import create_engine, insert
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from .base import StepProcessor
from ...utils.distribution_utils import generate_from_distribution

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
    
    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config):
        super().__init__(env, engine, resource_manager, entity_manager, event_tracker, config)
        # Callback for routing entities to initial steps (set by simulator)
        self.entity_router_callback = None
    
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
            
        if not config.initial_step:
            logger.error(f"Create step {step.step_id} missing initial_step")
            return False
            
        # Validate interarrival_time has distribution
        if not isinstance(config.interarrival_time, dict) or 'distribution' not in config.interarrival_time:
            logger.error(f"Create step {step.step_id} interarrival_time must have 'distribution' key")
            return False
            
        return True
    
    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                entity_table: str, event_table: str, event_tracker=None) -> Generator:
        """
        Process the Create step by generating entities with specified arrival pattern.
        
        Args:
            entity_id: Not used for Create steps (entities are created, not processed)
            step: Create step configuration
            flow: Event flow configuration
            entity_table: Not used (entity table comes from create_config)
            event_table: Event table name for relationship setup
            
        Yields:
            SimPy timeout events for entity arrival scheduling
        """
        if not self.validate_step(step):
            logger.error(f"Invalid Create step configuration: {step.step_id}")
            return
            
        config = step.create_config
        logger.info(f"Starting Create module {step.step_id} for entity table '{config.entity_table}'")
        
        # Determine maximum entities to create
        max_entities = self._get_max_entities(config)
        logger.info(f"Create module {step.step_id} will generate up to {max_entities} entities")
        
        # Generate entities dynamically
        entities_created = 0
        
        while max_entities == -1 or entities_created < max_entities:
            # Generate interarrival time
            try:
                interarrival_days = generate_from_distribution(config.interarrival_time)
                interarrival_minutes = interarrival_days * 24 * 60  # Convert days to minutes
                
                # Wait for the next entity arrival
                yield self.env.timeout(interarrival_minutes)
                
                # Check if we've exceeded simulation duration
                if self.env.now > self.config.duration_days * 24 * 60:
                    logger.info(f"Create module {step.step_id} stopping - simulation duration exceeded")
                    break
                
                # Create the entity
                created_entity_id = self._create_entity(config.entity_table, event_table)
                
                if created_entity_id:
                    # Route entity to initial step
                    self._route_entity_to_initial_step(created_entity_id, config.initial_step, flow, 
                                                     config.entity_table, event_table)
                    entities_created += 1
                    logger.debug(f"Create module {step.step_id} created entity {created_entity_id} "
                               f"({entities_created}/{max_entities if max_entities != -1 else '∞'})")
                else:
                    logger.warning(f"Create module {step.step_id} failed to create entity")
                    
            except Exception as e:
                logger.error(f"Error in Create module {step.step_id}: {e}", exc_info=True)
                break
        
        logger.info(f"Create module {step.step_id} completed. Created {entities_created} entities")
        
        # Create modules don't return a next step - they run continuously
        return None
    
    def _get_max_entities(self, config: 'CreateConfig') -> int:
        """
        Determine maximum number of entities to create.
        
        Args:
            config: Create configuration
            
        Returns:
            Maximum entities to create, or -1 for unlimited
        """
        if config.max_entities is None or config.max_entities == 'n/a':
            # Estimate based on simulation duration and average interarrival time
            try:
                distribution = config.interarrival_time.get('distribution', {})
                
                if distribution.get('type') == 'exponential':
                    avg_interarrival_days = distribution.get('scale', 1)
                elif distribution.get('type') == 'normal':
                    avg_interarrival_days = distribution.get('mean', 1)
                elif distribution.get('type') == 'uniform':
                    avg_interarrival_days = (distribution.get('min', 0) + distribution.get('max', 2)) / 2
                else:
                    avg_interarrival_days = 1  # Default
                
                # Estimate with 50% buffer
                estimated = int(self.config.duration_days / avg_interarrival_days * 1.5)
                logger.debug(f"Estimated max_entities: {estimated} based on duration and interarrival time")
                return estimated
                
            except Exception as e:
                logger.warning(f"Error estimating max_entities: {e}. Using unlimited.")
                return -1  # Unlimited
        
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
                    session.commit()
                    
                    # Record entity arrival using a direct connection
                    arrival_datetime = self.config.start_date + timedelta(minutes=self.env.now)
                    
                    with process_engine.connect() as conn:
                        stmt = insert(self.event_tracker.entity_arrivals).values(
                            entity_table=entity_table,
                            entity_id=entity_id,
                            arrival_time=self.env.now,
                            arrival_datetime=arrival_datetime
                        )
                        conn.execute(stmt)
                        conn.commit()
                    
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
    
    def _route_entity_to_initial_step(self, entity_id: int, initial_step_id: str, flow: 'EventFlow',
                                    entity_table: str, event_table: str):
        """
        Route the created entity to its initial processing step.
        
        Args:
            entity_id: ID of the created entity
            initial_step_id: ID of the initial step to route to
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
        """
        try:
            if self.entity_router_callback:
                # Use the simulator's callback for proper integration
                self.entity_router_callback(entity_id, initial_step_id, flow, entity_table, event_table)
            else:
                logger.warning(f"No entity router callback set. Entity {entity_id} cannot be routed to step {initial_step_id}")
            
        except Exception as e:
            logger.error(f"Error routing entity {entity_id} to initial step {initial_step_id}: {e}", 
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