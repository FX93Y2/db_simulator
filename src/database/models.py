from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Table
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from typing import Dict, Any, List
import datetime
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

class TableType:
    RESOURCE = 'resource'
    PROCESS_ENTITY = 'process_entity'

class EntityStatus:
    NOT_STARTED = 'Not Started'
    IN_PROGRESS = 'In Progress'
    COMPLETED = 'Completed'

class ResourceStatus:
    AVAILABLE = 'Available'
    BUSY = 'Busy'
    
def create_models(config: Dict[str, Any]) -> Dict[str, Any]:
    """Create SQLAlchemy models from configuration"""
    models = {}
    
    # First pass: Create all basic models
    for entity in config['entities']:
        model = create_entity_model(entity, config['relationships'])
        models[entity['name']] = model
    
    return models


def create_entity_model(entity_config: Dict[str, Any], relationships: List[Dict[str, Any]]):
    """Create SQLAlchemy model with status based on table type"""
    attributes = {
        '__tablename__': entity_config['name'],
        'id': Column(Integer, primary_key=True),
    }
    
    # Check if this is an auto-generated mapping table
    is_auto_generated = entity_config.get('auto_generated', False)
    if is_auto_generated:
        # For auto-generated tables, just create columns from attributes
        for attr in entity_config['attributes']:
            if attr['name'] != 'id':  # Skip id as it's already added
                column = create_column(attr)
                if column is not None:
                    attributes[attr['name']] = column
        return type(entity_config['name'], (Base,), attributes)
    
    # Regular entity processing continues here...
    table_type = entity_config.get('type')
    if table_type == TableType.RESOURCE:
        attributes['status'] = Column(String, nullable=False, default=ResourceStatus.AVAILABLE)
        attributes['__table_type__'] = TableType.RESOURCE
    elif table_type == TableType.PROCESS_ENTITY:
        attributes['status'] = Column(String, nullable=False, default=EntityStatus.NOT_STARTED)
        attributes['__table_type__'] = TableType.PROCESS_ENTITY
    
    # Process regular attributes
    for attr in entity_config['attributes']:
        if attr['name'] != 'id':
            column = create_column(attr)
            if column is not None:
                attributes[attr['name']] = column
    
    # Handle relationships
    for rel in relationships:
        if rel['from'] == entity_config['name']:
            target = rel['to']
            rel_type = rel['type']
            
            if rel_type == 'one_to_many':
                attributes[target.lower()] = relationship(
                    target,
                    backref=entity_config['name'].lower(),
                    lazy='dynamic'
                )
            elif rel_type == 'many_to_one':
                fk_col_name = f'{target.lower()}_id'
                attributes[fk_col_name] = Column(Integer, ForeignKey(f'{target}.id'))
                attributes[target.lower()] = relationship(target)
            elif rel_type == 'many_to_many':
                # Use the specified mapping table name
                mapping_table = rel.get('mapping_table', f'{rel["from"].lower()}_{rel["to"].lower()}_association')
                attributes[target.lower()] = relationship(
                    target,
                    secondary=mapping_table,
                    backref=entity_config['name'].lower()
                )
    
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

def initialize_models(models: Dict[str, Any]) -> None:
    """Initialize all models to ensure they're registered with SQLAlchemy"""
    for model in models.values():
        if hasattr(model, '__table__'):
            if model.__table__.metadata is not Base.metadata:
                Base.metadata.tables[model.__tablename__] = model.__table__