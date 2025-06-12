"""
Simulation engine for DB Simulator.

This module implements the event-based simulation functionality 
using SimPy to model resource allocation and scheduling.
"""

import logging
import simpy
import random
from datetime import timedelta
from typing import Dict, List, Tuple, Any, Optional, Union
import random
import numpy as np
from sqlalchemy import create_engine, inspect, select, func, text, insert
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from ..config_parser import SimulationConfig, EventSimulation, ShiftPattern, ResourceShift, DatabaseConfig
from ..config_parser import Entity as DbEntity, Attribute as DbAttribute
from ..utils.distribution_utils import generate_from_distribution
from ..utils.data_generation import generate_attribute_value
from .event_tracker import EventTracker
from .resource_manager import ResourceManager
from .entity_manager import EntityManager
import dataclasses

logger = logging.getLogger(__name__)

class EventSimulator:
    """
    Event-based simulator for processing entities through a sequence of events
    
    The simulator uses SimPy to model the discrete event simulation, where:
    - Entities (e.g., Projects, Patients) arrive according to a configured pattern
    - Events (e.g., Deliverables, Treatments) are processed in primary key order
    - Resources (e.g., Consultants, Doctors) are allocated to complete events
    """
    
    def __init__(self, config: SimulationConfig, db_config: DatabaseConfig, db_path: str):
        """
        Initialize the simulator
        
        Args:
            config: Simulation configuration
            db_config: Database configuration (for generators)
            db_path: Path to the SQLite database
        """
        self.config = config
        self.db_config = db_config
        self.db_path = db_path
        
        # Use NullPool to avoid connection pool issues with SQLite
        # and enable WAL journal mode for better concurrency
        self.engine = create_engine(
            f"sqlite:///{db_path}?journal_mode=WAL",
            poolclass=NullPool
        )
        
        # Initialize SimPy environment
        self.env = simpy.Environment()
        
        # Initialize resource manager
        self.resource_manager = ResourceManager(self.env, self.engine, self.db_path, self.db_config)
        
        # Initialize counters
        self.processed_events = 0
        
        # Set random seed if provided
        if config.random_seed is not None:
            random.seed(config.random_seed)
            np.random.seed(config.random_seed)
            
        # Initialize event tracker - Pass table names from config
        event_table_name = None
        resource_table_name = None
        bridge_table_config = None
        
        if config.event_simulation:
            if config.event_simulation.table_specification:
                # Use table specification from simulation config
                spec = config.event_simulation.table_specification
                event_table_name = spec.event_table
                # TODO: Handle multiple resource tables if needed
                resource_table_name = spec.resource_table
                logger.info(f"Using table specification from simulation config: event_table='{event_table_name}', resource_table='{resource_table_name}'")
            elif db_config:
                # Derive table specification from database config based on table types
                for entity in db_config.entities:
                    if entity.type == 'event':
                        event_table_name = entity.name
                    elif entity.type == 'resource':
                        resource_table_name = entity.name
                
                if event_table_name and resource_table_name:
                    logger.info(f"Derived table specification from database config: event_table='{event_table_name}', resource_table='{resource_table_name}'")
                else:
                    logger.warning("Could not derive complete table specification from database config. EventTracker may not work correctly.")
            else:
                logger.warning("Event simulation has no table specification and no database config provided. EventTracker may not create bridging table.")
        else:
            logger.warning("No event simulation configuration found. EventTracker may not create bridging table.")
        
        # Look for a bridge table in the database configuration
        if db_config and event_table_name and resource_table_name:
            # Find a bridge table entity that has event_id and resource_id type attributes
            for entity in db_config.entities:
                event_fk_attr = None
                resource_fk_attr = None
                
                # Check if this entity has attributes with type 'event_id' and 'resource_id'
                for attr in entity.attributes:
                    if attr.type == 'event_id' and attr.ref and attr.ref.startswith(f"{event_table_name}."):
                        event_fk_attr = attr
                    elif attr.type == 'resource_id' and attr.ref and attr.ref.startswith(f"{resource_table_name}."):
                        resource_fk_attr = attr
                
                # If we found both attributes, this is our bridge table
                if event_fk_attr and resource_fk_attr:
                    bridge_table_config = {
                        'name': entity.name,
                        'event_fk_column': event_fk_attr.name,
                        'resource_fk_column': resource_fk_attr.name
                    }
                    logger.info(f"Found bridge table in database config: {entity.name}")
                    break

        self.event_tracker = EventTracker(
            db_path,
            config.start_date,
            event_table_name=event_table_name,
            resource_table_name=resource_table_name,
            bridge_table_config=bridge_table_config
        )
        
        # Initialize entity manager
        self.entity_manager = EntityManager(self.env, self.engine, self.db_path, config, db_config, self.event_tracker)
    
    
    def run(self) -> Dict[str, Any]:
        """
        Run the simulation
        
        Returns:
            Dictionary with simulation results
        """
        # Set random seed if specified
        if self.config.random_seed is not None:
            random.seed(self.config.random_seed)
            np.random.seed(self.config.random_seed)
        
        # Setup resources
        self.resource_manager.setup_resources(self.config.event_simulation)
        
        # Pre-generate entity arrivals
        entity_arrivals = self.entity_manager.pre_generate_entity_arrivals()
        
        # Start entity generation process
        if entity_arrivals:
            self.env.process(self.entity_manager.process_pre_generated_arrivals(entity_arrivals, self._process_entity_events))
        else:
            # Fallback to dynamic generation if pre-generation fails
            self.env.process(self.entity_manager.generate_entities(self._process_entity_events))
            logger.warning("Failed to pre-generate entity arrivals. No entities will be processed.")
        
        # Run simulation for specified duration
        duration_minutes = self.config.duration_days * 24 * 60  # Convert days to minutes
        logger.info(f"Starting simulation for {self.config.duration_days} days")
        self.env.run(until=duration_minutes)
        
        # Clean up any remaining allocated resources
        if hasattr(self.resource_manager, 'event_allocations'):
            remaining_allocations = list(self.resource_manager.event_allocations.keys())
            if remaining_allocations:
                logger.info(f"Cleaning up {len(remaining_allocations)} remaining resource allocations")
                for event_id in remaining_allocations:
                    try:
                        self.resource_manager.release_resources(event_id)
                    except Exception as e:
                        logger.debug(f"Error releasing resources for event {event_id}: {e}")
        
        logger.info(f"Simulation completed. Processed {self.processed_events} events for {self.entity_manager.entity_count} entities")
        
        # Get final resource utilization stats
        resource_stats = self.resource_manager.get_utilization_stats()
        
        # Return simulation results
        return {
            'duration_days': self.config.duration_days,
            'entity_count': self.entity_manager.entity_count,
            'processed_events': self.processed_events,
            'resource_utilization': resource_stats
        }


    def _process_entity_events(self, entity_id: int):
        """
        Process all events for an entity
        
        Args:
            entity_id: Entity ID (0-based index)
        """
        entity_table, event_table, resource_table = self.entity_manager.get_table_names()
        if not entity_table or not event_table:
            logger.error(f"Missing entity or event table names. Cannot process events for entity {entity_id}")
            yield self.env.timeout(0)  # Make it a generator by yielding
            return
        
        # Create a process-specific engine for isolation
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Find the relationship column
                relationship_columns = self.entity_manager.find_relationship_columns(session, entity_table, event_table)
                if not relationship_columns:
                    logger.error(f"No relationship column found between {entity_table} and {event_table}")
                    yield self.env.timeout(0)  # Make it a generator by yielding
                    return
                
                relationship_column = relationship_columns[0]
                
                # Get the adjusted entity ID (1-based indexing in the database)
                db_entity_id = entity_id + 1
                
                # Find initial events for this entity (those with the initial event type)
                # Query for events with the entity ID in the relationship column
                sql_query = text(f"""
                    SELECT id FROM {event_table}
                    WHERE {relationship_column} = {db_entity_id}
                """)
                result = session.execute(sql_query).fetchall()
                
                if result:
                    event_ids = [row[0] for row in result]
                    logger.debug(f"Found {len(event_ids)} events for entity {db_entity_id}: {event_ids}")
                    
                    # Process each event
                    for event_id in event_ids:
                        self.env.process(self._process_event(db_entity_id, event_id, event_table, entity_table))
                        
                    # Yield to make this a generator
                    yield self.env.timeout(0)
                else:
                    logger.warning(f"No events found for entity {db_entity_id}")
                    yield self.env.timeout(0)  # Make it a generator by yielding
        except Exception as e:
            logger.error(f"Error processing events for entity {entity_id}: {str(e)}", exc_info=True)
            yield self.env.timeout(0)  # Make it a generator by yielding
        finally:
            # Always dispose of the process-specific engine
            process_engine.dispose()
    
    def _determine_required_resources(self, event_id: int) -> List[str]:
        """
        Determine the required resources for an event
        
        Args:
            event_id: Event ID
            
        Returns:
            List of resource keys
        """
        return self.resource_manager.determine_required_resources(event_id, self.config.event_simulation)
    
    def _get_event_duration(self, event_type: str) -> float:
        """
        Get the duration for an event type from the event sequence configuration
        
        Args:
            event_type: Event type
            
        Returns:
            Duration in minutes
            
        Raises:
            ValueError: If no duration is found for the event type
        """
        event_sim = self.config.event_simulation
        if not event_sim:
            logger.warning("No event simulation configuration found")
            raise ValueError("No event simulation configuration found")
        
        # Check if event sequence is configured and has a specific duration for this event type
        if event_sim.event_sequence and event_type:
            # Find the event type definition in the event sequence configuration
            for et in event_sim.event_sequence.event_types:
                if et.name == event_type:
                    # Use event type-specific duration
                    duration_days = generate_from_distribution(et.duration.get('distribution', {}))
                    return duration_days * 24 * 60  # Convert days to minutes
        
        # Instead of falling back to default values, raise a warning and error
        logger.warning(f"No duration found for event type '{event_type}'")
        raise ValueError(f"No duration found for event type '{event_type}'")

    def _get_next_event_type(self, current_event_type: str) -> Optional[str]:
        """
        Determine the next event type based on transitions
        
        Args:
            current_event_type: The current event type
            
        Returns:
            The next event type or None if no transition is defined
        """
        try:
            event_sim = self.config.event_simulation
            if not event_sim:
                logger.warning("No event simulation configuration found")
                return None
            if not event_sim.event_sequence:
                logger.warning("No event sequence configuration found")
                return None
            if not event_sim.event_sequence.transitions:
                logger.warning(f"No transitions defined for event type '{current_event_type}'")
                return None
            
            # Find the transition for this event type
            for transition in event_sim.event_sequence.transitions:
                if transition.from_event == current_event_type:
                    # Found the transition, determine the next event type based on probabilities
                    if not transition.to_events:
                        logger.warning(f"No destination events defined for transition from '{current_event_type}'")
                        return None
                    
                    # If there's only one destination, return it
                    if len(transition.to_events) == 1:
                        return transition.to_events[0].event_type
                        
                    # Generate a random number to determine the next event
                    import random
                    r = random.random()
                    cumulative_prob = 0.0
                    
                    for event_transition in transition.to_events:
                        cumulative_prob += event_transition.probability
                        if r <= cumulative_prob:
                            return event_transition.event_type
            
            # No transition found for this event type
            logger.warning(f"No transition found for event type '{current_event_type}'")
            return None
        except Exception as e:
            logger.error(f"Error determining next event type: {str(e)}", exc_info=True)
        return None

    def _process_event(self, entity_id: int, event_id: int, event_table: str, entity_table: str):
        """
        Process an event for an entity
        
        Args:
            entity_id: Entity ID
            event_id: Event ID
            event_table: Name of the event table
            entity_table: Name of the entity table
        """
        # Check if simulation is still running
        duration_minutes = self.config.duration_days * 24 * 60
        if self.env.now >= duration_minutes:
            logger.debug(f"Skipping event {event_id} processing - simulation time exceeded")
            return
        
        # Create a process-specific engine for isolation
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Get event details
                relationship_columns = self.entity_manager.find_relationship_columns(session, entity_table, event_table)
                if not relationship_columns:
                    logger.error(f"No relationship column found between {entity_table} and {event_table}")
                    return
                
                relationship_column = relationship_columns[0]
                
                # Find the event type column
                event_type_column = self.entity_manager.find_event_type_column(session, event_table)
                if not event_type_column:
                    logger.error(f"Could not find event type column in {event_table}")
                    return
                
                # Get the event type
                sql_query = text(f"SELECT {event_type_column} FROM {event_table} WHERE id = {event_id}")
                logger.debug(f"Getting event type with query: {sql_query}")
                result = session.execute(sql_query).fetchone()
                
                if not result:
                    logger.error(f"Event {event_id} not found in {event_table}")
                    return
            
                event_type = result[0]
                logger.debug(f"Event {event_id} has type {event_type}")
                
                # Record the entity's current event
                self.entity_manager.entity_current_event_types[entity_id] = event_type
                
                # Find the event configuration
                event_sim = self.config.event_simulation
                if event_sim and event_sim.event_sequence and event_sim.event_sequence.event_types:
                    # Find event details for this type
                    event_config = None
                    for et in event_sim.event_sequence.event_types:
                        if et.name == event_type:
                            event_config = et
                            break
                    
                    if not event_config:
                        logger.error(f"No configuration found for event type '{event_type}'. Event processing will be skipped.")
                        return
                    
                    # Get the event duration
                    logger.debug(f"Getting duration for event type {event_type}")
                    duration_days = generate_from_distribution(event_config.duration.get('distribution', {}))
                    duration_minutes = duration_days * 24 * 60  # Convert to minutes
                    
                    # Get resource requirements
                    resource_requirements = event_config.resource_requirements
                    
                    # Allocate resources using the new FilterStore-based approach
                    if resource_requirements:
                        # Convert resource requirements to the format expected by allocate_resources
                        requirements_list = []
                        for req in resource_requirements:
                            requirements_list.append({
                                'resource_table': req.resource_table,
                                'value': req.value,
                                'count': req.count
                            })
                        
                        # Allocate resources (this will yield until resources are available)
                        try:
                            yield self.env.process(
                                self.resource_manager.allocate_resources(event_id, requirements_list)
                            )
                        except simpy.Interrupt:
                            logger.warning(f"Resource allocation interrupted for event {event_id}")
                            return
                    
                    # Record event processing start
                    start_time = self.env.now
                    start_datetime = self.config.start_date + timedelta(minutes=start_time)
                    
                    # Wait for the event duration
                    yield self.env.timeout(duration_minutes)
                    
                    # Record event processing end
                    end_time = self.env.now
                    end_datetime = self.config.start_date + timedelta(minutes=end_time)
                    
                    # Record resource allocations in the tracker
                    # Get the allocated resources from the resource manager
                    if event_id in self.resource_manager.event_allocations:
                        allocated_resources = self.resource_manager.event_allocations[event_id]
                        for resource in allocated_resources:
                            # Record in the event tracker
                            self.event_tracker.record_resource_allocation(
                                event_id=event_id,
                                resource_table=resource.table,
                                resource_id=resource.id,
                                allocation_time=start_time,
                                release_time=end_time
                            )
                    
                    # Release resources using the new method
                    self.resource_manager.release_resources(event_id)
                    
                    # Record the event processing
                    with process_engine.connect() as conn:
                        stmt = insert(self.event_tracker.event_processing).values(
                            event_table=event_table,
                            event_id=event_id,
                            entity_id=entity_id,
                            start_time=start_time,
                            end_time=end_time,
                            duration=duration_minutes,
                            start_datetime=start_datetime,
                            end_datetime=end_datetime
                        )
                        conn.execute(stmt)
                        conn.commit()
                    
                    # Increment the processed events counter
                    self.processed_events += 1
                            
                    logger.info(f"Processed event {event_id} of type {event_type} for entity {entity_id} in {duration_minutes/60:.2f} hours")
                    
                    # Create the next event if needed
                    # Determine the next event type based on transitions
                    next_event_type = self._get_next_event_type(event_type)
                    
                    if next_event_type:
                        # --- Start: Logic copied and adapted from _create_events --- 
                        event_entity_config = self.entity_manager.get_entity_config(event_table)
                        if not event_entity_config:
                            logger.error(f"Database configuration not found for event entity: {event_table} when creating next event. Cannot proceed with event creation.")
                            return

                        # Get the next ID for the new event
                        sql_query = text(f"SELECT MAX(id) FROM {event_table}")
                        result = session.execute(sql_query).fetchone()
                        next_id = (result[0] or 0) + 1
                        
                        # Prepare data for the new event row, including generated attributes
                        row_data = {
                            "id": next_id,
                            relationship_column: entity_id,
                            event_type_column: next_event_type
                        }

                        # Generate values for other attributes
                        for attr in event_entity_config.attributes:
                            # Skip PK, the FK to the entity, and the event type column
                            if attr.is_primary_key or attr.name == relationship_column or attr.name == event_type_column:
                                continue
                            
                            # Skip other Foreign Keys for now
                            if attr.is_foreign_key:
                                continue

                            if attr.generator:
                                # Special handling for 'simulation_event' generator type - skip it
                                if attr.generator.type == 'simulation_event':
                                    continue 
                                    
                                gen_dict = dataclasses.asdict(attr.generator)
                                attr_config_dict = {
                                    'name': attr.name,
                                    'generator': gen_dict
                                }
                                # Use next_id - 1 for 0-based row_index context
                                row_data[attr.name] = generate_attribute_value(attr_config_dict, next_id - 1)
                            else:
                                # Instead of silently letting DB handle defaults, log a warning
                                logger.warning(f"No generator defined for attribute '{attr.name}' in table '{event_table}'. Database defaults will be used if available.")

                        # Build INSERT statement dynamically
                        columns = ", ".join(row_data.keys())
                        placeholders = ", ".join([f":{col}" for col in row_data.keys()])
                        sql_query = text(f"INSERT INTO {event_table} ({columns}) VALUES ({placeholders})")

                        logger.debug(f"Creating next event in {event_table} with data: {row_data}")
                        session.execute(sql_query, row_data)
                        # --- End: Logic copied and adapted from _create_events --- 
                        
                        # Commit the changes for the new event immediately?
                        # Or commit might happen when the session context manager exits?
                        # Let's rely on the session commit at the end of _generate_entities or similar process start point.
                        # Re-evaluating: The original code committed here. Let's keep that.
                        session.commit()
                        
                        # Process the new event
                        logger.info(f"Created next event {next_id} of type {next_event_type} for entity {entity_id}")
                        self.env.process(self._process_event(entity_id, next_id, event_table, entity_table))
                    else:
                        logger.info(f"Entity {entity_id} has completed all events in the sequence")
                else:
                    logger.warning("No event sequence configured. Cannot process events properly.")
        except GeneratorExit:
            # This happens when the simulation ends and interrupts ongoing processes
            logger.debug(f"Event {event_id} processing interrupted by simulation end")
            # Clean up resources if allocated
            if event_id in self.resource_manager.event_allocations:
                self.resource_manager.release_resources(event_id)
        except Exception as e:
            # Don't log full traceback for database connection errors during cleanup
            if "Cannot operate on a closed database" in str(e):
                logger.debug(f"Event {event_id} processing interrupted by database closure during simulation cleanup")
            else:
                logger.error(f"Error processing event {event_id}: {str(e)}", exc_info=True)
            # Clean up resources if allocated
            if event_id in self.resource_manager.event_allocations:
                try:
                    self.resource_manager.release_resources(event_id)
                except Exception as cleanup_error:
                    logger.debug(f"Error during resource cleanup for event {event_id}: {cleanup_error}")
        finally:
            # Always dispose of the process-specific engine
            try:
                process_engine.dispose()
            except Exception as e:
                logger.debug(f"Error disposing engine for event {event_id}: {e}")
