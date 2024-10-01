from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

def create_entity_model(entity_config, relationships):
    attributes = {
        '__tablename__': entity_config['name'],
        'id': Column(Integer, primary_key=True)
    }
    for attr in entity_config['attributes']:
        if attr['name'] != 'id':
            if attr['type'] == 'int':
                if 'foreign_key' in attr:
                    ref_table, ref_column = attr['foreign_key'].split('.')
                    attributes[attr['name']] = Column(Integer, ForeignKey(f'{ref_table}.{ref_column}'))
                else:
                    attributes[attr['name']] = Column(Integer)
            elif attr['type'] == 'string':
                attributes[attr['name']] = Column(String)
            elif attr['type'] == 'float':
                attributes[attr['name']] = Column(Float)
    
    for rel in relationships:
        if rel['from'] == entity_config['name']:
            attributes[f"{rel['to'].lower()}"] = relationship(rel['to'])
    
    return type(entity_config['name'], (Base,), attributes)

def create_models(config):
    relationships = config.get('relationships', [])
    return {entity['name']: create_entity_model(entity, relationships) for entity in config['entities']}