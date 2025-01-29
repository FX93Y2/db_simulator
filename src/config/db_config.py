from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import yaml
from pathlib import Path

@dataclass
class AttributeConfig:
    name: str
    type: str
    ref: Optional[str] = None  # For foreign keys
    generator: Optional[Dict[str, Any]] = None
    simulation_arrival: Optional[Dict[str, Any]] = None

@dataclass
class EntityConfig:
    name: str
    rows: int
    attributes: List[AttributeConfig]

@dataclass
class DatabaseConfig:
    entities: List[EntityConfig]

class DatabaseConfigParser:
    """Parses database configuration YAML files"""
    
    @staticmethod
    def parse(config_path: Path) -> DatabaseConfig:
        with open(config_path) as f:
            config_dict = yaml.safe_load(f)
            
        entities = []
        for entity_dict in config_dict['entities']:
            attributes = [
                AttributeConfig(**attr_dict)
                for attr_dict in entity_dict['attributes']
            ]
            entity = EntityConfig(
                name=entity_dict['name'],
                rows=entity_dict['rows'],
                attributes=attributes
            )
            entities.append(entity)
            
        return DatabaseConfig(entities=entities) 