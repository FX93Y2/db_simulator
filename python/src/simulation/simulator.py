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

from python.src.config_parser import SimulationConfig, EventSimulation, ShiftPattern, ResourceShift
from python.src.utils.distribution_utils import generate_from_distribution
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
            
        with Session(self.engine) as session:
            for resource_config in self.config.event_simulation.resource_requirements:
                table_name = resource_config.resource_table
                type_column = resource_config.type_column
                
                # Get all resources from the database
                sql_query = text(f"SELECT id, {type_column} FROM {table_name}")
                result = session.execute(sql_query)
                resources_by_type = {}
                
                for row in result:
                    resource_type = row[1]
                    if resource_type not in resources_by_type:
                        resources_by_type[resource_type] = []
                    resources_by_type[resource_type].append(row[0])
                
                # Create SimPy resources for each type
                for req in resource_config.requirements:
                    resource_type = req.resource_type
                    if resource_type in resources_by_type:
                        resource_ids = resources_by_type[resource_type]
                        # Create a resource pool for each resource ID
                        for resource_id in resource_ids:
                            resource_key = f"{table_name}_{resource_id}"
                            self.resources[resource_key] = simpy.Resource(self.env, capacity=1)
                            self.resource_types[resource_key] = resource_type
    
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
        if max_entities is None:
            # If max_entities is not specified, estimate based on simulation duration and average interarrival time
            distribution = arrival_config.interarrival_time.get('distribution', {})
            if distribution.get('type') == 'exponential':
                # For exponential distribution, mean = scale
                avg_interarrival_days = distribution.get('scale', 1)
            elif distribution.get('type') == 'normal':
                avg_interarrival_days = distribution.get('mean', 1)
            elif distribution.get('type') == 'uniform':
                avg_interarrival_days = (distribution.get('min', 0) + distribution.get('max', 2)) / 2
            else:
                avg_interarrival_days = 1  # Default
                
            # Estimate max entities based on simulation duration and average interarrival time
            max_entities = int(self.config.duration_days / avg_interarrival_days * 1.5)  # Add 50% buffer
            
        # Pre-generate arrival times
        arrival_times = []
        current_time = 0
        
        for _ in range(max_entities):
            # Generate interarrival time
            interarrival_days = generate_from_distribution(
                arrival_config.interarrival_time.get('distribution', {})
            )
            interarrival_minutes = interarrival_days * 24 * 60  # Convert days to minutes
            
            # Add to current time
            current_time += interarrival_minutes
            
            # Stop if we exceed simulation duration
            if current_time > self.config.duration_days * 24 * 60:
                break
                
            # Add to arrival times
            arrival_times.append(current_time)
            
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
            
        entity_table = event_sim.entity_table
        event_table = event_sim.event_table
        relationship_column = event_sim.relationship_column
        
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
                logger.error(f"Error creating entity: {str(e)}")
            finally:
                # Always dispose of the process-specific engine
                process_engine.dispose()
    
    def _generate_entities(self):
        """Generate entities based on arrival pattern and create them in the database"""
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.entity_arrival:
            return
            
        entity_table = event_sim.entity_table
        event_table = event_sim.event_table
        relationship_column = event_sim.relationship_column
        arrival_config = event_sim.entity_arrival
        
        # Get the maximum number of entities to generate
        max_entities = arrival_config.max_entities
        
        # Generate entities until max_entities is reached or simulation ends
        while max_entities is None or self.entity_count < max_entities:
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
            except Exception as e:
                logger.error(f"Error creating entity: {str(e)}")
            finally:
                # Always dispose of the process-specific engine
                process_engine.dispose()
    
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
            sql_query = text(f"SELECT MAX(id) FROM {entity_table}")
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            
            # Create the entity
            sql_query = text(f"INSERT INTO {entity_table} (id, name) VALUES ({next_id}, 'Project_{next_id}')")
            session.execute(sql_query)
            
            return next_id
        except Exception as e:
            logger.error(f"Error creating entity in {entity_table}: {str(e)}")
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
            sql_query = text(f"SELECT MAX(id) FROM {event_table}")
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            
            event_ids = []
            
            # Check if event sequence is enabled
            event_sim = self.config.event_simulation
            if event_sim and event_sim.event_sequence and event_sim.event_sequence.enabled:
                # Create only the initial event from the event sequence
                initial_event_type = event_sim.event_sequence.initial_event
                
                # Create the initial event
                sql_query = text(f"""
                    INSERT INTO {event_table} (id, {relationship_column}, name, type) 
                    VALUES ({next_id}, {entity_id}, 'Deliverable_{next_id}', '{initial_event_type}')
                """)
                session.execute(sql_query)
                
                event_ids.append(next_id)
                
                # Store the entity's current event type in a dictionary for later use
                self.entity_current_event_types[entity_id] = initial_event_type
                
                logger.info(f"Created initial event {next_id} of type {initial_event_type} for entity {entity_id}")
            else:
                # Original implementation for backward compatibility
                # Determine number of events to create (using normal distribution)
                num_events = int(round(random.normalvariate(4, 1)))
                num_events = max(2, min(8, num_events))  # Clamp between 2 and 8
                
                for i in range(num_events):
                    # Choose a random event type
                    event_type = random.choice(["Design", "Coding", "Testing"])
                    
                    # Create the event
                    sql_query = text(f"""
                        INSERT INTO {event_table} (id, {relationship_column}, name, type) 
                        VALUES ({next_id}, {entity_id}, 'Deliverable_{next_id}', '{event_type}')
                    """)
                    session.execute(sql_query)
                    
                    event_ids.append(next_id)
                    next_id += 1
            
            return event_ids
        except Exception as e:
            logger.error(f"Error creating events for entity {entity_id}: {str(e)}")
            return []
    
    def _process_entity_events(self, entity_id: int):
        """
        Process all events for an entity in primary key order
        
        Args:
            entity_id: Entity ID
        """
        event_sim = self.config.event_simulation
        if not event_sim:
            return
            
        entity_table = event_sim.entity_table
        event_table = event_sim.event_table
        relationship_column = event_sim.relationship_column
        
        # Create a new engine for this process to avoid connection sharing issues
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Get all events for this entity, ordered by primary key
                sql_query = text(f"""
                    SELECT id FROM {event_table} 
                    WHERE {relationship_column} = {entity_id + 1}
                    ORDER BY id
                """)
                result = session.execute(sql_query)
                event_ids = [row[0] for row in result]
        except Exception as e:
            logging.error(f"Error fetching events for entity {entity_id}: {str(e)}")
            process_engine.dispose()
            return
        
        # First, try to process events that can be processed immediately
        processed_events = set()
        
        # First pass: Try to process events that can be processed immediately
        for event_id in event_ids:
            try:
                # Skip if already processed
                if event_id in processed_events:
                    continue
                    
                # Get the event type
                with Session(process_engine) as session:
                    sql_query = text(f"SELECT type FROM {event_table} WHERE id = {event_id}")
                    result = session.execute(sql_query).fetchone()
                    event_type = result[0] if result else None
                    
                    # Update the entity's current event type
                    if event_type:
                        self.entity_current_event_types[entity_id] = event_type
                
                # Get event duration based on event type
                duration_minutes = self._get_event_duration(event_type)
                
                # Record event start time
                event_start_time = self.env.now
                
                # Determine required resources for this event
                required_resources = self._determine_required_resources(event_id)
                
                if not required_resources:
                    continue
                
                # Check if all required resources are currently available and on shift
                all_resources_available = True
                for resource_key in required_resources:
                    resource = self.resources.get(resource_key)
                    if not resource or resource.count == 0 or not self._is_resource_on_shift(resource_key):
                        all_resources_available = False
                        break
                
                # If not all resources are available, skip this event for now
                if not all_resources_available:
                    continue
                
                # All resources are available, process the event
                resource_requests = {}
                
                # Request all required resources
                for resource_key in required_resources:
                    resource = self.resources.get(resource_key)
                    if resource:
                        resource_requests[resource_key] = resource.request()
                        yield resource_requests[resource_key]
                
                # All resources acquired, process the event
                processing_start_time = self.env.now
                
                # Process the event (simulate work being done)
                remaining_duration = duration_minutes
                
                while remaining_duration > 0:
                    # Check if any resources will go off shift during processing
                    if self._are_work_shifts_enabled():
                        next_shift_change = self._calculate_next_shift_change(required_resources)
                        
                        if next_shift_change is not None and next_shift_change < self.env.now + remaining_duration:
                            # Process until shift change
                            time_until_shift_change = next_shift_change - self.env.now
                            yield self.env.timeout(time_until_shift_change)
                            remaining_duration -= time_until_shift_change
                            
                            # Release all resources
                            for resource_key, request in resource_requests.items():
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource.release(request)
                            
                            # Wait until all resources are available again
                            next_available_time = self._calculate_next_available_time(required_resources)
                            yield self.env.timeout(next_available_time - self.env.now)
                            
                            # Re-request all resources
                            resource_requests = {}
                            for resource_key in required_resources:
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource_requests[resource_key] = resource.request()
                                    yield resource_requests[resource_key]
                        else:
                            # Process the remaining duration
                            yield self.env.timeout(remaining_duration)
                            remaining_duration = 0
                    else:
                        # Process the remaining duration
                        yield self.env.timeout(remaining_duration)
                        remaining_duration = 0
                
                # Record event completion
                event_end_time = self.env.now
                
                # Release all resources
                for resource_key, request in resource_requests.items():
                    resource = self.resources.get(resource_key)
                    if resource:
                        resource.release(request)
                
                # Record event processing in the database
                try:
                    with Session(process_engine) as session:
                        # Get the entity ID from the database (primary key)
                        sql_query = text(f"""
                            SELECT id FROM {entity_table} 
                            WHERE id = {entity_id + 1}
                        """)
                        result = session.execute(sql_query).fetchone()
                        db_entity_id = result[0] if result else None
                        
                        if db_entity_id:
                            # Record event processing
                            self.event_tracker.record_event_processing(
                                event_table=event_table,
                                event_id=event_id,
                                entity_id=db_entity_id,
                                start_time=event_start_time,
                                end_time=event_end_time
                            )
                            
                            # Record resource allocations
                            for resource_key in required_resources:
                                resource_parts = resource_key.split('_')
                                resource_table = resource_parts[0]
                                resource_id = int(resource_parts[1])
                                
                                self.event_tracker.record_resource_allocation(
                                    event_id=event_id,
                                    resource_table=resource_table,
                                    resource_id=resource_id,
                                    allocation_time=processing_start_time,
                                    release_time=event_end_time
                                )
                            
                            # Mark this event as processed
                            processed_events.add(event_id)
                            
                            # Increment processed events counter
                            self.processed_events += 1
                            
                            logger.info(f"Processed event {event_id} for entity {entity_id} at time {self.env.now}")
                            
                            # Check if event sequence is enabled and create the next event in the sequence
                            if (event_sim.event_sequence and 
                                event_sim.event_sequence.enabled and 
                                event_type in self.entity_current_event_types.get(entity_id, "")):
                                
                                # Determine the next event type based on transitions
                                next_event_type = self._get_next_event_type(event_type)
                                
                                if next_event_type:
                                    # Get the next ID for the new event
                                    sql_query = text(f"SELECT MAX(id) FROM {event_table}")
                                    result = session.execute(sql_query).fetchone()
                                    next_id = (result[0] or 0) + 1
                                    
                                    # Create the next event
                                    sql_query = text(f"""
                                        INSERT INTO {event_table} (id, {relationship_column}, name, type) 
                                        VALUES ({next_id}, {db_entity_id}, 'Deliverable_{next_id}', '{next_event_type}')
                                    """)
                                    session.execute(sql_query)
                                    session.commit()
                                    
                                    # Update the entity's current event type
                                    self.entity_current_event_types[entity_id] = next_event_type
                                    
                                    logger.info(f"Created next event {next_id} of type {next_event_type} for entity {entity_id}")
                                    
                                    # Process the new event
                                    self.env.process(self._process_event(entity_id, next_id))
                except Exception as e:
                    logging.error(f"Error recording event {event_id} for entity {entity_id}: {str(e)}")
            except Exception as e:
                logging.error(f"Error processing event {event_id} for entity {entity_id}: {str(e)}")
        
        # Second pass: Process remaining events with waiting
        for event_id in event_ids:
            try:
                # Skip if already processed
                if event_id in processed_events:
                    continue
                    
                # Get the event type
                with Session(process_engine) as session:
                    sql_query = text(f"SELECT type FROM {event_table} WHERE id = {event_id}")
                    result = session.execute(sql_query).fetchone()
                    event_type = result[0] if result else None
                    
                    # Update the entity's current event type
                    if event_type:
                        self.entity_current_event_types[entity_id] = event_type
                
                # Get event duration based on event type
                duration_minutes = self._get_event_duration(event_type)
                
                # Record event start time
                event_start_time = self.env.now
                
                # Allocate resources for this event
                required_resources = self._determine_required_resources(event_id)
                
                if not required_resources:
                    continue
                    
                # Create a dictionary to store resource requests
                resource_requests = {}
                
                # Request all required resources
                for resource_key in required_resources:
                    resource = self.resources.get(resource_key)
                    if resource:
                        # Check if resource is on shift
                        if self._are_work_shifts_enabled():
                            # Calculate the next time when the resource will be available
                            next_available_time = self._wait_until_resource_available(resource_key)
                            
                            # If resource is not currently on shift, yield until they are
                            if next_available_time > self.env.now:
                                yield self.env.timeout(next_available_time - self.env.now)
                        
                        # Request the resource
                        resource_requests[resource_key] = resource.request()
                        yield resource_requests[resource_key]
                
                # All resources acquired, process the event
                processing_start_time = self.env.now
                
                # Check if any resources went off shift during acquisition
                if self._are_work_shifts_enabled():
                    # Calculate the next time when all resources will be available
                    next_available_time = self._calculate_next_available_time(required_resources)
                    
                    # If any resource is not on shift, yield until they are
                    if next_available_time > self.env.now:
                        # Release all resources
                        for resource_key, request in resource_requests.items():
                            resource = self.resources.get(resource_key)
                            if resource:
                                resource.release(request)
                        
                        # Wait until all resources are available
                        yield self.env.timeout(next_available_time - self.env.now)
                        
                        # Re-request all resources
                        resource_requests = {}
                        for resource_key in required_resources:
                            resource = self.resources.get(resource_key)
                            if resource:
                                resource_requests[resource_key] = resource.request()
                                yield resource_requests[resource_key]
                
                # Process the event (simulate work being done)
                remaining_duration = duration_minutes
                
                while remaining_duration > 0:
                    # Check if any resources will go off shift during processing
                    if self._are_work_shifts_enabled():
                        next_shift_change = self._calculate_next_shift_change(required_resources)
                        
                        if next_shift_change is not None and next_shift_change < self.env.now + remaining_duration:
                            # Process until shift change
                            time_until_shift_change = next_shift_change - self.env.now
                            yield self.env.timeout(time_until_shift_change)
                            remaining_duration -= time_until_shift_change
                            
                            # Release all resources
                            for resource_key, request in resource_requests.items():
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource.release(request)
                            
                            # Wait until all resources are available again
                            next_available_time = self._calculate_next_available_time(required_resources)
                            yield self.env.timeout(next_available_time - self.env.now)
                            
                            # Re-request all resources
                            resource_requests = {}
                            for resource_key in required_resources:
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource_requests[resource_key] = resource.request()
                                    yield resource_requests[resource_key]
                        else:
                            # Process the remaining duration
                            yield self.env.timeout(remaining_duration)
                            remaining_duration = 0
                    else:
                        # Process the remaining duration
                        yield self.env.timeout(remaining_duration)
                        remaining_duration = 0
                
                # Record event completion
                event_end_time = self.env.now
                
                # Release all resources
                for resource_key, request in resource_requests.items():
                    resource = self.resources.get(resource_key)
                    if resource:
                        resource.release(request)
                
                # Record event processing in the database
                try:
                    with Session(process_engine) as session:
                        # Get the entity ID from the database (primary key)
                        sql_query = text(f"""
                            SELECT id FROM {entity_table} 
                            WHERE id = {entity_id + 1}
                        """)
                        result = session.execute(sql_query).fetchone()
                        db_entity_id = result[0] if result else None
                        
                        if db_entity_id:
                            # Record event processing
                            self.event_tracker.record_event_processing(
                                event_table=event_table,
                                event_id=event_id,
                                entity_id=db_entity_id,
                                start_time=event_start_time,
                                end_time=event_end_time
                            )
                            
                            # Record resource allocations
                            for resource_key in required_resources:
                                resource_parts = resource_key.split('_')
                                resource_table = resource_parts[0]
                                resource_id = int(resource_parts[1])
                                
                                self.event_tracker.record_resource_allocation(
                                    event_id=event_id,
                                    resource_table=resource_table,
                                    resource_id=resource_id,
                                    allocation_time=processing_start_time,
                                    release_time=event_end_time
                                )
                            
                            # Increment processed events counter
                            self.processed_events += 1
                            
                            logger.info(f"Processed event {event_id} for entity {entity_id} at time {self.env.now}")
                            
                            # Check if event sequence is enabled and create the next event in the sequence
                            if (event_sim.event_sequence and 
                                event_sim.event_sequence.enabled and 
                                event_type in self.entity_current_event_types.get(entity_id, "")):
                                
                                # Determine the next event type based on transitions
                                next_event_type = self._get_next_event_type(event_type)
                                
                                if next_event_type:
                                    # Get the next ID for the new event
                                    sql_query = text(f"SELECT MAX(id) FROM {event_table}")
                                    result = session.execute(sql_query).fetchone()
                                    next_id = (result[0] or 0) + 1
                                    
                                    # Create the next event
                                    sql_query = text(f"""
                                        INSERT INTO {event_table} (id, {relationship_column}, name, type) 
                                        VALUES ({next_id}, {db_entity_id}, 'Deliverable_{next_id}', '{next_event_type}')
                                    """)
                                    session.execute(sql_query)
                                    session.commit()
                                    
                                    # Update the entity's current event type
                                    self.entity_current_event_types[entity_id] = next_event_type
                                    
                                    logger.info(f"Created next event {next_id} of type {next_event_type} for entity {entity_id}")
                                    
                                    # Process the new event
                                    self.env.process(self._process_event(entity_id, next_id))
                except Exception as e:
                    logging.error(f"Error recording event {event_id} for entity {entity_id}: {str(e)}")
            except Exception as e:
                logging.error(f"Error processing event {event_id} for entity {entity_id}: {str(e)}")
        
        # Dispose of the process-specific engine
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
                event_table = event_sim.event_table
                sql_query = text(f"SELECT type FROM {event_table} WHERE id = {event_id}")
                result = session.execute(sql_query)
                event_type = None
                for row in result:
                    event_type = row[0]
                    break
                    
                # Check if event sequence is enabled and has specific resource requirements for this event type
                if (event_sim.event_sequence and 
                    event_sim.event_sequence.enabled and 
                    event_type):
                    
                    # Find the event type definition in the event sequence configuration
                    event_type_def = None
                    for et in event_sim.event_sequence.event_types:
                        if et.name == event_type:
                            event_type_def = et
                            break
                    
                    if event_type_def and event_type_def.resource_requirements:
                        # Use event type-specific resource requirements
                        for req in event_type_def.resource_requirements:
                            resource_type = req.resource_type
                            
                            # Determine how many resources of this type are needed
                            count = req.count
                            if isinstance(count, dict) and 'distribution' in count:
                                count = int(round(generate_from_distribution(count['distribution'])))
                            else:
                                count = int(count)
                            
                            # Skip if no resources needed
                            if count <= 0:
                                continue
                            
                            # Find the resource table for this resource type
                            resource_table = None
                            type_column = None
                            for resource_req in event_sim.resource_requirements:
                                for r in resource_req.requirements:
                                    if r.resource_type == resource_type:
                                        resource_table = resource_req.resource_table
                                        type_column = resource_req.type_column
                                        break
                                if resource_table:
                                    break
                            
                            if not resource_table or not type_column:
                                logger.warning(f"Could not find resource table for resource type {resource_type}")
                                continue
                            
                            # Get available resources of this type
                            sql_query = text(f"""
                                SELECT id FROM {resource_table} 
                                WHERE {type_column} = '{resource_type}'
                                ORDER BY id
                            """)
                            result = session.execute(sql_query)
                            resource_ids = [row[0] for row in result]
                            
                            # Add required resources
                            for i in range(min(count, len(resource_ids))):
                                resource_key = f"{resource_table}_{resource_ids[i]}"
                                required_resources.append(resource_key)
                        
                        logger.info(f"Using event type-specific resource requirements for event {event_id} of type {event_type}")
                        return required_resources
                
                # Fall back to default resource requirements if event sequence is not enabled
                # or if event type-specific requirements are not defined
                for resource_req in event_sim.resource_requirements:
                    resource_table = resource_req.resource_table
                    type_column = resource_req.type_column
                    
                    # Get all resources of this type
                    for req in resource_req.requirements:
                        resource_type = req.resource_type
                        
                        # Determine how many resources of this type are needed
                        count = req.count
                        if isinstance(count, dict) and 'distribution' in count:
                            count = int(round(generate_from_distribution(count['distribution'])))
                        else:
                            count = int(count)
                        
                        # Skip if no resources needed
                        if count <= 0:
                            continue
                        
                        # Get available resources of this type
                        sql_query = text(f"""
                            SELECT id FROM {resource_table} 
                            WHERE {type_column} = '{resource_type}'
                            ORDER BY id
                        """)
                        result = session.execute(sql_query)
                        resource_ids = [row[0] for row in result]
                        
                        # Add required resources
                        for i in range(min(count, len(resource_ids))):
                            resource_key = f"{resource_table}_{resource_ids[i]}"
                            required_resources.append(resource_key)
        except Exception as e:
            logging.error(f"Error determining required resources for event {event_id}: {str(e)}")
        finally:
            # Dispose of the process-specific engine
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
        
        # Check if event sequence is enabled and has a specific duration for this event type
        if (event_sim.event_sequence and 
            event_sim.event_sequence.enabled and 
            event_type):
            
            # Find the event type definition in the event sequence configuration
            for et in event_sim.event_sequence.event_types:
                if et.name == event_type:
                    # Use event type-specific duration
                    duration_days = generate_from_distribution(et.duration.get('distribution', {}))
                    return duration_days * 24 * 60  # Convert days to minutes
        
        # Fall back to default duration if event sequence is not enabled
        # or if event type-specific duration is not defined
        duration_days = generate_from_distribution(event_sim.event_duration.get('distribution', {}))
        return duration_days * 24 * 60  # Convert days to minutes

    def _get_next_event_type(self, current_event_type: str) -> Optional[str]:
        """
        Determine the next event type based on the event sequence transitions
        
        Args:
            current_event_type: Current event type
            
        Returns:
            Next event type, or None if there are no transitions
        """
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.event_sequence or not event_sim.event_sequence.enabled:
            return None
        
        # Find the transition for the current event type
        for transition in event_sim.event_sequence.transitions:
            if transition.from_event == current_event_type:
                # Get the possible next event types and their probabilities
                next_events = transition.to_events
                
                if not next_events:
                    return None
                
                # If there's only one possible next event, return it
                if len(next_events) == 1:
                    return next_events[0].event_type
                
                # Otherwise, use probabilistic selection
                # First, normalize probabilities if they don't sum to 1
                total_prob = sum(event.probability for event in next_events)
                if total_prob <= 0:
                    return None
                
                # Generate a random number between 0 and the total probability
                r = random.random() * total_prob
                
                # Select the next event type based on the random number
                cumulative_prob = 0
                for event in next_events:
                    cumulative_prob += event.probability
                    if r <= cumulative_prob:
                        return event.event_type
        
        # No transition found for the current event type
        return None

    def _process_event(self, entity_id: int, event_id: int):
        """
        Process a single event
        
        Args:
            entity_id: Entity ID
            event_id: Event ID
        """
        event_sim = self.config.event_simulation
        if not event_sim:
            return
        
        entity_table = event_sim.entity_table
        event_table = event_sim.event_table
        relationship_column = event_sim.relationship_column
        
        # Create a process-specific engine to avoid connection sharing issues
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            # Get the event type
            with Session(process_engine) as session:
                sql_query = text(f"SELECT type FROM {event_table} WHERE id = {event_id}")
                result = session.execute(sql_query).fetchone()
                event_type = result[0] if result else None
                
                # Update the entity's current event type
                if event_type:
                    self.entity_current_event_types[entity_id] = event_type
            
            # Get event duration based on event type
            duration_minutes = self._get_event_duration(event_type)
            
            # Record event start time
            event_start_time = self.env.now
            
            # Determine required resources for this event
            required_resources = self._determine_required_resources(event_id)
            
            if not required_resources:
                return
            
            # Create a dictionary to store resource requests
            resource_requests = {}
            
            try:
                # Request all required resources
                for resource_key in required_resources:
                    resource = self.resources.get(resource_key)
                    if resource:
                        # Check if resource is on shift
                        if self._are_work_shifts_enabled():
                            # Calculate the next time when the resource will be available
                            next_available_time = self._wait_until_resource_available(resource_key)
                            
                            # If resource is not currently on shift, yield until they are
                            if next_available_time > self.env.now:
                                yield self.env.timeout(next_available_time - self.env.now)
                        
                        # Request the resource
                        resource_requests[resource_key] = resource.request()
                        yield resource_requests[resource_key]
                
                # All resources acquired, process the event
                processing_start_time = self.env.now
                
                # Check if any resources went off shift during acquisition
                if self._are_work_shifts_enabled():
                    # Calculate the next time when all resources will be available
                    next_available_time = self._calculate_next_available_time(required_resources)
                    
                    # If any resource is not on shift, yield until they are
                    if next_available_time > self.env.now:
                        # Release all resources
                        for resource_key, request in resource_requests.items():
                            resource = self.resources.get(resource_key)
                            if resource:
                                resource.release(request)
                        
                        # Wait until all resources are available
                        yield self.env.timeout(next_available_time - self.env.now)
                        
                        # Re-request all resources
                        resource_requests = {}
                        for resource_key in required_resources:
                            resource = self.resources.get(resource_key)
                            if resource:
                                resource_requests[resource_key] = resource.request()
                                yield resource_requests[resource_key]
                
                # Process the event (simulate work being done)
                remaining_duration = duration_minutes
                
                while remaining_duration > 0:
                    # Check if any resources will go off shift during processing
                    if self._are_work_shifts_enabled():
                        next_shift_change = self._calculate_next_shift_change(required_resources)
                        
                        if next_shift_change is not None and next_shift_change < self.env.now + remaining_duration:
                            # Process until shift change
                            time_until_shift_change = next_shift_change - self.env.now
                            yield self.env.timeout(time_until_shift_change)
                            remaining_duration -= time_until_shift_change
                            
                            # Release all resources
                            for resource_key, request in resource_requests.items():
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource.release(request)
                            
                            # Wait until all resources are available again
                            next_available_time = self._calculate_next_available_time(required_resources)
                            yield self.env.timeout(next_available_time - self.env.now)
                            
                            # Re-request all resources
                            resource_requests = {}
                            for resource_key in required_resources:
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource_requests[resource_key] = resource.request()
                                    yield resource_requests[resource_key]
                        else:
                            # Process the remaining duration
                            yield self.env.timeout(remaining_duration)
                            remaining_duration = 0
                    else:
                        # Process the remaining duration
                        yield self.env.timeout(remaining_duration)
                        remaining_duration = 0
                
                # Record event completion
                event_end_time = self.env.now
                
                # Release all resources
                for resource_key, request in resource_requests.items():
                    resource = self.resources.get(resource_key)
                    if resource:
                        resource.release(request)
                
                # Record event processing in the database
                try:
                    with Session(process_engine) as session:
                        # Get the entity ID from the database (primary key)
                        sql_query = text(f"""
                            SELECT id FROM {entity_table} 
                            WHERE id = {entity_id + 1}
                        """)
                        result = session.execute(sql_query).fetchone()
                        db_entity_id = result[0] if result else None
                        
                        if db_entity_id:
                            # Record event processing
                            self.event_tracker.record_event_processing(
                                event_table=event_table,
                                event_id=event_id,
                                entity_id=db_entity_id,
                                start_time=event_start_time,
                                end_time=event_end_time
                            )
                            
                            # Record resource allocations
                            for resource_key in required_resources:
                                resource_parts = resource_key.split('_')
                                resource_table = resource_parts[0]
                                resource_id = int(resource_parts[1])
                                
                                self.event_tracker.record_resource_allocation(
                                    event_id=event_id,
                                    resource_table=resource_table,
                                    resource_id=resource_id,
                                    allocation_time=processing_start_time,
                                    release_time=event_end_time
                                )
                            
                            # Increment processed events counter
                            self.processed_events += 1
                            
                            logger.info(f"Processed event {event_id} for entity {entity_id} at time {self.env.now}")
                            
                            # Check if event sequence is enabled and create the next event in the sequence
                            if (event_sim.event_sequence and 
                                event_sim.event_sequence.enabled and 
                                event_type in self.entity_current_event_types.get(entity_id, "")):
                                
                                # Determine the next event type based on transitions
                                next_event_type = self._get_next_event_type(event_type)
                                
                                if next_event_type:
                                    # Get the next ID for the new event
                                    sql_query = text(f"SELECT MAX(id) FROM {event_table}")
                                    result = session.execute(sql_query).fetchone()
                                    next_id = (result[0] or 0) + 1
                                    
                                    # Create the next event
                                    sql_query = text(f"""
                                        INSERT INTO {event_table} (id, {relationship_column}, name, type) 
                                        VALUES ({next_id}, {db_entity_id}, 'Deliverable_{next_id}', '{next_event_type}')
                                    """)
                                    session.execute(sql_query)
                                    session.commit()
                                    
                                    # Update the entity's current event type
                                    self.entity_current_event_types[entity_id] = next_event_type
                                    
                                    logger.info(f"Created next event {next_id} of type {next_event_type} for entity {entity_id}")
                                    
                                    # Process the new event
                                    self.env.process(self._process_event(entity_id, next_id))
                except Exception as e:
                    logging.error(f"Error recording event {event_id} for entity {entity_id}: {str(e)}")
            except Exception as e:
                logging.error(f"Error processing event {event_id} for entity {entity_id}: {str(e)}")
                # Release any acquired resources
                for resource_key, request in resource_requests.items():
                    resource = self.resources.get(resource_key)
                    if resource:
                        try:
                            resource.release(request)
                        except:
                            pass
        except Exception as e:
            logging.error(f"Error setting up event {event_id} for entity {entity_id}: {str(e)}")
        finally:
            # Dispose of the process-specific engine
            process_engine.dispose()