import os
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from .models import Base, create_models, initialize_models
from ..config_parser.config_enhancer import EntityStatus, TableType

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, config: Dict[str, Any], config_name: str):
        """Initialize database manager"""
        self.config = config
        self.db_path = f"output/{config_name.replace('.yaml', '')}.db"
        
        os.makedirs("output", exist_ok=True)
        # Remove existing database
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
            
        self.engine = create_engine(f"sqlite:///{self.db_path}")
        # Create models first
        self.models = create_models(config)
        initialize_models(self.models)
        Base.metadata.create_all(self.engine)
        logger.info(f"Database {self.db_path} created successfully")
        
        # Create session factory
        self.Session = sessionmaker(bind=self.engine)

    def bulk_insert(self, entity_type: str, entities: List[Dict[str, Any]]):
        """Bulk insert entities into database"""
        try:
            model = self.models[entity_type]
            session = self.Session()
            
            # Validate and filter entities
            filtered_entities = []
            for entity in entities.values():
                # Remove None values
                entity_data = {k: v for k, v in entity.items() if v is not None}
                
                # Ensure end_date is None for non-completed process entities
                if (hasattr(model, '__table_type__') and 
                    getattr(model, '__table_type__') == TableType.PROCESS_ENTITY):
                    if entity_data.get('status') != EntityStatus.COMPLETED:
                        entity_data['end_date'] = None
                        
                filtered_entities.append(entity_data)
            
            # Perform bulk insert
            session.bulk_insert_mappings(model, filtered_entities)
            session.commit()
            
        except Exception as e:
            logger.error(f"Error during bulk insert for {entity_type}: {str(e)}")
            session.rollback()
            raise
        finally:
            session.close()
            
    def get_entities(self, entity_type: str) -> List[Dict[str, Any]]:
        """Get all entities of a given type from database"""
        try:
            model = self.models[entity_type]
            session = self.Session()
            entities = session.query(model).all()
            return [entity.__dict__ for entity in entities]
        finally:
            session.close()

    def insert(self, entity_type: str, entity_data: Dict[str, Any]) -> int:
        """Insert a single entity"""
        session = self.Session()
        model = self.models[entity_type]
        
        try:
            # Filter attributes to match model
            filtered_data = {
                k: v for k, v in entity_data.items() 
                if hasattr(model, k)
            }
            
            new_entity = model(**filtered_data)
            session.add(new_entity)
            session.commit()
            
            entity_id = new_entity.id
            logger.info(f"Inserted {entity_type} with ID {entity_id}")
            return entity_id
        except Exception as e:
            logger.error(f"Error inserting {entity_type}: {str(e)}")
            session.rollback()
            raise
        finally:
            session.close()

    def update(self, entity_type: str, entity_id: int, update_data: Dict[str, Any]) -> bool:
        """Update an entity"""
        session = self.Session()
        model = self.models[entity_type]
        
        try:
            entity = session.query(model).filter_by(id=entity_id).first()
            if entity is None:
                logger.warning(f"No {entity_type} found with ID {entity_id} for update")
                return False
            
            # Filter attributes to match model
            filtered_data = {
                k: v for k, v in update_data.items() 
                if hasattr(model, k)
            }
            
            for key, value in filtered_data.items():
                setattr(entity, key, value)
            
            session.commit()
            logger.info(f"Updated {entity_type} with ID {entity_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating {entity_type} with ID {entity_id}: {str(e)}")
            session.rollback()
            return False
        finally:
            session.close()

    def get(self, entity_type: str, entity_id: int) -> Optional[Dict[str, Any]]:
        """Get an entity by ID"""
        session = self.Session()
        model = self.models[entity_type]
        
        try:
            entity = session.query(model).filter_by(id=entity_id).first()
            if entity is None:
                return None
            
            return {c.name: getattr(entity, c.name) for c in entity.__table__.columns}
        finally:
            session.close()

    def get_process_records(self, process_name: str) -> List[Dict[str, Any]]:
        """Get all records for a specific process"""
        session = self.Session()
        
        try:
            # Find the appropriate mapping table
            mapping_tables = [
                name for name, model in self.models.items()
                if hasattr(model, '__auto_generated__') and 
                   getattr(model, '__auto_generated__', False)
            ]
            
            process_records = []
            for table_name in mapping_tables:
                model = self.models[table_name]
                records = session.query(model).filter_by(process_name=process_name).all()
                
                for record in records:
                    process_records.append(
                        {c.name: getattr(record, c.name) for c in record.__table__.columns}
                    )
            
            return process_records
        finally:
            session.close()

    def close(self):
        """Close database connection"""
        self.engine.dispose()