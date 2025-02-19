from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from typing import Optional
from pathlib import Path

class DatabaseManager:
    def __init__(self, model_registry, db_path: Optional[str] = None):
        """Initialize database manager with model registry and optional path to SQLite database"""
        if db_path is None:
            db_path = 'sqlite:///simulation.db'
        elif not db_path.startswith('sqlite:///'):
            db_path = f'sqlite:///{db_path}'
            
        # Create engine with foreign key support
        self.engine = create_engine(
            db_path,
            echo=False,  # Set to True for SQL debugging
            future=True,
            connect_args={'check_same_thread': False}
        )
        
        # Enable foreign key support for SQLite
        @event.listens_for(self.engine, 'connect')
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        
        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False
        )
        self.model_registry = model_registry
        
    def create_all(self):
        """Create all tables defined in the models"""
        self.model_registry.Base.metadata.create_all(self.engine)
        
    def drop_all(self):
        """Drop all tables"""
        self.model_registry.Base.metadata.drop_all(self.engine)
        
    def get_session(self) -> Session:
        """Get a new database session"""
        return self.SessionLocal()
        
    def __enter__(self):
        """Context manager entry"""
        self.session = self.get_session()
        return self.session
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        if self.session:
            if exc_type is not None:
                self.session.rollback()
            self.session.close() 