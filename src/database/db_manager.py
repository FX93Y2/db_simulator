import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base, create_models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, config, config_file_name):
        db_name = os.path.splitext(config_file_name)[0]
        db_path = os.path.join('output', f"{db_name}.db")
        self.engine = create_engine(f'sqlite:///{db_path}', echo=True)
        self.models = create_models(config)
        
        try:
            Base.metadata.create_all(self.engine)
            logger.info(f"Database {db_path} created successfully")
        except Exception as e:
            logger.error(f"Error creating database tables: {str(e)}")
            raise
        
        self.Session = sessionmaker(bind=self.engine)
    
    def get(self, entity_type, entity_id):
        session = self.Session()
        model = self.models[entity_type]
        entity = session.query(model).filter_by(id=entity_id).first()
        session.close()
        return {c.name: getattr(entity, c.name) for c in entity.__table__.columns} if entity else None

    def bulk_insert(self, entity_type, entities):
        session = self.Session()
        model = self.models[entity_type]
        try:
            session.bulk_insert_mappings(model, entities.values())
            session.commit()
            logger.info(f"Bulk insert successful for {entity_type}")
        except Exception as e:
            logger.error(f"Error during bulk insert for {entity_type}: {str(e)}")
            session.rollback()
            raise
        finally:
            session.close()

    def insert(self, entity_type, entity_data):
        session = self.Session()
        model = self.models[entity_type]
        new_entity = model(**entity_data)
        try:
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

    def update(self, entity_type, entity_id, update_data):
        session = self.Session()
        model = self.models[entity_type]
        try:
            entity = session.query(model).filter_by(id=entity_id).first()
            if entity is None:
                logger.warning(f"No {entity_type} found with ID {entity_id} for update")
                return False
            for key, value in update_data.items():
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

    def close(self):
        self.engine.dispose()