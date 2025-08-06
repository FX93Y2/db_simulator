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

from ..config_parser import SimulationConfig, EventSimulation, ShiftPattern, ResourceShift, DatabaseConfig, EventFlow, Step
from ..config_parser import Entity as DbEntity, Attribute as DbAttribute
from ..utils.distribution_utils import generate_from_distribution
from ..utils.data_generation import generate_attribute_value
from .event_tracker import EventTracker
from .resource_manager import ResourceManager
from .entity_manager import EntityManager
from .entity_attribute_manager import EntityAttributeManager
from .step_processors import StepProcessorFactory
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
        
        # Initialize entity attribute manager for Arena-style assign functionality
        self.entity_attribute_manager = EntityAttributeManager()
        
        # Initialize step processor factory
        self.step_processor_factory = StepProcessorFactory(
            self.env, self.engine, self.resource_manager, self.entity_manager, 
            self.event_tracker, self.config, self.entity_attribute_manager
        )
    
    
    def run(self) -> Dict[str, Any]:
        """
        Run the simulation
        
        Returns:
            Dictionary with simulation results
        """
        try:
            # Set random seed if specified
            if self.config.random_seed is not None:
                random.seed(self.config.random_seed)
                np.random.seed(self.config.random_seed)
            
            # Setup resources
            self.resource_manager.setup_resources(self.config.event_simulation)
            
            # Start entity generation process using Create step modules
            self._start_create_modules()
            
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
            
            # Get entity attribute statistics
            attribute_stats = self.entity_attribute_manager.get_statistics()
            
            # Return simulation results
            return {
                'duration_days': self.config.duration_days,
                'entity_count': self.entity_manager.entity_count,
                'processed_events': self.processed_events,
                'resource_utilization': resource_stats,
                'entity_attributes': attribute_stats
            }
            
        finally:
            # ALWAYS clean up database connections to prevent EBUSY errors on Windows
            self._cleanup_database_connections()

    def _cleanup_database_connections(self):
        """
        Clean up all database connections to prevent EBUSY errors on Windows.
        This method is called in a finally block to ensure cleanup happens even if simulation fails.
        """
        try:
            import time
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            logger.info(f"[{timestamp}] [PYTHON] Starting simulator cleanup to prevent EBUSY errors for: {self.db_path}")
            
            # Dispose EventTracker engine first
            if hasattr(self, 'event_tracker') and self.event_tracker:
                logger.info(f"[{timestamp}] [PYTHON] Disposing EventTracker engine for: {self.db_path}")
                self.event_tracker.dispose()
                logger.info(f"[{timestamp}] [PYTHON] EventTracker engine disposed for: {self.db_path}")
            
            # Dispose main simulator engine
            if hasattr(self, 'engine') and self.engine:
                logger.info(f"[{timestamp}] [PYTHON] Disposing main simulator engine for: {self.db_path}")
                self.engine.dispose()
                logger.info(f"[{timestamp}] [PYTHON] Main simulator engine disposed successfully for: {self.db_path}")
            
            # Force SQLite to close all connections and cleanup WAL files
            import sqlite3
            try:
                logger.info(f"[{timestamp}] [PYTHON] Opening connection for WAL checkpoint: {self.db_path}")
                # Connect briefly to force WAL checkpoint and close
                conn = sqlite3.connect(self.db_path, timeout=1.0)
                logger.info(f"[{timestamp}] [PYTHON] Connection opened for WAL checkpoint: {self.db_path}")
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
                conn.commit()
                logger.info(f"[{timestamp}] [PYTHON] WAL checkpoint executed for: {self.db_path}")
                conn.close()
                logger.info(f"[{timestamp}] [PYTHON] WAL checkpoint connection closed for: {self.db_path}")
                
                # Small delay to ensure OS releases file handles
                time.sleep(0.2)
                logger.info(f"[{timestamp}] [PYTHON] File handle release delay completed for: {self.db_path}")
                
            except Exception as sqlite_err:
                logger.warning(f"[{timestamp}] [PYTHON] Could not force SQLite cleanup for {self.db_path}: {sqlite_err}")
                
            # Clean up entity attributes
            if hasattr(self, 'entity_attribute_manager') and self.entity_attribute_manager:
                logger.info(f"[{timestamp}] [PYTHON] Clearing entity attribute manager for: {self.db_path}")
                self.entity_attribute_manager.clear_all()
            
            logger.info(f"[{timestamp}] [PYTHON] Simulator cleanup completed for: {self.db_path}")
            
        except Exception as e:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            logger.warning(f"[{timestamp}] [PYTHON] Error during simulator cleanup for {self.db_path}: {e}")

    def _start_create_modules(self):
        """
        Start all Create step modules found in event flows.
        
        This method scans all event flows for Create steps and starts them as
        concurrent SimPy processes to generate entities dynamically.
        """
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.event_flows or not event_sim.event_flows.flows:
            logger.warning("No event flows found. No entities will be created.")
            return
        
        create_modules_started = 0
        
        # Scan all flows for Create steps
        for flow in event_sim.event_flows.flows:
            logger.debug(f"Scanning flow {flow.flow_id} for Create modules")
            
            for step in flow.steps:
                if step.step_type == 'create' and step.create_config:
                    logger.info(f"Starting Create module: {step.step_id} (table: {step.create_config.entity_table})")
                    
                    # Start the Create module as a SimPy process
                    self.env.process(self._run_create_module(step, flow))
                    create_modules_started += 1
        
        if create_modules_started == 0:
            logger.warning("No Create modules found in event flows. No entities will be created.")
        else:
            logger.info(f"Started {create_modules_started} Create module(s)")

    def _run_create_module(self, create_step: 'Step', flow: 'EventFlow'):
        """
        Run a Create module as a SimPy process.
        
        Args:
            create_step: The Create step configuration
            flow: The event flow containing this Create step
        """
        try:
            # Get table names for this flow
            entity_table = create_step.create_config.entity_table
            entity_table_config, event_table, resource_table = self.entity_manager.get_table_names()
            
            # Use the entity table from the Create config instead of the global one
            logger.debug(f"Create module {create_step.step_id} using tables: entity={entity_table}, event={event_table}")
            
            # Get the Create step processor and set up entity routing callback
            create_processor = self.step_processor_factory.get_processor('create')
            if create_processor:
                # Set the entity routing callback so Create processor can route entities properly
                create_processor.entity_router_callback = self._route_entity_from_create
            
            # Process the Create step using the step processor factory
            step_generator = self.step_processor_factory.process_step(
                0,  # entity_id not used for Create steps
                create_step, 
                flow, 
                entity_table,  # Use the specific entity table from Create config
                event_table or 'Task'  # Default event table if not found
            )
            
            # Run the Create step generator
            yield from step_generator
            
        except Exception as e:
            logger.error(f"Error running Create module {create_step.step_id}: {e}", exc_info=True)
    
    def _route_entity_from_create(self, entity_id: int, initial_step_id: str, flow: 'EventFlow', 
                                entity_table: str, event_table: str):
        """
        Callback method for Create processors to route entities to their initial steps.
        
        This method integrates with the simulator's main processing system.
        
        Args:
            entity_id: ID of the created entity
            initial_step_id: ID of the initial step to route to  
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
        """
        try:
            # Find the initial step in the flow
            initial_step = self._find_step_by_id(initial_step_id, flow)
            if not initial_step:
                logger.error(f"Initial step {initial_step_id} not found in flow {flow.flow_id}")
                return
            
            logger.info(f"Routing entity {entity_id} from table {entity_table} to step {initial_step_id}")
            
            # Start processing the entity from the initial step using the simulator's step processing
            self.env.process(self._process_step(entity_id, initial_step_id, flow, entity_table, event_table))
            
        except Exception as e:
            logger.error(f"Error routing entity {entity_id} from Create module: {e}", exc_info=True)

    def _process_entity_events(self, entity_id: int):
        """
        Process all events for an entity using either old or new architecture
        
        Args:
            entity_id: Entity ID (0-based index)
        """
        entity_table, event_table, resource_table = self.entity_manager.get_table_names()
        if not entity_table or not event_table:
            logger.error(f"Missing entity or event table names. Cannot process events for entity {entity_id}")
            yield self.env.timeout(0)  # Make it a generator by yielding
            return
        
        # Get the adjusted entity ID (1-based indexing in the database)
        db_entity_id = entity_id + 1
        
        # Use new event flows architecture
        event_sim = self.config.event_simulation
        if event_sim and event_sim.event_flows and event_sim.event_flows.flows:
            yield from self._process_entity_with_flows(db_entity_id, entity_table, event_table)
        else:
            logger.error("No event flows configuration found")
            yield self.env.timeout(0)

    def _process_entity_with_flows(self, entity_id: int, entity_table: str, event_table: str):
        """
        Process entity using the new event flows architecture
        
        Args:
            entity_id: Entity ID (1-based for database)
            entity_table: Name of the entity table
            event_table: Name of the event table
        """
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.event_flows or not event_sim.event_flows.flows:
            logger.error("No event flows configuration found")
            yield self.env.timeout(0)
            return
        
        # For now, assume there's only one flow (first flow in the list)
        flow = event_sim.event_flows.flows[0]
        
        logger.info(f"Starting entity {entity_id} in flow {flow.flow_id} at step {flow.initial_step}")
        
        # Start processing from the initial step
        self.env.process(self._process_step(entity_id, flow.initial_step, flow, entity_table, event_table))
        
        # Yield to make this a generator
        yield self.env.timeout(0)

    
    def _determine_required_resources(self, event_id: int) -> List[str]:
        """
        Determine the required resources for an event
        
        Args:
            event_id: Event ID
            
        Returns:
            List of resource keys
        """
        return self.resource_manager.determine_required_resources(event_id, self.config.event_simulation)
    

    def _find_step_by_id(self, step_id: str, flow: 'EventFlow') -> Optional['Step']:
        """
        Find a step by its ID within a flow
        
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
    
    # Legacy method removed - now handled by DecideStepProcessor
    
    def _get_step_event_duration(self, step: 'Step') -> float:
        """
        Get the duration for an event step
        
        Args:
            step: Event step configuration
            
        Returns:
            Duration in minutes
        """
        if not step.event_config or not step.event_config.duration:
            logger.warning(f"No duration configured for event step {step.step_id}")
            return 0.0
        
        duration_days = generate_from_distribution(step.event_config.duration.get('distribution', {}))
        return duration_days * 24 * 60  # Convert days to minutes

    def _process_step(self, entity_id: int, step_id: str, flow: 'EventFlow', entity_table: str, event_table: str):
        """
        Process a step in the event flow using modular step processors.
        
        Args:
            entity_id: Entity ID
            step_id: Current step ID
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
        """
        step = self._find_step_by_id(step_id, flow)
        if not step:
            logger.error(f"Step {step_id} not found in flow {flow.flow_id}")
            return
        
        logger.debug(f"Processing step {step_id} of type {step.step_type} for entity {entity_id}")
        
        try:
            # Use the step processor factory to process the step
            step_generator = self.step_processor_factory.process_step(
                entity_id, step, flow, entity_table, event_table
            )
            
            # Process the step and get the next step ID
            next_step_id = yield from step_generator
            
            # Continue to next step if applicable
            if next_step_id:
                self.env.process(self._process_step(entity_id, next_step_id, flow, entity_table, event_table))
            else:
                logger.debug(f"Entity {entity_id} flow ended at step {step_id}")
                
        except Exception as e:
            logger.error(f"Error processing step {step_id} for entity {entity_id}: {str(e)}", exc_info=True)

    def _process_event_step(self, entity_id: int, step: 'Step', flow: 'EventFlow', entity_table: str, event_table: str):
        """
        Process an event step with resource allocation and duration
        
        Args:
            entity_id: Entity ID
            step: Event step configuration
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
        """
        if not step.event_config:
            logger.error(f"Event step {step.step_id} has no event configuration")
            return
        
        # Create a process-specific engine for isolation
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Create a new event in the database for this step
                event_id = self._create_event_for_step(session, entity_id, step, entity_table, event_table)
                if not event_id:
                    logger.error(f"Failed to create event for step {step.step_id}")
                    return
                
                # Get resource requirements and allocate resources
                resource_requirements = step.event_config.resource_requirements
                if resource_requirements:
                    requirements_list = []
                    for req in resource_requirements:
                        requirements_list.append({
                            'resource_table': req.resource_table,
                            'value': req.value,
                            'count': req.count
                        })
                    
                    # Allocate resources
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
                duration_minutes = self._get_step_event_duration(step)
                yield self.env.timeout(duration_minutes)
                
                # Record event processing end
                end_time = self.env.now
                end_datetime = self.config.start_date + timedelta(minutes=end_time)
                
                # Record resource allocations in the tracker
                if event_id in self.resource_manager.event_allocations:
                    allocated_resources = self.resource_manager.event_allocations[event_id]
                    for resource in allocated_resources:
                        self.event_tracker.record_resource_allocation(
                            event_id=event_id,
                            resource_table=resource.table,
                            resource_id=resource.id,
                            allocation_time=start_time,
                            release_time=end_time
                        )
                
                # Release resources
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
                
                logger.info(f"Processed event {event_id} (step {step.step_id}) for entity {entity_id} in {duration_minutes/60:.2f} hours")
                
                # Process next steps
                for next_step_id in step.next_steps:
                    self.env.process(self._process_step(entity_id, next_step_id, flow, entity_table, event_table))
                
        except Exception as e:
            logger.error(f"Error processing event step {step.step_id}: {str(e)}", exc_info=True)
        finally:
            process_engine.dispose()

    def _create_event_for_step(self, session, entity_id: int, step: 'Step', entity_table: str, event_table: str):
        """
        Create a new event in the database for a step
        
        Args:
            session: Database session
            entity_id: Entity ID
            step: Event step configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
            
        Returns:
            Event ID of the created event
        """
        try:
            # Find relationship column and event type column
            relationship_columns = self.entity_manager.find_relationship_columns(session, entity_table, event_table)
            if not relationship_columns:
                logger.error(f"No relationship column found between {entity_table} and {event_table}")
                return None
            
            relationship_column = relationship_columns[0]
            event_type_column = self.entity_manager.find_event_type_column(session, event_table)
            if not event_type_column:
                logger.error(f"Could not find event type column in {event_table}")
                return None
            
            # Get the next ID for the new event
            sql_query = text(f"SELECT MAX(id) FROM {event_table}")
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            
            # Prepare data for the new event row
            row_data = {
                "id": next_id,
                relationship_column: entity_id,
                event_type_column: step.event_config.name
            }
            
            # Generate values for other attributes using database config
            event_entity_config = self.entity_manager.get_entity_config(event_table)
            if event_entity_config:
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
            
            # Build INSERT statement dynamically
            columns = ", ".join(row_data.keys())
            placeholders = ", ".join([f":{col}" for col in row_data.keys()])
            sql_query = text(f"INSERT INTO {event_table} ({columns}) VALUES ({placeholders})")

            logger.debug(f"Creating event in {event_table} with data: {row_data}")
            session.execute(sql_query, row_data)
            session.commit()
            
            return next_id
            
        except Exception as e:
            logger.error(f"Error creating event for step {step.step_id}: {str(e)}", exc_info=True)
            return None


