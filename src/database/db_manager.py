from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base, create_models

class DatabaseManager:
    def __init__(self, config):
        self.engine = create_engine('sqlite:///simulation.db')
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.models = create_models(config)

    def bulk_insert(self, entity_type, entities):
        session = self.Session()
        model = self.models[entity_type]
        session.bulk_insert_mappings(model, entities.values())
        session.commit()
        session.close()

    def insert(self, entity_type, entity_id, entity_data):
        session = self.Session()
        model = self.models[entity_type]
        new_entity = model(**entity_data)
        session.add(new_entity)
        session.commit()
        session.close()

    def update(self, entity_type, entity_id, update_data):
        session = self.Session()
        model = self.models[entity_type]
        entity = session.query(model).filter_by(id=entity_id).first()
        for key, value in update_data.items():
            setattr(entity, key, value)
        session.commit()
        session.close()

    def close(self):
        self.engine.dispose()