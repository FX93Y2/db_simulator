"""
Entity management for DB Simulator.

This module handles entity creation and management for the simulation.
"""

import logging
import random
from datetime import timedelta
from typing import Dict, List, Tuple, Any, Optional
import dataclasses
from sqlalchemy import create_engine, inspect, text, insert
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from ..config_parser import SimulationConfig, DatabaseConfig
from ..config_parser import Entity as DbEntity
from ..utils.distribution_utils import generate_from_distribution
from ..utils.data_generation import generate_attribute_value

logger = logging.getLogger(__name__)

class EntityManager:
    """
    Manages entities for the event-based simulation.
    
    Handles entity creation, event creation, and relationship management.
    """
    
    def __init__(self, env, engine, db_path, config, db_config, event_tracker):
        """
        Initialize the entity manager
        
        Args:
            env: SimPy environment
            engine: SQLAlchemy engine
            db_path: Path to the SQLite database
            config: Simulation configuration
            db_config: Database configuration
            event_tracker: Event tracker instance
        """
        self.env = env
        self.engine = engine
        self.db_path = db_path
        self.config = config
        self.db_config = db_config
        self.event_tracker = event_tracker
        
        # Dictionary to track the current event type for each entity
        self.entity_current_event_types = {}
        
        # Counter for entities
        self.entity_count = 0
    
    def update_entity_attribute_column(self, entity_id: int, entity_table: str, 
                                     attribute_name: str, value) -> bool:
        """
        Update a specific attribute column in the entity table.
        
        Args:
            entity_id: ID of the entity to update
            entity_table: Name of the entity table
            attribute_name: Name of the attribute column to update
            value: Value to set (string, int, or float)
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            with Session(self.engine) as session:
                # Use parameterized query to prevent SQL injection
                # Note: Column name can't be parameterized, but we validate it's from assign config
                sql_query = text(f"UPDATE {entity_table} SET {attribute_name} = :value WHERE id = :id")
                
                result = session.execute(sql_query, {"value": value, "id": entity_id})
                
                if result.rowcount > 0:
                    session.commit()
                    logger.debug(f"Updated {entity_table}.{attribute_name} = {value} for entity {entity_id}")
                    return True
                else:
                    logger.warning(f"No rows updated for entity {entity_id} in table {entity_table}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error updating attribute column {entity_table}.{attribute_name} for entity {entity_id}: {e}")
            return False
    
    def update_entity_attributes_batch(self, entity_id: int, entity_table: str, 
                                     attributes: Dict[str, Any]) -> bool:
        """
        Update multiple attribute columns for an entity in a single transaction.
        
        Args:
            entity_id: ID of the entity to update
            entity_table: Name of the entity table
            attributes: Dictionary of attribute_name -> value pairs
            
        Returns:
            True if all updates were successful, False otherwise
        """
        if not attributes:
            return True
        
        try:
            with Session(self.engine) as session:
                # Build dynamic SET clause
                set_clauses = []
                params = {"id": entity_id}
                
                for attr_name, attr_value in attributes.items():
                    set_clauses.append(f"{attr_name} = :{attr_name}")
                    params[attr_name] = attr_value
                
                set_clause = ", ".join(set_clauses)
                sql_query = text(f"UPDATE {entity_table} SET {set_clause} WHERE id = :id")
                
                result = session.execute(sql_query, params)
                
                if result.rowcount > 0:
                    session.commit()
                    logger.debug(f"Batch updated {len(attributes)} attributes for entity {entity_id} in {entity_table}")
                    return True
                else:
                    logger.warning(f"No rows updated for entity {entity_id} in table {entity_table}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error batch updating attributes for entity {entity_id} in {entity_table}: {e}")
            return False
    
    def get_entity_config(self, entity_name: str) -> Optional[DbEntity]:
        """Find entity configuration by name."""
        if not self.db_config:
            return None
        for entity in self.db_config.entities:
            if entity.name == entity_name:
                return entity
        return None
    
    def get_table_by_type(self, table_type: str) -> Optional[str]:
        """Find a table with the specified type in the database configuration."""
        if not self.db_config:
            return None
        
        for entity in self.db_config.entities:
            if entity.type == table_type:
                return entity.name
                
        return None
    
    def get_table_names(self):
        """Get entity, event, and resource table names from config or db config."""
        event_sim = self.config.event_simulation
        if not event_sim:
            return None, None, None
            
        # Try to get table names from simulation config
        if event_sim.table_specification:
            entity_table = event_sim.table_specification.entity_table
            event_table = event_sim.table_specification.event_table
            resource_table = event_sim.table_specification.resource_table
        else:
            # Try to derive from database config based on table types
            entity_table = self.get_table_by_type('entity')
            event_table = self.get_table_by_type('event')
            resource_table = self.get_table_by_type('resource')
            
        return entity_table, event_table, resource_table
    
    def pre_generate_entity_arrivals(self) -> List[float]:
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
    
    def process_pre_generated_arrivals(self, arrival_times: List[float], process_entity_events_callback):
        """
        Process pre-generated entity arrivals
        
        Args:
            arrival_times: List of arrival times in simulation minutes
            process_entity_events_callback: Callback function to process entity events
        """
        entity_table, event_table, resource_table = self.get_table_names()
        if not entity_table or not event_table:
            logger.error("Missing entity or event table names. Cannot process entity arrivals.")
            return
        
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
                    entity_id = self.create_entity(session, entity_table)
                    
                    if entity_id:
                        try:
                            # Find the relationship column
                            relationship_columns = self.find_relationship_columns(session, entity_table, event_table)
                            if not relationship_columns:
                                logger.error(f"No relationship column found between {entity_table} and {event_table}")
                                continue
                            
                            relationship_column = relationship_columns[0]
                            logger.debug(f"Using relationship column: {relationship_column}")
                            
                            # Events will be created dynamically by the event flows architecture
                            event_ids = []  # No initial events needed for event flows
                            
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
                            self.env.process(process_entity_events_callback(entity_id - 1))  # Adjust for 0-based indexing
                            
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
    
    def generate_entities(self, process_entity_events_callback):
        """
        Generate entities based on arrival pattern and create them in the database
        
        Args:
            process_entity_events_callback: Callback function to process entity events
        """
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.entity_arrival:
            return
            
        entity_table, event_table, resource_table = self.get_table_names()
        if not entity_table or not event_table:
            logger.error("Missing entity or event table names. Cannot generate entities.")
            return
            
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
                    entity_id = self.create_entity(session, entity_table)
                    
                    if entity_id:
                        # Find the relationship column
                        relationship_columns = self.find_relationship_columns(session, entity_table, event_table)
                        if not relationship_columns:
                            logger.error(f"No relationship column found between {entity_table} and {event_table}")
                            return
                        
                        relationship_column = relationship_columns[0]
                        
                        # Events will be created dynamically by the event flows architecture
                        event_ids = []  # No initial events needed for event flows
                        
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
                        self.env.process(process_entity_events_callback(entity_id - 1))  # Adjust for 0-based indexing
                        
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
    
    def find_relationship_columns(self, session, entity_table: str, event_table: str) -> List[str]:
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
    
    def create_entity(self, session, entity_table: str) -> int:
        """
        Create a new entity in the database, populating attributes based on generators.
        
        Args:
            session: SQLAlchemy session
            entity_table: Name of the entity table
            
        Returns:
            ID of the created entity or None on error
        """
        try:
            entity_config = self.get_entity_config(entity_table)
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
    
    
    def find_event_type_column(self, session, event_table: str) -> Optional[str]:
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