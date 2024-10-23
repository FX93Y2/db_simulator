from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from typing import Dict, Any, List
import datetime
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

def create_models(config: Dict[str, Any]) -> Dict[str, Any]:
    """Create SQLAlchemy models from configuration"""
    models = {}
    
    # First pass: Create all basic models
    for entity in config['entities']:
        model = create_entity_model(entity, config['relationships'])
        models[entity['name']] = model
    
    return models

def create_entity_model(entity_config: Dict[str, Any], relationships: List[Dict[str, Any]]):
    """Create SQLAlchemy model for an entity"""
    attributes = {
        '__tablename__': entity_config['name'],
        'id': Column(Integer, primary_key=True, autoincrement=True),
    }
    
    # Process regular attributes
    for attr in entity_config['attributes']:
        if attr['name'] != 'id':
            column = create_column(attr)
            if column is not None:
                attributes[attr['name']] = column
    
    # Handle relationships
    rel_attrs = create_relationship_attributes(entity_config['name'], relationships)
    attributes.update(rel_attrs)
    
    # Add metadata for auto-generated mapping tables
    if entity_config.get('auto_generated'):
        attributes['__auto_generated__'] = True
    
    return type(entity_config['name'], (Base,), attributes)

def create_column(attr_config: Dict[str, Any]):
    """Create SQLAlchemy column from attribute configuration"""
    attr_type = attr_config['type']
    nullable = attr_config.get('nullable', True)
    
    if 'foreign_key' in attr_config:
        ref_table, ref_column = attr_config['foreign_key'].split('.')
        return Column(
            Integer,
            ForeignKey(f'{ref_table}.{ref_column}'),
            nullable=nullable
        )
    
    type_mapping = {
        'int': Integer,
        'integer': Integer,
        'string': String,
        'float': Float,
        'datetime': DateTime,
        'boolean': Boolean
    }
    
    column_type = type_mapping.get(attr_type.lower())
    if not column_type:
        logger.warning(f"Unsupported attribute type: {attr_type}")
        return None
    
    return Column(column_type, nullable=nullable)

def create_relationship_attributes(entity_name: str, relationships: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Create SQLAlchemy relationship attributes"""
    rel_attrs = {}
    
    for rel in relationships:
        if rel['from'] == entity_name:
            # This entity is the source of the relationship
            target_entity = rel['to']
            relationship_name = f"{target_entity.lower()}"  # Single form for relationship name
            
            # Handle backref creation
            backref_name = f"{entity_name.lower()}"  # Single form for backref name
            
            # Add the relationship
            rel_attrs[relationship_name] = relationship(
                target_entity,
                backref=backref_name
            )
    return rel_attrs

def initialize_models(engine):
    """Initialize all models in the database"""
    Base.metadata.create_all(engine)