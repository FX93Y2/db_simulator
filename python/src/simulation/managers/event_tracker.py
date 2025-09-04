"""
Event tracker for recording simulation events in the database
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import create_engine, Table, Column, Integer, String, DateTime, Float, MetaData, insert, text, ForeignKey
from sqlalchemy.pool import NullPool
from ...utils.column_resolver import ColumnResolver

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
                 event_table_name: Optional[str] = None,
                 resource_table_name: Optional[str] = None,
                 bridge_table_config: Optional[Dict[str, Any]] = None,
                 db_config=None):
        """
        Initialize the event tracker
        
        Args:
            db_path: Path to the SQLite database
            start_date: Simulation start date
            event_table_name: Name of the main event table (e.g., 'Deliverable')
            resource_table_name: Name of the main resource table (e.g., 'Consultant')
            bridge_table_config: Optional configuration for the bridge table with keys:
                - name: Name of the bridge table
                - event_fk_column: Name of the column referencing the event table
                - resource_fk_column: Name of the column referencing the resource table
        """
        self.db_path = db_path
        self.event_table_name = event_table_name
        self.resource_table_name = resource_table_name
        self.bridge_table_name = None
        self.bridge_table = None # Will hold the SQLAlchemy Table object
        self.event_fk_column = None
        self.resource_fk_column = None
        
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
        self.column_resolver = ColumnResolver(db_config)
        
        # Use custom bridge table configuration if provided
        if bridge_table_config:
            self.bridge_table_name = bridge_table_config.get('name')
            self.event_fk_column = bridge_table_config.get('event_fk_column')
            self.resource_fk_column = bridge_table_config.get('resource_fk_column')
            logger.info(f"EventTracker configured with custom bridge table: {self.bridge_table_name} "
                        f"(event_fk: {self.event_fk_column}, resource_fk: {self.resource_fk_column})")
        # Otherwise determine dynamic bridge table name and columns
        elif self.event_table_name and self.resource_table_name:
            self.bridge_table_name = f"{self.event_table_name}_{self.resource_table_name}"
            # Construct foreign key column names (e.g., deliverable_id, consultant_id)
            self.event_fk_column = f"{self.event_table_name.lower()}_id"
            self.resource_fk_column = f"{self.resource_table_name.lower()}_id"
            logger.info(f"EventTracker configured for auto-generated bridge table: {self.bridge_table_name}")
        else:
            logger.warning("EventTracker: Event or resource table name not provided, bridge table will not be created.")
        
        # Create tracking tables
        self._create_tracking_tables()
    
    def _create_tracking_tables(self):
        """Create tables for tracking simulation events"""
        # Note: Entity arrivals are now tracked via created_at column in entity tables directly
        
        # Event processing table
        self.event_processing = Table(
            'sim_event_processing', self.metadata,
            Column('id', Integer, primary_key=True),
            Column('event_table', String, nullable=False),
            Column('event_id', Integer, nullable=False),
            Column('entity_id', Integer, nullable=False),
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
            if self.event_table_name:
                Table(self.event_table_name, self.metadata, autoload_with=self.engine)
                logger.debug(f"Reflected table {self.event_table_name} into metadata.")
            if self.resource_table_name:
                Table(self.resource_table_name, self.metadata, autoload_with=self.engine)
                logger.debug(f"Reflected table {self.resource_table_name} into metadata.")
        except Exception as e:
            logger.error(f"Error reflecting event/resource tables: {e}. Bridge table FK constraints might fail.")
        
        # Dynamic event-resource bridging table (if names provided)
        if self.bridge_table_name and self.event_fk_column and self.resource_fk_column:
            self.bridge_table = Table(
                self.bridge_table_name, self.metadata,
                Column('id', Integer, primary_key=True),
                # Use dynamic column names and attempt to add FK constraints
                # Note: FK constraints might fail if target tables don't exist yet during init.
                # Consider creating tables sequentially or adding constraints later if issues arise.
                # Resolve primary key columns for FK constraints
                Column(self.event_fk_column, Integer, 
                      ForeignKey(f"{self.event_table_name}.{self._get_pk_column(self.event_table_name)}"), 
                      nullable=False), 
                Column(self.resource_fk_column, Integer, 
                      ForeignKey(f"{self.resource_table_name}.{self._get_pk_column(self.resource_table_name)}"), 
                      nullable=False),
                Column('start_date', DateTime, nullable=False),
                Column('end_date', DateTime, nullable=True) # Allow NULL for ongoing allocations
            )
        
        # Create all tables defined in this metadata (sim tracking + bridge if defined)
        try:
            self.metadata.create_all(self.engine)
        except Exception as e:
            # Catch errors during create_all, e.g., if FKs still fail
            logger.error(f"Error during metadata.create_all: {e}")
    
    # Entity arrivals are now tracked automatically via created_at column in entity tables
    
    def record_event_processing(self, event_table: str, event_id: int, entity_id: int, 
                               start_time: float, end_time: float):
        """
        Record event processing
        
        Args:
            event_table: Name of the event table
            event_id: Event ID
            entity_id: Entity ID
            start_time: Start time in minutes
            end_time: End time in minutes
        """
        duration = end_time - start_time
        start_datetime = self.start_date + timedelta(minutes=start_time)
        end_datetime = self.start_date + timedelta(minutes=end_time)
        
        with self.engine.connect() as conn:
            stmt = insert(self.event_processing).values(
                event_table=event_table,
                event_id=event_id,
                entity_id=entity_id,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                start_datetime=start_datetime,
                end_datetime=end_datetime
            )
            conn.execute(stmt)
            conn.commit()
    
    def record_resource_allocation(self, event_id, resource_table, resource_id, allocation_time, release_time=None):
        """Record the allocation of a resource to an event."""
        try:
            allocation_datetime = self.start_date + timedelta(minutes=allocation_time)
            release_datetime = self.start_date + timedelta(minutes=release_time) if release_time else None

            with self.engine.connect() as conn:
                stmt = insert(self.resource_allocations).values(
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
                if self.bridge_table is not None and resource_table == self.resource_table_name:
                    logger.debug(f"Recording allocation in bridge table {self.bridge_table_name}")
                    # Use dynamic column names
                    bridge_data = {
                        self.event_fk_column: event_id,
                        self.resource_fk_column: resource_id,
                        'start_date': allocation_datetime,
                        'end_date': release_datetime
                    }
                    stmt = insert(self.bridge_table).values(**bridge_data)
                    conn.execute(stmt)
                
                # Move the commit inside the with block to ensure the transaction is committed before the connection is closed
                conn.commit()
        except Exception as e:
            logger.error(f"Error recording resource allocation: {e}")
    
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