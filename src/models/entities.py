from sqlalchemy import Column, Integer, String, ForeignKey, MetaData
from sqlalchemy.orm import relationship, declarative_base
from typing import Dict, Type, Any

def create_entity_model(
    base_class: Type[Any],
    entity_name: str,
    attributes: Dict[str, Dict[str, Any]],
    relationships: Dict[str, Dict[str, Any]] = None
) -> Type[Any]:
    """
    Dynamically create a SQLAlchemy model class based on configuration.
    
    Args:
        base_class: The SQLAlchemy declarative base class
        entity_name: Name of the entity/table
        attributes: Dictionary of attribute definitions
        relationships: Optional dictionary of relationship definitions
    
    Returns:
        A dynamically created SQLAlchemy model class
    """
    attrs = {
        '__tablename__': entity_name.lower(),
        '__table_args__': {'extend_existing': True}
    }
    
    # Add columns based on attributes
    for name, config in attributes.items():
        if config['type'] == 'pk':
            attrs[name] = Column(Integer, primary_key=True)
        elif config['type'] == 'fk':
            ref_table, ref_col = config['ref'].split('.')
            attrs[name] = Column(Integer, ForeignKey(f'{ref_table.lower()}.{ref_col}'))
        elif config['type'] == 'string':
            attrs[name] = Column(String)
        elif config['type'] == 'integer':
            attrs[name] = Column(Integer)
        # Add more types as needed
    
    # Add relationships if specified
    if relationships:
        for name, config in relationships.items():
            attrs[name] = relationship(
                config['target_entity'],
                back_populates=config.get('back_populates'),
                cascade=config.get('cascade', 'all, delete-orphan')
            )
    
    # Create and return the model class
    return type(entity_name, (base_class,), attrs)

class ModelRegistry:
    """Registry for dynamically created SQLAlchemy models"""
    
    def __init__(self):
        self.metadata = MetaData()
        self.Base = declarative_base(metadata=self.metadata)
        self.models: Dict[str, Type[Any]] = {}
    
    def create_model(self, entity_name: str, attributes: Dict[str, Dict[str, Any]], relationships: Dict[str, Dict[str, Any]] = None) -> Type[Any]:
        """Create and register a new model"""
        model = create_entity_model(self.Base, entity_name, attributes, relationships)
        self.models[entity_name] = model
        return model
    
    def get_model(self, entity_name: str) -> Type[Any]:
        """Get a registered model by name"""
        return self.models.get(entity_name)
    
    def get_base(self) -> Type[Any]:
        """Get the SQLAlchemy Base class"""
        return self.Base 