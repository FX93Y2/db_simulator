from sqlalchemy import create_engine
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
            
        self.engine = create_engine(db_path)
        self.SessionLocal = sessionmaker(bind=self.engine)
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