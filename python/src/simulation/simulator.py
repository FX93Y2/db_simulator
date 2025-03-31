"""
Simulation engine for DB Simulator.

This module implements the event-based simulation functionality 
using SimPy to model resource allocation and scheduling.
"""

import logging
import simpy
import sqlite3
import random
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any, Optional, Union
import uuid
import math
import random
from collections import defaultdict
import numpy as np
from sqlalchemy import create_engine, inspect, select, func, text, insert
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from ..config_parser import SimulationConfig, EventSimulation, ShiftPattern, ResourceShift
from ..utils.distribution_utils import generate_from_distribution
from .event_tracker import EventTracker

logger = logging.getLogger(__name__)

class EventSimulator:
    """
    Event-based simulator for processing entities through a sequence of events
    
    The simulator uses SimPy to model the discrete event simulation, where:
    - Entities (e.g., Projects, Patients) arrive according to a configured pattern
    - Events (e.g., Deliverables, Treatments) are processed in primary key order
    - Resources (e.g., Consultants, Doctors) are allocated to complete events
    """
    
    def __init__(self, config: SimulationConfig, db_path: str):
        """
        Initialize the simulator
        
        Args:
            config: Simulation configuration
            db_path: Path to the SQLite database
        """
        self.config = config
        self.db_path = db_path
        
        # Use NullPool to avoid connection pool issues with SQLite
        # and enable WAL journal mode for better concurrency
        self.engine = create_engine(
            f"sqlite:///{db_path}?journal_mode=WAL",
            poolclass=NullPool
        )
        
        # Initialize SimPy environment
        self.env = simpy.Environment()
        
        # Initialize resources
        self.resources = {}
        self.resource_types = {}
        
        # Initialize counters
        self.entity_count = 0
        self.processed_events = 0
        
        # Set random seed if provided
        if config.random_seed is not None:
            random.seed(config.random_seed)
            np.random.seed(config.random_seed)
            
        # Initialize event tracker
        self.event_tracker = EventTracker(db_path, config.start_date)
        
        # Dictionary to track the current event type for each entity
        self.entity_current_event_types = {}
    
        # Dictionary to track allocated resources
        self.allocated_resources = {}
    
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
        self._setup_resources()
        
        # Pre-generate entity arrivals
        entity_arrivals = self._pre_generate_entity_arrivals()
        
        # Start entity generation process
        if entity_arrivals:
            self.env.process(self._process_pre_generated_arrivals(entity_arrivals))
        else:
            # Fallback to dynamic generation if pre-generation fails
            self.env.process(self._generate_entities())
        
        # Run simulation for specified duration
        duration_minutes = self.config.duration_days * 24 * 60  # Convert days to minutes
        logger.info(f"Starting simulation for {self.config.duration_days} days")
        self.env.run(until=duration_minutes)
        
        logger.info(f"Simulation completed. Processed {self.processed_events} events for {self.entity_count} entities")
        
        # Return simulation results
        return {
            'duration_days': self.config.duration_days,
            'entity_count': self.entity_count,
            'processed_events': self.processed_events
        }
    
    def _setup_resources(self):
        """Set up resources based on configuration"""
        if not self.config.event_simulation:
            return
            
        event_sim = self.config.event_simulation
        resource_table = event_sim.table_specification.resource_table
        
        # First find the resource_type column
        with Session(self.engine) as session:
            # Get all resources from the database
            # Find the resource_type column first
            inspector = inspect(self.engine)
            columns = inspector.get_columns(resource_table)
            
            # Look for a column with type 'resource_type' or a column named 'role' (default fallback)
            resource_type_column = None
            for column in columns:
                # Check if this is a resource_type column
                table_query = text(f"PRAGMA table_info({resource_table})")
                columns_info = session.execute(table_query).fetchall()
                
                for col_info in columns_info:
                    # SQLite pragmas return column name at index 1
                    if col_info[1] == column['name']:
                        resource_type_column = column['name']
                        break
                
                if resource_type_column:
                    break
                
            # If we still haven't found it, use 'type' or 'role' as fallback
            if not resource_type_column:
                for fallback in ['type', 'role', 'resource_type', 'category']:
                    if fallback in [col['name'] for col in columns]:
                        resource_type_column = fallback
                        break
            
            if not resource_type_column:
                logger.error(f"Could not find resource type column in table {resource_table}")
                return
                
                # Get all resources from the database
            sql_query = text(f"SELECT id, {resource_type_column} FROM {resource_table}")
                result = session.execute(sql_query)
                resources_by_type = {}
                
                for row in result:
                    resource_type = row[1]
                    if resource_type not in resources_by_type:
                        resources_by_type[resource_type] = []
                    resources_by_type[resource_type].append(row[0])
                
            # Create SimPy resources for each resource ID
            for resource_type, resource_ids in resources_by_type.items():
                        for resource_id in resource_ids:
                    resource_key = f"{resource_table}_{resource_id}"
                            self.resources[resource_key] = simpy.Resource(self.env, capacity=1)
                            self.resource_types[resource_key] = resource_type
            
            logger.info(f"Set up {len(self.resources)} resources of {len(resources_by_type)} types")
    
    def _pre_generate_entity_arrivals(self) -> List[float]:
        """
        Pre-generate all entity arrival times at the beginning of the simulation
        
        Returns:
            List of arrival times in simulation minutes
        """
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.entity_arrival:
            return []
            
        arrival_config = event_sim.entity_arrival
        
        # Get the maximum number of entities to generate
        max_entities = arrival_config.max_entities
        if max_entities == 'n/a' or max_entities is None:
            # If max_entities is not specified or set to 'n/a', estimate based on simulation duration and average interarrival time
            try:
                logger.debug(f"Interarrival time config: {arrival_config.interarrival_time}")
            distribution = arrival_config.interarrival_time.get('distribution', {})
                logger.debug(f"Distribution: {distribution}, type: {type(distribution)}")
                
                if isinstance(distribution, dict):
            if distribution.get('type') == 'exponential':
                # For exponential distribution, mean = scale
                avg_interarrival_days = distribution.get('scale', 1)
            elif distribution.get('type') == 'normal':
                avg_interarrival_days = distribution.get('mean', 1)
            elif distribution.get('type') == 'uniform':
                avg_interarrival_days = (distribution.get('min', 0) + distribution.get('max', 2)) / 2
            else:
                        avg_interarrival_days = 1  # Default
                else:
                    logger.warning(f"Distribution is not a dictionary: {distribution}")
                avg_interarrival_days = 1  # Default
                
            # Estimate max entities based on simulation duration and average interarrival time
            max_entities = int(self.config.duration_days / avg_interarrival_days * 1.5)  # Add 50% buffer
                logger.debug(f"Estimated max_entities: {max_entities}")
            except Exception as e:
                logger.error(f"Error estimating max_entities: {e}", exc_info=True)
                max_entities = 20  # Default fallback
            
        # Pre-generate arrival times
        arrival_times = []
        current_time = 0
        
        try:
        for _ in range(max_entities):
            # Generate interarrival time
                try:
                    interarrival_config = arrival_config.interarrival_time
                    logger.debug(f"Interarrival config: {interarrival_config}")
                    interarrival_days = generate_from_distribution(interarrival_config)
            interarrival_minutes = interarrival_days * 24 * 60  # Convert days to minutes
            
            # Add to current time
            current_time += interarrival_minutes
            
            # Stop if we exceed simulation duration
            if current_time > self.config.duration_days * 24 * 60:
                break
                
            # Add to arrival times
            arrival_times.append(current_time)
                except Exception as e:
                    logger.error(f"Error generating interarrival time: {e}", exc_info=True)
                    break
        except Exception as e:
            logger.error(f"Error in entity pre-generation loop: {e}", exc_info=True)
            
        logger.info(f"Pre-generated {len(arrival_times)} entity arrivals")
        return arrival_times
    
    def _process_pre_generated_arrivals(self, arrival_times: List[float]):
        """
        Process pre-generated entity arrivals
        
        Args:
            arrival_times: List of arrival times in simulation minutes
        """
        event_sim = self.config.event_simulation
        if not event_sim:
            return
            
        entity_table = event_sim.table_specification.entity_table
        event_table = event_sim.table_specification.event_table
        
        # Process each arrival time
        for arrival_time in arrival_times:
            # Wait until the arrival time
            yield self.env.timeout(arrival_time - self.env.now)
            
            # Create a process-specific engine for this entity creation
            process_engine = create_engine(
                f"sqlite:///{self.db_path}?journal_mode=WAL",
                poolclass=NullPool,
                connect_args={"check_same_thread": False}
            )
            
            try:
                with Session(process_engine) as session:
                    # Create a new entity in the database
                    entity_id = self._create_entity(session, entity_table)
                    
                    if entity_id:
                        try:
                            # Find the relationship column
                            relationship_columns = self._find_relationship_columns(session, entity_table, event_table)
                            if not relationship_columns:
                                logger.error(f"No relationship column found between {entity_table} and {event_table}")
                                continue
                            
                            relationship_column = relationship_columns[0]
                            logger.debug(f"Using relationship column: {relationship_column}")
                            
                        # Create events for this entity
                        event_ids = self._create_events(session, entity_id, event_table, relationship_column)
                        
                        # Commit the changes
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
                        
                        # Process the entity's events
                        self.env.process(self._process_entity_events(entity_id - 1))  # Adjust for 0-based indexing
                        
                        self.entity_count += 1
                        logger.info(f"Created entity {entity_id} with {len(event_ids)} events at time {self.env.now}")
            except Exception as e:
                            import traceback
                            logger.error(f"Error processing entity: {str(e)}")
                            logger.error(traceback.format_exc())
            except Exception as e:
                import traceback
                logger.error(f"Error creating entity: {str(e)}")
                logger.error(traceback.format_exc())
            finally:
                # Always dispose of the process-specific engine
                process_engine.dispose()
    
    def _generate_entities(self):
        """Generate entities based on arrival pattern and create them in the database"""
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.entity_arrival:
            return
            
        entity_table = event_sim.table_specification.entity_table
        event_table = event_sim.table_specification.event_table
        arrival_config = event_sim.entity_arrival
        
        # Get the maximum number of entities to generate
        max_entities = arrival_config.max_entities
        max_entities_check = max_entities != 'n/a' and max_entities is not None
        
        # Generate entities until max_entities is reached or simulation ends
        while not max_entities_check or self.entity_count < max_entities:
            # Generate interarrival time
            interarrival_minutes = generate_from_distribution(
                arrival_config.interarrival_time.get('distribution', {})
            ) * 24 * 60  # Convert days to minutes
            
            # Wait for the next entity arrival
            yield self.env.timeout(interarrival_minutes)
            
            # Create a process-specific engine for this entity creation
            process_engine = create_engine(
                f"sqlite:///{self.db_path}?journal_mode=WAL",
                poolclass=NullPool,
                connect_args={"check_same_thread": False}
            )
            
            try:
                with Session(process_engine) as session:
                    # Create a new entity in the database
                    entity_id = self._create_entity(session, entity_table)
                    
                    if entity_id:
                        # Find the relationship column
                        relationship_columns = self._find_relationship_columns(session, entity_table, event_table)
                        if not relationship_columns:
                            logger.error(f"No relationship column found between {entity_table} and {event_table}")
                            return
                        
                        relationship_column = relationship_columns[0]
                        
                        # Create events for this entity
                        event_ids = self._create_events(session, entity_id, event_table, relationship_column)
                        
                        # Commit the changes
                        session.commit()
                        
                        # Record entity arrival using a direct connection
                        # This avoids the database locking issue
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
                        
                        # Process the entity's events
                        self.env.process(self._process_entity_events(entity_id - 1))  # Adjust for 0-based indexing
                        
                        self.entity_count += 1
                        logger.info(f"Created entity {entity_id} with {len(event_ids)} events at time {self.env.now}")
                        
                        # Check if we've reached the maximum number of entities
                        if max_entities_check and self.entity_count >= max_entities:
                            break
            except Exception as e:
                logger.error(f"Error creating entity: {str(e)}")
            finally:
                # Always dispose of the process-specific engine
                process_engine.dispose()
    
    def _find_relationship_columns(self, session, entity_table: str, event_table: str) -> List[str]:
        """
        Find foreign key columns in the event table that reference the entity table
        
        Args:
            session: SQLAlchemy session
            entity_table: Name of the entity table
            event_table: Name of the event table
            
        Returns:
            List of foreign key column names
        """
        try:
            # Try to find foreign key relationships using the SQLAlchemy Inspector
            inspector = inspect(session.get_bind())
            relationship_columns = []
            
            try:
                # Get the primary key columns of the entity table
                pk_constraint = inspector.get_pk_constraint(entity_table)
                logger.debug(f"PK constraint for {entity_table}: {pk_constraint}")
                
                # The structure of pk_constraint can vary, handle different formats
                pk_columns = []
                if isinstance(pk_constraint, dict) and 'constrained_columns' in pk_constraint:
                    if isinstance(pk_constraint['constrained_columns'], list):
                        pk_columns = pk_constraint['constrained_columns']
                
                # If we couldn't get primary keys from get_pk_constraint, try another approach
                if not pk_columns:
                    # Get columns and find those marked as primary key
                    columns = inspector.get_columns(entity_table)
                    for col in columns:
                        if col.get('primary_key', False):
                            pk_columns.append(col['name'])
                
                logger.debug(f"Primary key columns for {entity_table}: {pk_columns}")
                
                # If we still don't have primary keys, assume 'id' is the primary key
                if not pk_columns:
                    pk_columns = ['id']
                
                # Get foreign keys in the event table
                fks = inspector.get_foreign_keys(event_table)
                logger.debug(f"Foreign keys for {event_table}: {fks}")
                
                # Find foreign keys that reference the entity table
                for fk in fks:
                    if fk.get('referred_table') == entity_table and fk.get('constrained_columns'):
                        relationship_columns.append(fk['constrained_columns'][0])
            except Exception as e:
                logger.error(f"Error finding relationship using inspector: {str(e)}", exc_info=True)
            
            # If we didn't find a FK, try to look for columns with name pattern
            if not relationship_columns:
                # Try common naming patterns like entity_id, entityId, etc.
                table_name_singular = entity_table.rstrip('s')  # Remove trailing 's' if any
                common_patterns = [
                    f"{entity_table}_id",
                    f"{entity_table}Id",
                    f"{table_name_singular}_id",
                    f"{table_name_singular}Id"
                ]
                
                try:
                    event_columns = [col['name'] for col in inspector.get_columns(event_table)]
                    logger.debug(f"Columns in {event_table}: {event_columns}")
                    
                    for pattern in common_patterns:
                        if pattern in event_columns:
                            relationship_columns.append(pattern)
                            break
                except Exception as e:
                    logger.error(f"Error checking column patterns: {str(e)}", exc_info=True)
            
            # If we still don't have a relationship column, use a fallback approach
            if not relationship_columns:
                logger.warning(f"Could not find relationship column between {entity_table} and {event_table}, using fallback")
                relationship_columns = ['project_id']  # Default fallback for demo_db
            
            return relationship_columns
            
        except Exception as e:
            logger.error(f"Error finding relationship columns: {str(e)}", exc_info=True)
            return ['project_id']  # Default fallback for demo_db
    
    def _create_entity(self, session, entity_table: str) -> int:
        """
        Create a new entity in the database
        
        Args:
            session: SQLAlchemy session
            entity_table: Name of the entity table
            
        Returns:
            ID of the created entity
        """
        try:
            # Get the next ID
            logger.debug(f"Getting next ID for {entity_table}")
            sql_query = text(f"SELECT MAX(id) FROM {entity_table}")
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            logger.debug(f"Next ID: {next_id}")
            
            # Create the entity
            logger.debug(f"Creating entity with ID {next_id}")
            sql_query = text(f"INSERT INTO {entity_table} (id, name) VALUES ({next_id}, 'Project_{next_id}')")
            session.execute(sql_query)
            
            return next_id
        except Exception as e:
            logger.error(f"Error creating entity in {entity_table}: {str(e)}", exc_info=True)
            return None
    
    def _create_events(self, session, entity_id: int, event_table: str, relationship_column: str) -> List[int]:
        """
        Create events for an entity
        
        Args:
            session: SQLAlchemy session
            entity_id: Entity ID
            event_table: Name of the event table
            relationship_column: Name of the column that references the entity
            
        Returns:
            List of created event IDs
        """
        try:
            # Get the next ID
            logger.debug(f"Getting next ID for {event_table}")
            sql_query = text(f"SELECT MAX(id) FROM {event_table}")
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            logger.debug(f"Next ID for event: {next_id}")
            
            event_ids = []
            
            # Check if event sequence is configured
            event_sim = self.config.event_simulation
            logger.debug(f"Event simulation config available: {event_sim is not None}")
            if event_sim and event_sim.event_sequence:
                logger.debug(f"Event sequence available: {event_sim.event_sequence is not None}")
                # Find the initial event type from transitions
                # The first transition's 'from' event is considered the initial event
                if event_sim.event_sequence.transitions:
                    logger.debug(f"Transitions available: {len(event_sim.event_sequence.transitions)}")
                    initial_event_type = event_sim.event_sequence.transitions[0].from_event
                    logger.debug(f"Initial event type: {initial_event_type}")
                    
                    # Find the event type column name (try 'event_type' or 'type')
                    event_type_column = self._find_event_type_column(session, event_table)
                    if not event_type_column:
                        logger.error(f"Could not find event type column in {event_table}")
                        return []
                    
                    logger.debug(f"Using event type column: {event_type_column}")
                
                # Create the initial event
                    sql_query = text(
                        f"INSERT INTO {event_table} (id, {relationship_column}, {event_type_column}, name) "
                        f"VALUES ({next_id}, {entity_id}, '{initial_event_type}', 'Deliverable_{next_id}')"
                    )
                    logger.debug(f"SQL Query: {sql_query}")
                session.execute(sql_query)
                event_ids.append(next_id)
                
                    # Record the current event type for this entity
                self.entity_current_event_types[entity_id] = initial_event_type
            else:
                    logger.debug("No event sequence configured")
            else:
                logger.debug("No event sequence configured")
            
            return event_ids
        except Exception as e:
            logger.error(f"Error creating events for entity {entity_id} in {event_table}: {str(e)}", exc_info=True)
            return []
    
    def _find_event_type_column(self, session, event_table: str) -> str:
        """
        Find the column used for event types in the event table
        
        Args:
            session: SQLAlchemy session
            event_table: Name of the event table
            
        Returns:
            Name of the column used for event types
        """
        try:
            # Common column names for event types
            common_names = ['event_type', 'type', 'event_name', 'status']
            
            # Get all column names for this table
            inspector = inspect(session.get_bind())
            columns = [col['name'] for col in inspector.get_columns(event_table)]
            
            # Try to find a matching column
            for name in common_names:
                if name in columns:
                    return name
                    
            # If no match found, return the first one in our list that makes sense
            return 'type'  # Default fallback
        except Exception as e:
            logger.error(f"Error finding event type column: {str(e)}", exc_info=True)
            return 'type'  # Default fallback
    
    def _create_random_events(self, session, entity_id: int, event_table: str, relationship_column: str, next_id: int, event_ids: List[int]):
        """
        Create random events for an entity (fallback method when event sequence is not configured)
        
        Args:
            session: SQLAlchemy session
            entity_id: Entity ID
            event_table: Name of the event table
            relationship_column: Name of the column that references the entity
            next_id: Starting ID for new events
            event_ids: List to append event IDs to
        """
        # Get possible event types from the database config if available
        event_types = ["Design", "Coding", "Testing"]  # Default fallback
        
        event_sim = self.config.event_simulation
        if event_sim and event_sim.event_sequence and event_sim.event_sequence.event_types:
            # Use event types from the configuration
            event_types = [et.name for et in event_sim.event_sequence.event_types]
        
                # Determine number of events to create (using normal distribution)
                num_events = int(round(random.normalvariate(4, 1)))
                num_events = max(2, min(8, num_events))  # Clamp between 2 and 8
                
                for i in range(num_events):
                    # Choose a random event type
            event_type = random.choice(event_types)
                    
                    # Create the event
                    sql_query = text(f"""
                        INSERT INTO {event_table} (id, {relationship_column}, name, type) 
                        VALUES ({next_id}, {entity_id}, 'Deliverable_{next_id}', '{event_type}')
                    """)
                    session.execute(sql_query)
                    
                    event_ids.append(next_id)
                    next_id += 1
    
    def _process_entity_events(self, entity_id: int):
        """
        Process all events for an entity
        
        Args:
            entity_id: Entity ID (0-based index)
        """
        event_sim = self.config.event_simulation
        if not event_sim:
            yield self.env.timeout(0)  # Make it a generator by yielding
            return
            
        entity_table = event_sim.table_specification.entity_table
        event_table = event_sim.table_specification.event_table
        
        # Create a process-specific engine for isolation
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Find the relationship column
                relationship_columns = self._find_relationship_columns(session, entity_table, event_table)
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
        event_sim = self.config.event_simulation
        if not event_sim:
            return []
            
        required_resources = []
        
        # Create a process-specific engine to avoid connection sharing issues
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Get the event type to determine specific resource requirements
                event_table = event_sim.table_specification.event_table
                sql_query = text(f"SELECT type FROM {event_table} WHERE id = {event_id}")
                result = session.execute(sql_query)
                event_type = None
                for row in result:
                    event_type = row[0]
                    break
                    
                # Check if event sequence has specific resource requirements for this event type
                if event_sim.event_sequence and event_type:
                    
                    # Find the event type definition in the event sequence configuration
                    event_type_def = None
                    for et in event_sim.event_sequence.event_types:
                        if et.name == event_type:
                            event_type_def = et
                            break
                    
                    if event_type_def and event_type_def.resource_requirements:
                        # Use event type-specific resource requirements
                        for req in event_type_def.resource_requirements:
                            resource_table = req.resource_table
                            resource_value = req.value
                            
                            # Determine how many resources of this type are needed
                            count = req.count
                            if isinstance(count, dict) and 'distribution' in count:
                                count = int(round(generate_from_distribution(count['distribution'])))
                            else:
                                count = int(count)
                            
                            # Skip if no resources needed
                            if count <= 0:
                                continue
                            
                            # Get all resources of this type
                            # First get the resource_type column
                            resource_type_column = None
                            inspector = inspect(self.engine)
                            columns = inspector.get_columns(resource_table)
                            
                            # Look for a resource_type column
                            for column in columns:
                                table_query = text(f"PRAGMA table_info({resource_table})")
                                columns_info = session.execute(table_query).fetchall()
                                
                                for col_info in columns_info:
                                    if col_info[1] == column['name']:
                                        resource_type_column = column['name']
                                        break
                                
                                if resource_type_column:
                                    break
                            
                            # If we still haven't found it, use 'type' or 'role' as fallback
                            if not resource_type_column:
                                for fallback in ['type', 'role', 'resource_type', 'category']:
                                    if fallback in [col['name'] for col in columns]:
                                        resource_type_column = fallback
                                        break
                            
                            if not resource_type_column:
                                logger.error(f"Could not find resource type column in table {resource_table}")
                                continue
                            
                            # Get all resources with the matching value
                            sql_query = text(f"""
                                SELECT id FROM {resource_table} 
                                WHERE {resource_type_column} = '{resource_value}'
                            """)
                            result = session.execute(sql_query)
                            matching_resources = [f"{resource_table}_{row[0]}" for row in result]
                            
                            # Add up to count resources of this type
                            added = 0
                            for resource_key in matching_resources:
                                if resource_key in self.resources and added < count:
                                required_resources.append(resource_key)
                                    added += 1
                                    
                            if added < count:
                                logger.warning(f"Only found {added} of {count} required resources of type {resource_value}")
                
                # If no specific requirements, fall back to default
                if not required_resources:
                    # Default to using any available resource
                    resource_table = event_sim.table_specification.resource_table
                    for resource_key in self.resources:
                        if resource_key.startswith(f"{resource_table}_"):
                            required_resources.append(resource_key)
                            break
        except Exception as e:
            logger.error(f"Error determining required resources for event {event_id}: {str(e)}")
        finally:
            process_engine.dispose()
        
        return required_resources
    
    def _are_work_shifts_enabled(self) -> bool:
        """Check if work shifts are enabled in the configuration"""
        # Temporarily disabled for testing
        return False
        
        # Original implementation:
        # event_sim = self.config.event_simulation
        # if not event_sim or not event_sim.work_shifts:
        #     return False
        
        # return event_sim.work_shifts.enabled
    
    def _get_shift_pattern(self, pattern_name: str) -> Optional[ShiftPattern]:
        """Get a shift pattern by name"""
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.work_shifts:
            return None
        
        for pattern in event_sim.work_shifts.shift_patterns:
            if pattern.name == pattern_name:
                return pattern
        
        return None
    
    def _get_resource_shift_patterns(self, resource_type: str) -> List[ShiftPattern]:
        """Get shift patterns for a resource type"""
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.work_shifts:
            return []
        
        patterns = []
        for resource_shift in event_sim.work_shifts.resource_shifts:
            if resource_shift.resource_type == resource_type:
                if isinstance(resource_shift.shift_pattern, list):
                    for pattern_name in resource_shift.shift_pattern:
                        pattern = self._get_shift_pattern(pattern_name)
                        if pattern:
                            patterns.append(pattern)
                else:
                    pattern = self._get_shift_pattern(resource_shift.shift_pattern)
                    if pattern:
                        patterns.append(pattern)
        
        return patterns
    
    def _is_resource_on_shift(self, resource_key: str, sim_time: Optional[float] = None) -> bool:
        """
        Check if a resource is on shift at the given simulation time
        
        Args:
            resource_key: Resource key (e.g., "Consultant_1")
            sim_time: Simulation time in minutes (defaults to current time)
            
        Returns:
            True if the resource is on shift, False otherwise
        """
        if not self._are_work_shifts_enabled():
            return True
        
        if sim_time is None:
            sim_time = self.env.now
        
        # Get the resource type
        resource_type = self.resource_types.get(resource_key)
        if not resource_type:
            return True  # If we don't know the resource type, assume it's always available
        
        # Get the shift patterns for this resource type
        shift_patterns = self._get_resource_shift_patterns(resource_type)
        if not shift_patterns:
            return True  # If no shift patterns are defined, assume the resource is always available
        
        # Convert simulation time to datetime
        sim_datetime = self.config.start_date + timedelta(minutes=sim_time)
        
        # Get day of week (0=Monday, 6=Sunday)
        day_of_week = sim_datetime.weekday()
        
        # Get time of day
        time_of_day = sim_datetime.time()
        
        # Check if the current time falls within any of the shift patterns
        for pattern in shift_patterns:
            # Check if current day is in shift days
            if day_of_week in pattern.days:
                # Parse shift start and end times
                start_time = datetime.strptime(pattern.start_time, "%H:%M").time()
                end_time = datetime.strptime(pattern.end_time, "%H:%M").time()
                
                # Check if current time is within shift hours
                if start_time <= time_of_day < end_time:
                    return True
        
        return False
    
    def _wait_until_resource_available(self, resource_key: str) -> float:
        """
        Calculate the next time when a resource will be available
        
        Args:
            resource_key: Resource key (e.g., "Consultant_1")
            
        Returns:
            Simulation time in minutes when the resource will be available
        """
        if not self._are_work_shifts_enabled():
            return self.env.now
        
        # If the resource is already on shift, return current time
        if self._is_resource_on_shift(resource_key):
            return self.env.now
        
        # Get the resource type
        resource_type = self.resource_types.get(resource_key)
        if not resource_type:
            return self.env.now
        
        # Get the shift patterns for this resource type
        shift_patterns = self._get_resource_shift_patterns(resource_type)
        if not shift_patterns:
            return self.env.now
        
        # Start from current time and check each future minute until we find a time when the resource is on shift
        # This is a simplistic approach; in a real system, we would calculate this more efficiently
        sim_time = self.env.now
        max_minutes_to_check = 7 * 24 * 60  # Check up to one week ahead
        
        for minutes_ahead in range(1, max_minutes_to_check):
            check_time = sim_time + minutes_ahead
            if self._is_resource_on_shift(resource_key, check_time):
                return check_time
        
        # If we couldn't find a time when the resource is on shift, return a far future time
        logger.warning(f"Could not find a future time when resource {resource_key} is on shift")
        return sim_time + max_minutes_to_check
    
    def _calculate_next_shift_change(self, resource_keys: List[str]) -> Optional[float]:
        """
        Calculate the next time when any resource's shift status will change
        
        Args:
            resource_keys: List of resource keys
            
        Returns:
            Simulation time in minutes of the next shift change, or None if no shift changes are expected
        """
        if not self._are_work_shifts_enabled():
            return None
        
        # Get the current shift status for each resource
        current_status = {key: self._is_resource_on_shift(key) for key in resource_keys}
        
        # Start from current time and check each future minute until we find a time when any resource's shift status changes
        sim_time = self.env.now
        max_minutes_to_check = 24 * 60  # Check up to one day ahead
        
        for minutes_ahead in range(1, max_minutes_to_check):
            check_time = sim_time + minutes_ahead
            for key in resource_keys:
                new_status = self._is_resource_on_shift(key, check_time)
                if new_status != current_status[key]:
                    return check_time
        
        # If we couldn't find a shift change, return None
        return None
    
    def _calculate_next_available_time(self, resource_keys: List[str]) -> float:
        """
        Calculate the next time when all resources will be available
        
        Args:
            resource_keys: List of resource keys
            
        Returns:
            Simulation time in minutes when all resources will be available
        """
        if not self._are_work_shifts_enabled():
            return self.env.now
        
        # Find the latest time when any resource becomes available
        latest_time = self.env.now
        
        for key in resource_keys:
            available_time = self._wait_until_resource_available(key)
            if available_time > latest_time:
                latest_time = available_time
        
        return latest_time
    
    def _get_event_duration(self, event_type: str) -> float:
        """
        Get the duration for an event type from the event sequence configuration
        
        Args:
            event_type: Event type
            
        Returns:
            Duration in minutes
        """
        event_sim = self.config.event_simulation
        if not event_sim:
            return 0
        
        # Check if event sequence is configured and has a specific duration for this event type
        if event_sim.event_sequence and event_type:
            # Find the event type definition in the event sequence configuration
            for et in event_sim.event_sequence.event_types:
                if et.name == event_type:
                    # Use event type-specific duration
                    duration_days = generate_from_distribution(et.duration.get('distribution', {}))
                    return duration_days * 24 * 60  # Convert days to minutes
        
        # Fall back to default values if specific duration not found
        # This is a fallback for backward compatibility or if event type not found
        default_duration_days = 3  # Default to 3 days if no duration found
        return default_duration_days * 24 * 60  # Convert days to minutes

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
            if not event_sim or not event_sim.event_sequence or not event_sim.event_sequence.transitions:
            return None
        
            # Find the transition for this event type
        for transition in event_sim.event_sequence.transitions:
            if transition.from_event == current_event_type:
                    # Found the transition, determine the next event type based on probabilities
                    if not transition.to_events:
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
        try:
            # Create a process-specific engine for isolation
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
            with Session(process_engine) as session:
                # Get event details
                relationship_columns = self._find_relationship_columns(session, entity_table, event_table)
                if not relationship_columns:
                    logger.error(f"No relationship column found between {entity_table} and {event_table}")
                    return
                
                relationship_column = relationship_columns[0]
                
                # Find the event type column
                event_type_column = self._find_event_type_column(session, event_table)
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
                self.entity_current_event_types[entity_id] = event_type
                
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
                        logger.error(f"No configuration found for event type {event_type}")
                        return
                    
                    # Get the event duration
                    logger.debug(f"Getting duration for event type {event_type}")
                    duration_days = generate_from_distribution(event_config.duration.get('distribution', {}))
                    duration_minutes = duration_days * 24 * 60  # Convert to minutes
                    
                    # Get resource requirements
                    resource_requirements = event_config.resource_requirements
                    
                    # Allocate resources
                    allocated_resources = []
                    if resource_requirements:
                        for req in resource_requirements:
                            # Find resources matching the requirement
                            resources = self._find_resources(session, req.resource_table, req.value, req.count)
                            allocated_resources.extend(resources)
                    
                    # If we couldn't allocate all resources, wait and retry
                    if len(allocated_resources) < sum(req.count for req in resource_requirements):
                        logger.debug(f"Not enough resources available for event {event_id}, waiting...")
                        yield self.env.timeout(60)  # Wait one hour
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
                    for resource in allocated_resources:
                        resource_id, resource_table = resource
                        # Record in the event tracker
                        self.event_tracker.record_resource_allocation(
                                event_id=event_id,
                            resource_table=resource_table,
                            resource_id=resource_id,
                            allocation_time=start_time,
                            release_time=end_time
                        )
                    
                    # Release resources
                    for resource in allocated_resources:
                        resource_id, resource_table = resource
                        self._release_resource(resource_table, resource_id)
                    
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
                                    # Get the next ID for the new event
                                    sql_query = text(f"SELECT MAX(id) FROM {event_table}")
                                    result = session.execute(sql_query).fetchone()
                                    next_id = (result[0] or 0) + 1
                                    
                                    # Create the next event
                        sql_query = text(
                            f"INSERT INTO {event_table} (id, {relationship_column}, {event_type_column}, name) "
                            f"VALUES ({next_id}, {entity_id}, '{next_event_type}', 'Deliverable_{next_id}')"
                        )
                                    session.execute(sql_query)
                        
                        # Commit the changes
                                    session.commit()
                                    
                        # Process the new event
                                    logger.info(f"Created next event {next_id} of type {next_event_type} for entity {entity_id}")
                        self.env.process(self._process_event(entity_id, next_id, event_table, entity_table))
                    else:
                        logger.info(f"Entity {entity_id} has completed all events in the sequence")
                else:
                    logger.error("Event sequence not configured, cannot process event")
        except Exception as e:
            logger.error(f"Error processing event {event_id}: {str(e)}", exc_info=True)
        finally:
            # Always dispose of the process-specific engine
            process_engine.dispose()

    def _find_resources(self, session, resource_table: str, resource_type: str, count: int) -> List[Tuple[int, str]]:
        """
        Find available resources matching the given type
        
        Args:
            session: SQLAlchemy session
            resource_table: Name of the resource table
            resource_type: Type of resource to find
            count: Number of resources to allocate
            
        Returns:
            List of tuples (resource_id, resource_table)
        """
        try:
            # Find the resource type column
            resource_type_column = self._find_resource_type_column(session, resource_table)
            if not resource_type_column:
                logger.error(f"Could not find resource type column in {resource_table}")
                return []
                
            logger.debug(f"Using resource type column: {resource_type_column}")
            
            # Get resources of the specified type that aren't already allocated
            resources = []
            
            # Check which resources are already allocated
            allocated_resources = set(self.allocated_resources.keys())
            
            # Query for resources of the specified type
            sql_query = text(f"SELECT id FROM {resource_table} WHERE {resource_type_column} = '{resource_type}'")
            result = session.execute(sql_query).fetchall()
            
            if not result:
                logger.warning(f"No resources found of type {resource_type} in {resource_table}")
                return []
                
            # Filter out already allocated resources
            available_resources = []
            for row in result:
                resource_id = row[0]
                resource_key = f"{resource_table}_{resource_id}"
                if resource_key not in allocated_resources:
                    available_resources.append(resource_id)
                    
            # Check if we have enough resources
            if len(available_resources) < count:
                logger.warning(f"Not enough resources available of type {resource_type}. Needed: {count}, Available: {len(available_resources)}")
                return []
                
            # Allocate the resources
            for i in range(count):
                resource_id = available_resources[i]
                resource_key = f"{resource_table}_{resource_id}"
                self.allocated_resources[resource_key] = resource_type
                resources.append((resource_id, resource_table))
                
            logger.debug(f"Allocated {count} resources of type {resource_type} from {resource_table}")
            return resources
            
                except Exception as e:
            logger.error(f"Error finding resources: {str(e)}", exc_info=True)
            return []
            
    def _release_resource(self, resource_table: str, resource_id: int):
        """
        Release an allocated resource
        
        Args:
            resource_table: Name of the resource table
            resource_id: ID of the resource to release
        """
        try:
            resource_key = f"{resource_table}_{resource_id}"
            if resource_key in self.allocated_resources:
                del self.allocated_resources[resource_key]
                logger.debug(f"Released resource {resource_key}")
            else:
                logger.warning(f"Attempted to release resource {resource_key} that wasn't allocated")
            except Exception as e:
            logger.error(f"Error releasing resource: {str(e)}", exc_info=True)
            
    def _find_resource_type_column(self, session, resource_table: str) -> str:
        """
        Find the column used for resource types in the resource table
        
        Args:
            session: SQLAlchemy session
            resource_table: Name of the resource table
            
        Returns:
            Name of the column used for resource types
        """
        try:
            # Common column names for resource types
            common_names = ['role', 'type', 'resource_type', 'category']
            
            # Get all column names for this table
            inspector = inspect(session.get_bind())
            columns = [col['name'] for col in inspector.get_columns(resource_table)]
            
            # Try to find a matching column
            for name in common_names:
                if name in columns:
                    return name
                    
            # If no match found, return the first one in our list that makes sense
            return 'role'  # Default fallback
        except Exception as e:
            logger.error(f"Error finding resource type column: {str(e)}", exc_info=True)
            return 'role'  # Default fallback