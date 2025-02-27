"""
Database configuration parser
"""

import yaml
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union

logger = logging.getLogger(__name__)

@dataclass
class Generator:
    type: str
    method: Optional[str] = None
    template: Optional[str] = None
    distribution: Optional[Dict] = None
    values: Optional[List] = None
    weights: Optional[List[float]] = None

@dataclass
class Relationship:
    type: str
    multiplicity: Dict

@dataclass
class Attribute:
    name: str
    type: str
    generator: Optional[Generator] = None
    ref: Optional[str] = None
    relationship: Optional[Relationship] = None
    
    @property
    def is_primary_key(self) -> bool:
        return self.type == 'pk'
    
    @property
    def is_foreign_key(self) -> bool:
        return self.type == 'fk'

@dataclass
class Entity:
    name: str
    attributes: List[Attribute]
    rows: Any = 0

@dataclass
class DatabaseConfig:
    entities: List[Entity]

def parse_db_config(file_path: Union[str, Path]) -> DatabaseConfig:
    if isinstance(file_path, str):
        file_path = Path(file_path)
        
    if not file_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {file_path}")
    
    with open(file_path, 'r') as f:
        config_dict = yaml.safe_load(f)
    
    entities = []
    for entity_dict in config_dict.get('entities', []):
        attributes = []
        for attr_dict in entity_dict.get('attributes', []):
            generator = None
            if 'generator' in attr_dict:
                gen_dict = attr_dict['generator']
                generator = Generator(
                    type=gen_dict['type'],
                    method=gen_dict.get('method'),
                    template=gen_dict.get('template'),
                    distribution=gen_dict.get('distribution'),
                    values=gen_dict.get('values'),
                    weights=gen_dict.get('weights')
                )
            
            relationship = None
            if 'relationship' in attr_dict:
                rel_dict = attr_dict['relationship']
                relationship = Relationship(
                    type=rel_dict['type'],
                    multiplicity=rel_dict.get('multiplicity', {})
                )
            
            attributes.append(Attribute(
                name=attr_dict['name'],
                type=attr_dict['type'],
                generator=generator,
                ref=attr_dict.get('ref'),
                relationship=relationship
            ))
        
        entities.append(Entity(
            name=entity_dict['name'],
            attributes=attributes,
            rows=entity_dict.get('rows', 0)
        ))
    
    return DatabaseConfig(entities=entities) 