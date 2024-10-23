import os
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from .models import Base, create_models, initialize_models

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, config: Dict[str, Any], config_file_name: str):
        """Initialize database manager"""
        self.config = config
        db_name = os.path.splitext(config_file_name)[0]
        db_path = os.path.join('output', f"{db_name}.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        self.engine = create_engine(f'sqlite:///{db_path}', echo=False)
        self.models = create_models(config)
        
        try:
            initialize_models(self.engine)
            logger.info(f"Database {db_path} created successfully")
        except Exception as e:
            logger.error(f"Error creating database tables: {str(e)}")
            raise
        
        self.Session = sessionmaker(bind=self.engine)

    def bulk_insert(self, entity_type: str, entities: Dict[int, Dict[str, Any]]):
        """Bulk insert entities into database"""
        session = self.Session()
        model = self.models[entity_type]
        
        try:
            # Filter attributes to match model
            filtered_entities = []
            for entity in entities.values():
                filtered_entity = {
                    k: v for k, v in entity.items() 
                    if hasattr(model, k)
                }
                filtered_entities.append(filtered_entity)
            
            session.bulk_insert_mappings(model, filtered_entities)
            session.commit()
            logger.info(f"Bulk insert successful for {entity_type}")
        except Exception as e:
            logger.error(f"Error during bulk insert for {entity_type}: {str(e)}")
            session.rollback()
            raise
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