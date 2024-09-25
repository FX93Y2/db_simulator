from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

def create_entity_model(entity_config):
    attributes = {
        '__tablename__': entity_config['name'],
        'id': Column(Integer, primary_key=True)
    }
    for attr in entity_config['attributes']:
        if attr['name'] != 'id':
            if attr['type'] == 'int':
                attributes[attr['name']] = Column(Integer)
            elif attr['type'] == 'string':
                attributes[attr['name']] = Column(String)
            elif attr['type'] == 'float':
                attributes[attr['name']] = Column(Float)
            # Add more types as needed
    
    return type(entity_config['name'], (Base,), attributes)

def create_models(config):
    return {entity['name']: create_entity_model(entity) for entity in config['entities']}