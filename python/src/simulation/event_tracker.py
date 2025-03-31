"""
Event tracker for recording simulation events in the database
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import create_engine, Table, Column, Integer, String, DateTime, Float, MetaData, insert, text, ForeignKey
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

class EventTracker:
    """
    Tracks and records simulation events in the database
    
    This class creates and manages tables for tracking:
    - Entity arrivals
    - Event processing
    - Resource allocations
    - Deliverable_Consultant bridging table (main simulation output)
    """
    
    def __init__(self, db_path: str, start_date: Optional[datetime] = None):
        """
        Initialize the event tracker
        
        Args:
            db_path: Path to the SQLite database
            start_date: Simulation start date
        """
        self.db_path = db_path
        
        # Use NullPool to avoid connection pool issues with SQLite
        # and enable WAL journal mode for better concurrency
        self.engine = create_engine(
            f"sqlite:///{db_path}?journal_mode=WAL",
            poolclass=NullPool
        )
        
        self.metadata = MetaData()
        self.start_date = start_date or datetime.now()
        
        # Create tracking tables
        self._create_tracking_tables()
    
    def _create_tracking_tables(self):
        """Create tables for tracking simulation events"""
        # Entity arrivals table
        self.entity_arrivals = Table(
            'sim_entity_arrivals', self.metadata,
            Column('id', Integer, primary_key=True),
            Column('entity_table', String, nullable=False),
            Column('entity_id', Integer, nullable=False),
            Column('arrival_time', Float, nullable=False),  # Simulation time in minutes
            Column('arrival_datetime', DateTime, nullable=False)
        )
        
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
        
        # Deliverable_Consultant bridging table (main simulation output)
        self.deliverable_consultant = Table(
            'Deliverable_Consultant', self.metadata,
            Column('id', Integer, primary_key=True),
            Column('deliverable_id', Integer, nullable=False),  # Reference to Deliverable.id
            Column('consultant_id', Integer, nullable=False),   # Reference to Consultant.id
            Column('start_date', DateTime, nullable=False),
            Column('end_date', DateTime, nullable=False)
        )
        
        # Create all tables
        self.metadata.create_all(self.engine)
    
    def record_entity_arrival(self, entity_table: str, entity_id: int, sim_time: float):
        """
        Record an entity arrival
        
        Args:
            entity_table: Name of the entity table
            entity_id: Entity ID
            sim_time: Simulation time in minutes
        """
        arrival_datetime = self.start_date + timedelta(minutes=sim_time)
        
        with self.engine.connect() as conn:
            stmt = insert(self.entity_arrivals).values(
                entity_table=entity_table,
                entity_id=entity_id,
                arrival_time=sim_time,
                arrival_datetime=arrival_datetime
            )
            conn.execute(stmt)
            conn.commit()
    
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
                
                # Also populate the Deliverable_Consultant table if the resource is a Consultant
                if resource_table == 'Consultant':
                    # Record in the Deliverable_Consultant bridging table
                    stmt = insert(self.deliverable_consultant).values(
                        deliverable_id=event_id,
                        consultant_id=resource_id,
                        start_date=allocation_datetime,
                        end_date=release_datetime
                    )
                    conn.execute(stmt)
                
                # Move the commit inside the with block to ensure the transaction is committed before the connection is closed
                conn.commit()
        except Exception as e:
            logger.error(f"Error recording resource allocation: {e}") 