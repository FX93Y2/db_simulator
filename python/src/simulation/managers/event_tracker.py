"""
Event tracker for recording simulation events in the database
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy import create_engine, Table, Column, Integer, String, DateTime, Float, MetaData, insert, text, ForeignKey
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.pool import NullPool
from ..utils.column_resolver import ColumnResolver

logger = logging.getLogger(__name__)

class EventTracker:
    """
    Tracks and records simulation events in the database
    
    This class creates and manages tables for tracking:
    - Event processing
    - Resource allocations
    - A dynamic event-resource bridging table (e.g., Deliverable_Consultant)
    
    Note: Entity arrivals are now tracked via created_at column in entity tables
    """
    
    def __init__(self, db_path: str, start_date: Optional[datetime] = None,
                 resource_table_name: Optional[str] = None,
                 entity_table_name: Optional[str] = None,
                 bridge_table_config: Optional[Dict[str, Any]] = None,
                 db_config=None):
        """
        Initialize the event tracker
        
        Args:
            db_path: Path to the SQLite database
            start_date: Simulation start date
            resource_table_name: Name of the main resource table (e.g., 'Consultant')
            entity_table_name: Name of the main entity table (e.g., 'Ticket')
            bridge_table_config: Optional configuration for the bridge table with keys:
                - entity_fk_column: Name of the column referencing the entity table
                - resource_fk_column: Name of the column referencing the resource table
        """
        self.db_path = db_path
        self.resource_table_name = resource_table_name
        self.entity_table_name = entity_table_name
        self.bridge_table_name = None
        self.bridge_table = None # Will hold the SQLAlchemy Table object
        self.entity_fk_column = None
        self.resource_fk_column = None
        self.bridge_mode = None
        self.bridge_columns = set()
        self.event_type_column = 'event_type'
        
        # Use NullPool to avoid connection pool issues with SQLite
        # and enable WAL journal mode for better concurrency
        self.engine = create_engine(
            f"sqlite:///{db_path}?journal_mode=WAL",
            poolclass=NullPool
        )
        
        self.metadata = MetaData()
        self.start_date = start_date or datetime.now()
        
        # Initialize column resolver for strict column resolution
        if not db_config:
            raise ValueError("db_config is required for EventTracker - cannot use hardcoded column names")
        self.db_config = db_config
        self.column_resolver = ColumnResolver(db_config)
        
        # Cache for dynamic bridge tables: (entity_table, resource_table) -> (Table, entity_fk, resource_fk, event_type_col)
        self.bridge_table_cache = {}
        
        # Use custom bridge table configuration if provided
        if bridge_table_config:
            self.bridge_table_name = bridge_table_config.get('name')
            self.entity_fk_column = bridge_table_config.get('entity_fk_column')
            self.resource_fk_column = bridge_table_config.get('resource_fk_column')
            self.event_type_column = bridge_table_config.get('event_type_column') or self.event_type_column
            logger.info(f"EventTracker configured with custom bridge table: {self.bridge_table_name} "
                        f"(entity_fk: {self.entity_fk_column}, resource_fk: {self.resource_fk_column})")
        else:
            logger.warning("EventTracker: No bridge table configuration provided; resource tracking bridge will not be created.")
        
        # Create tracking tables
        self._create_tracking_tables()
    
    def _create_tracking_tables(self):
        """Create tables for tracking simulation events"""
        # Note: Entity arrivals are now tracked via created_at column in entity tables directly
        
        # Event processing table
        self.event_processing = Table(
            'sim_event_processing', self.metadata,
            Column('id', Integer, primary_key=True),
            Column('event_flow', String, nullable=False),
            Column('event_id', Integer, nullable=False),
            Column('entity_id', Integer, nullable=False),
            Column('entity_table', String, nullable=True),
            Column('start_time', Float, nullable=False),  # Simulation time in minutes
            Column('end_time', Float, nullable=False),
            Column('duration', Float, nullable=False),
            Column('start_datetime', DateTime, nullable=False),
            Column('end_datetime', DateTime, nullable=False)
        )
        
        # Resource allocation table
        self.resource_allocations = Table(
            'sim_resource_allocations', self.metadata,
            Column('id', Integer, primary_key=True),
            Column('event_flow', String, nullable=False),
            Column('event_id', Integer, nullable=False),
            Column('resource_table', String, nullable=False),
            Column('resource_id', Integer, nullable=False),
            Column('allocation_time', Float, nullable=False),  # Simulation time in minutes
            Column('release_time', Float, nullable=False),
            Column('allocation_datetime', DateTime, nullable=False),
            Column('release_datetime', DateTime, nullable=False)
        )
        
        # Reflect existing event and resource tables if names provided
        try:
            inspector = None
            if self.resource_table_name:
                from sqlalchemy import inspect
                inspector = inspect(self.engine)

            if self.resource_table_name:
                if inspector and inspector.has_table(self.resource_table_name):
                    Table(self.resource_table_name, self.metadata, autoload_with=self.engine)
                    logger.debug(f"Reflected table {self.resource_table_name} into metadata.")
                else:
                    logger.debug(f"Skipping reflection for missing resource table {self.resource_table_name}.")
        except NoSuchTableError as e:
            logger.warning(f"Resource table not found during reflection: {e}. Bridge table FK constraints might be skipped.")
        except Exception as e:
            logger.error(f"Error reflecting event/resource tables: {e}. Bridge table FK constraints might fail.")
        
        # Dynamic entity/resource bridge table (if names provided)
        if self.bridge_table_name and self.resource_fk_column and (self.entity_fk_column):
            try:
                # Prefer reflecting the existing schema first
                self.bridge_table = Table(self.bridge_table_name, self.metadata, autoload_with=self.engine)
                self.bridge_columns = {col.name for col in self.bridge_table.columns}
                if self.entity_fk_column:
                    self.bridge_mode = 'entity'
                if self.event_type_column and self.event_type_column not in self.bridge_columns and 'event_type' in self.bridge_columns:
                    self.event_type_column = 'event_type'
            except Exception:
                # Fallback: create a lightweight bridge table with minimal constraints
                columns: List[Column[Any]] = [Column('id', Integer, primary_key=True)]
                if self.entity_fk_column:
                    entity_fk_arg = None
                    if self.entity_table_name:
                        entity_fk_arg = ForeignKey(f"{self.entity_table_name}.{self._get_pk_column(self.entity_table_name)}")
                    entity_column_args = [self.entity_fk_column, Integer]
                    if entity_fk_arg:
                        entity_column_args.append(entity_fk_arg)
                    columns.append(Column(*entity_column_args, nullable=False))
                    self.bridge_mode = 'entity'
                resource_fk_arg = None
                if self.resource_table_name:
                    resource_fk_arg = ForeignKey(f"{self.resource_table_name}.{self._get_pk_column(self.resource_table_name)}")
                resource_column_args = [self.resource_fk_column, Integer]
                if resource_fk_arg:
                    resource_column_args.append(resource_fk_arg)
                columns.append(Column(*resource_column_args, nullable=False))
                columns.append(Column('event_type', String, nullable=True))
                columns.append(Column('start_date', DateTime, nullable=True))
                columns.append(Column('end_date', DateTime, nullable=True))
                self.bridge_table = Table(self.bridge_table_name, self.metadata, *columns)
                self.bridge_columns = {col.name for col in columns if hasattr(col, 'name')}
        
        # Create all tables defined in this metadata (sim tracking + bridge if defined)
        try:
            self.metadata.create_all(self.engine)
        except Exception as e:
            # Catch errors during create_all, e.g., if FKs still fail
            logger.error(f"Error during metadata.create_all: {e}")
    
    # Entity arrivals are now tracked automatically via created_at column in entity tables
    
    def record_event_processing(self, event_flow: str, event_id: int, entity_id: int, 
                               start_time: float, end_time: float, entity_table: str = None):
        """
        Record event processing
        
        Args:
            event_flow: Name of the event flow
            event_id: Event ID
            entity_id: Entity ID
            start_time: Start time in minutes
            end_time: End time in minutes
            entity_table: Name of the entity table
        """
        duration = end_time - start_time
        start_datetime = self.start_date + timedelta(minutes=start_time)
        end_datetime = self.start_date + timedelta(minutes=end_time)
        
        with self.engine.connect() as conn:
            stmt = insert(self.event_processing).values(
                event_flow=event_flow,
                event_id=event_id,
                entity_id=entity_id,
                entity_table=entity_table,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                start_datetime=start_datetime,
                end_datetime=end_datetime
            )
            conn.execute(stmt)
            conn.commit()
    
    def record_resource_allocation(self, event_flow, event_id, resource_table, resource_id,
                                  allocation_time, release_time=None,
                                  entity_id: Optional[int] = None, entity_table: Optional[str] = None, event_type: Optional[str] = None):
        """Record the allocation of a resource to an event."""
        try:
            allocation_datetime = self.start_date + timedelta(minutes=allocation_time)
            release_datetime = self.start_date + timedelta(minutes=release_time) if release_time else None

            with self.engine.connect() as conn:
                stmt = insert(self.resource_allocations).values(
                    event_flow=event_flow,
                    event_id=event_id,
                    resource_table=resource_table,
                    resource_id=resource_id,
                    allocation_time=allocation_time,
                    release_time=release_time,
                    allocation_datetime=allocation_datetime,
                    release_datetime=release_datetime
                )
                conn.execute(stmt)
                
                # Populate the dynamic bridge table if it exists and the resource table matches
                # Attempt to populate bridge table
                # Strategy:
                # 1. Try static bridge configuration (legacy/single-entity mode)
                # 2. Try dynamic lookup if entity_table is provided
                
                target_bridge = None
                entity_fk = None
                resource_fk = None
                event_type_col = None
                
                # Check static bridge first
                if self.bridge_table is not None and resource_table == self.resource_table_name:
                    if self.entity_table_name is None or (entity_table is None or entity_table == self.entity_table_name):
                         target_bridge = self.bridge_table
                         entity_fk = self.entity_fk_column
                         resource_fk = self.resource_fk_column
                         event_type_col = self.event_type_column
                
                # If no match, try dynamic lookup
                if target_bridge is None and entity_table and resource_table:
                    bridge_info = self._get_dynamic_bridge(entity_table, resource_table)
                    if bridge_info:
                        target_bridge, entity_fk, resource_fk, event_type_col = bridge_info
                
                if target_bridge is not None:

                    
                    if entity_fk and entity_id is None:
                        logger.warning(f"Bridge logging skipped for {target_bridge.name}: entity_id required but not provided.")
                        conn.commit()
                        return

                    bridge_data = {
                        resource_fk: resource_id,
                        'start_date': allocation_datetime,
                        'end_date': release_datetime
                    }

                    if entity_fk:
                        bridge_data[entity_fk] = entity_id
                    
                    if event_type and event_type_col and event_type_col in [c.name for c in target_bridge.columns]:
                         bridge_data[event_type_col] = event_type

                    stmt = insert(target_bridge).values(**bridge_data)
                    conn.execute(stmt)
                
                # Move the commit inside the with block to ensure the transaction is committed before the connection is closed
                conn.commit()
        except Exception as e:
            logger.error(f"Error recording resource allocation: {e}")
    
    def _get_dynamic_bridge(self, entity_table: str, resource_table: str):
        """
        Dynamically resolve a bridge table for a given entity and resource pair.
        
        Args:
            entity_table: Name of the entity table
            resource_table: Name of the resource table
            
        Returns:
            Tuple (Table, entity_fk_column, resource_fk_column, event_type_column) or None
        """
        cache_key = (entity_table, resource_table)
        if cache_key in self.bridge_table_cache:
            return self.bridge_table_cache[cache_key]
            
        if not self.db_config:
            return None
            
        # Search db_config for a matching bridge entity
        target_bridge_entity = None
        entity_fk_col = None
        resource_fk_col = None
        event_type_col = None
        
        for entity in self.db_config.entities:
            e_fk = None
            r_fk = None
            evt_type = None
            
            for attr in entity.attributes:
                # Check for entity_id ref
                if attr.type == 'entity_id' and attr.ref:
                    # ref is "Table.id"
                    ref_table = attr.ref.split('.')[0]
                    if ref_table == entity_table:
                        e_fk = attr.name
                
                # Check for resource_id ref
                elif attr.type == 'resource_id' and attr.ref:
                    ref_table = attr.ref.split('.')[0]
                    if ref_table == resource_table:
                        r_fk = attr.name
                        
                # Check for event_type
                elif attr.type == 'event_type':
                    evt_type = attr.name
            
            if e_fk and r_fk:
                target_bridge_entity = entity
                entity_fk_col = e_fk
                resource_fk_col = r_fk
                event_type_col = evt_type
                break
        
        if target_bridge_entity:
            try:
                # Reflect the table
                bridge_table = Table(target_bridge_entity.name, self.metadata, autoload_with=self.engine)
                result = (bridge_table, entity_fk_col, resource_fk_col, event_type_col)
                self.bridge_table_cache[cache_key] = result
                logger.debug(f"Resolved dynamic bridge for {entity_table}/{resource_table} -> {target_bridge_entity.name}")
                return result
            except Exception as e:
                logger.error(f"Failed to reflect dynamic bridge table {target_bridge_entity.name}: {e}")
                
        self.bridge_table_cache[cache_key] = None
        return None

    def dispose(self):
        """
        Properly dispose of the EventTracker engine to release database connections.
        This is critical for preventing EBUSY errors on Windows when deleting database files.
        """
        try:
            if hasattr(self, 'engine') and self.engine is not None:
                self.engine.dispose()
                logger.debug("EventTracker engine disposed successfully")
            else:
                logger.debug("EventTracker engine was already disposed or never created")
        except Exception as e:
            logger.warning(f"Error disposing EventTracker engine: {e}")
    
    def _get_pk_column(self, table_name: str) -> str:
        """Get primary key column name using ColumnResolver."""
        try:
            return self.column_resolver.get_primary_key(table_name)
        except Exception as e:
            raise ValueError(f"Cannot resolve primary key for table '{table_name}': {e}. "
                           f"Ensure table has column with type='pk' defined in db_config.") 
