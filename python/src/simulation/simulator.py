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
        self.resource_manager = ResourceManager(self.env, self.engine, self.db_path)
        
        # Initialize counters
        self.entity_count = 0
        self.processed_events = 0
        
        # Set random seed if provided
        if config.random_seed is not None:
            random.seed(config.random_seed)
            np.random.seed(config.random_seed)
            
        # Initialize event tracker - Pass table names from config
        event_table_name = None
        resource_table_name = None
        bridge_table_config = None
        
        if config.event_simulation and config.event_simulation.table_specification:
            spec = config.event_simulation.table_specification
            event_table_name = spec.event_table
            # Assuming single resource table for bridging for now based on demo_sim
            # TODO: Handle multiple resource tables if needed
            resource_table_name = spec.resource_table
            logger.info(f"Passing event_table='{event_table_name}', resource_table='{resource_table_name}' to EventTracker")
        else:
            logger.warning("Event simulation or table specification missing in config. EventTracker may not create bridging table.")
        
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
        self.resource_manager.setup_resources(self.config.event_simulation)
        
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
    
    
    def _get_entity_config(self, entity_name: str) -> Optional[DbEntity]:
        """Find entity configuration by name."""
        if not self.db_config:
            return None
        for entity in self.db_config.entities:
            if entity.name == entity_name:
                return entity
        return None

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
            
            # If we still don't have a relationship column, raise an error or return empty
            if not relationship_columns:
                logger.error(f"Could not automatically determine relationship column between {entity_table} and {event_table}. "
                             f"Ensure a column named like '{entity_table}_id' exists in {event_table}, or configure explicitly.")
                # Depending on desired behavior, either raise an error or return empty list
                # raise ValueError(f"Could not find relationship column for {entity_table} -> {event_table}")
                return [] # Returning empty list for now
            
            return relationship_columns
            
        except Exception as e:
            logger.error(f"Error finding relationship columns: {str(e)}", exc_info=True)
            # raise # Re-raise the exception or return empty list
            return [] # Returning empty list for now
    
    def _create_entity(self, session, entity_table: str) -> int:
        """
        Create a new entity in the database, populating attributes based on generators.
        
        Args:
            session: SQLAlchemy session
            entity_table: Name of the entity table
            
        Returns:
            ID of the created entity or None on error
        """
        try:
            entity_config = self._get_entity_config(entity_table)
            if not entity_config:
                logger.error(f"Database configuration not found for entity: {entity_table}")
                return None

            # Get the next ID
            sql_query = text(f"SELECT MAX(id) FROM {entity_table}")
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            
            row_data = {"id": next_id}
            
            # Generate values for other attributes
            for attr in entity_config.attributes:
                if attr.is_primary_key:
                    continue # Skip primary key
                
                # Handle foreign key generator specifically
                if attr.generator and attr.generator.type == "foreign_key":
                    if not attr.ref:
                        logger.error(f"Foreign key attribute '{attr.name}' in table '{entity_table}' missing 'ref'. Assigning None.")
                        row_data[attr.name] = None
                    else:
                        ref_table, ref_column = attr.ref.split('.')
                        # Query the parent table for valid IDs
                        sql_query = text(f"SELECT {ref_column} FROM {ref_table}")
                        result = session.execute(sql_query).fetchall()
                        parent_ids = [id[0] for id in result]
                        
                        if not parent_ids:
                            logger.warning(f"No rows in parent table {ref_table}, assigning None to FK '{attr.name}' in '{entity_table}'")
                            row_data[attr.name] = None
                        else:
                            # Use user-defined distribution if present, else random
                            dist = getattr(attr.generator, "distribution", None)
                            if dist and isinstance(dist, dict) and dist.get("type") == "choice" and dist.get("values"):
                                # Weighted choice among parent_ids
                                weights = dist.get("values")
                                if len(weights) == len(parent_ids):
                                    import numpy as np
                                    row_data[attr.name] = np.random.choice(parent_ids, p=weights)
                                else:
                                    logger.warning(f"Distribution weights length does not match number of parent_ids for FK '{attr.name}' in '{entity_table}'. Using uniform random assignment.")
                                    row_data[attr.name] = random.choice(parent_ids)
                            else:
                                # Uniform random assignment if no distribution is provided
                                row_data[attr.name] = random.choice(parent_ids)
                # Handle other generator types
                elif attr.generator:
                     # Convert generator dataclass to dict for the utility function
                    gen_dict = dataclasses.asdict(attr.generator) if attr.generator else None
                    attr_config_dict = {
                        'name': attr.name,
                        'generator': gen_dict
                    }
                    # Use next_id - 1 for 0-based row_index context for generators
                    row_data[attr.name] = generate_attribute_value(attr_config_dict, next_id - 1)
                else:
                    # Handle attributes without generators if necessary (e.g., default NULL or specific value)
                    # For now, let the DB handle defaults or NULL
                    pass
            
            # Build INSERT statement dynamically
            columns = ", ".join(row_data.keys())
            placeholders = ", ".join([f":{col}" for col in row_data.keys()])
            sql_query = text(f"INSERT INTO {entity_table} ({columns}) VALUES ({placeholders})")
            
            logger.debug(f"Creating entity in {entity_table} with data: {row_data}")
            session.execute(sql_query, row_data)
            
            return next_id
        except Exception as e:
            logger.error(f"Error creating entity in {entity_table}: {str(e)}", exc_info=True)
            return None
    
    def _create_events(self, session, entity_id: int, event_table: str, relationship_column: str) -> List[int]:
        """
        Create initial events for an entity based on event sequence, populating attributes.
        
        Args:
            session: SQLAlchemy session
            entity_id: Entity ID
            event_table: Name of the event table
            relationship_column: Name of the column that references the entity
            
        Returns:
            List of created event IDs
        """
        try:
            event_entity_config = self._get_entity_config(event_table)
            if not event_entity_config:
                logger.error(f"Database configuration not found for event entity: {event_table}")
                return []

            # Get the next event ID
            sql_query = text(f"SELECT MAX(id) FROM {event_table}")
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            
            event_ids = []
            
            event_sim = self.config.event_simulation
            if event_sim and event_sim.event_sequence and event_sim.event_sequence.transitions:
                initial_event_type = event_sim.event_sequence.transitions[0].from_event
                event_type_column = self._find_event_type_column(session, event_table)
                
                if not event_type_column:
                    logger.error(f"Could not find event type column in {event_table}")
                    return []

                row_data = {
                    "id": next_id,
                    relationship_column: entity_id,
                    event_type_column: initial_event_type
                }

                # Generate values for other attributes
                for attr in event_entity_config.attributes:
                    # Skip PK, the FK to the entity, and the event type column
                    if attr.is_primary_key or attr.name == relationship_column or attr.name == event_type_column:
                        continue
                    
                    # Handle foreign keys with a foreign_key generator type
                    if attr.is_foreign_key:
                        if attr.generator and attr.generator.type == "foreign_key":
                            if not attr.ref:
                                logger.error(f"Foreign key attribute '{attr.name}' in table '{event_table}' missing 'ref'. Assigning None.")
                                row_data[attr.name] = None
                            else:
                                ref_table, ref_column = attr.ref.split('.')
                                # Query the parent table for valid IDs
                                sql_query = text(f"SELECT {ref_column} FROM {ref_table}")
                                result = session.execute(sql_query).fetchall()
                                parent_ids = [id[0] for id in result]
                                
                                if not parent_ids:
                                    logger.warning(f"No rows in parent table {ref_table}, assigning None to FK '{attr.name}' in '{event_table}'")
                                    row_data[attr.name] = None
                                else:
                                    # Use user-defined distribution if present, else random
                                    dist = getattr(attr.generator, "distribution", None)
                                    if dist and isinstance(dist, dict) and dist.get("type") == "choice" and dist.get("values"):
                                        # Weighted choice among parent_ids
                                        weights = dist.get("values")
                                        if len(weights) == len(parent_ids):
                                            import numpy as np
                                            row_data[attr.name] = np.random.choice(parent_ids, p=weights)
                                        else:
                                            logger.warning(f"Distribution weights length does not match number of parent_ids for FK '{attr.name}' in '{event_table}'. Using uniform random assignment.")
                                            row_data[attr.name] = random.choice(parent_ids)
                                    else:
                                        # Uniform random assignment if no distribution is provided
                                        row_data[attr.name] = random.choice(parent_ids)
                        else:
                            # Skip foreign keys without a foreign_key generator
                            logger.debug(f"Skipping FK {attr.name} without foreign_key generator during event creation.")
                            continue

                    elif attr.generator:
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
                        # Handle attributes without generators if needed
                        pass

                # Build INSERT statement dynamically
                columns = ", ".join(row_data.keys())
                placeholders = ", ".join([f":{col}" for col in row_data.keys()])
                sql_query = text(f"INSERT INTO {event_table} ({columns}) VALUES ({placeholders})")

                logger.debug(f"Creating initial event in {event_table} with data: {row_data}")
                session.execute(sql_query, row_data)
                event_ids.append(next_id)
                
                # Record the current event type for this entity
                self.entity_current_event_types[entity_id] = initial_event_type
            else:
                logger.warning("No event sequence configured, cannot create initial event.")
            
            return event_ids
        except Exception as e:
            logger.error(f"Error creating events for entity {entity_id} in {event_table}: {str(e)}", exc_info=True)
            return []
    
    def _find_event_type_column(self, session, event_table: str) -> Optional[str]:
        """ Find the column used for event types in the event table (handle potential errors) """
        try:
            # Common column names for event types
            common_names = ['event_type', 'type', 'event_name', 'status']
            
            # Get all column names for this table
            bind = session.get_bind()
            if not bind:
                 logger.error("No database engine bound to the session.")
                 return 'type' # Fallback

            inspector = inspect(bind)
            columns = [col['name'] for col in inspector.get_columns(event_table)]
            
            # Try to find a matching column
            for name in common_names:
                if name in columns:
                    return name
                    
            # If no match found, return the first one in our list that makes sense
            logger.warning(f"Could not find standard event type column in {event_table}, falling back to 'type'")
            return 'type'  # Default fallback
        except Exception as e:
            logger.error(f"Error finding event type column in {event_table}: {str(e)}", exc_info=True)
            return 'type'  # Default fallback
    # _create_random_events method removed as it's not useful for the current implementation
    

            # Note: Removed the duplicate event creation and commit from the original loop
            # Commit should happen outside the loop, likely after all events for the entity are created

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
        return self.resource_manager.determine_required_resources(event_id, self.config.event_simulation)
    
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
                            resources = self.resource_manager.find_resources(session, req.resource_table, req.value, req.count)
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
                        self.resource_manager.release_resource(resource_table, resource_id)
                    
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
                        event_entity_config = self._get_entity_config(event_table)
                        if not event_entity_config:
                            logger.error(f"Database configuration not found for event entity: {event_table} when creating next event")
                            # Decide how to handle this - maybe stop processing for this entity?
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
                                # Handle attributes without generators if needed (e.g., let DB handle defaults)
                                pass

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
                    logger.debug("No event sequence configured")
        except Exception as e:
            logger.error(f"Error processing event {event_id}: {str(e)}", exc_info=True)
        finally:
            # Always dispose of the process-specific engine
            process_engine.dispose()
