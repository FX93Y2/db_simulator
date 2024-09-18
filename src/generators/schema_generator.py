from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Date, Enum, ForeignKey
from sqlalchemy.orm import relationship

Base = declarative_base()

class SchemaGenerator:
    def __init__(self, config):
        self.config = config

    def generate_models(self):
        models = {}
        for entity_name, entity_config in self.config['entities'].items():
            attrs = {
                '__tablename__': entity_name,
            }
            for attr in entity_config['attributes']:
                if attr['type'] == 'integer':
                    column = Column(Integer, primary_key=attr.get('primary_key', False))
                elif attr['type'] == 'string':
                    column = Column(String)
                elif attr['type'] == 'date':
                    column = Column(Date)
                elif attr['type'] == 'enum':
                    column = Column(Enum(*attr['options']))
                
                if 'foreign_key' in attr:
                    column = Column(Integer, ForeignKey(attr['foreign_key']))
                
                attrs[attr['name']] = column
            
            models[entity_name] = type(entity_name.capitalize(), (Base,), attrs)
        
        # Add relationships
        for rel in self.config.get('relationships', []):
            from_model = models[rel['from']]
            to_model = models[rel['to']]
            if rel['type'] == 'one_to_many':
                setattr(from_model, rel['to'] + 's', relationship(to_model.__name__))
        
        return Base, models

    def generate_schema(self):
        _, models = self.generate_models()
        return "\n".join(f"class {name}(Base):\n    {model.__table__}" for name, model in models.items())