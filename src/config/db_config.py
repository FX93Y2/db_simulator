from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import yaml
from pathlib import Path

@dataclass
class GeneratorConfig:
    type: str
    distribution: Optional[Dict[str, Any]] = None
    method: Optional[str] = None
    template: Optional[str] = None
    simulation_override: bool = False

@dataclass
class AttributeConfig:
    name: str
    type: str
    ref: Optional[str] = None
    generator: Optional[GeneratorConfig] = None

@dataclass
class EntityConfig:
    name: str
    attributes: List[AttributeConfig]
    type: str = "entity"  # "entity" or "resource"
    rows: Optional[int] = None

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
            attributes = []
            for attr_dict in entity_dict['attributes']:
                generator = None
                if 'generator' in attr_dict:
                    gen_dict = attr_dict['generator']
                    # Handle case where distribution is directly specified
                    if 'distribution' in gen_dict and 'type' not in gen_dict:
                        generator = GeneratorConfig(
                            type='distribution',
                            distribution=gen_dict['distribution'],
                            simulation_override=gen_dict.get('simulation_override', False)
                        )
                    else:
                        generator = GeneratorConfig(
                            type=gen_dict['type'],
                            distribution=gen_dict.get('distribution'),
                            method=gen_dict.get('method'),
                            template=gen_dict.get('template'),
                            simulation_override=gen_dict.get('simulation_override', False)
                        )
                
                attribute = AttributeConfig(
                    name=attr_dict['name'],
                    type=attr_dict['type'],
                    ref=attr_dict.get('ref'),
                    generator=generator
                )
                attributes.append(attribute)
                
            entity = EntityConfig(
                name=entity_dict['name'],
                attributes=attributes,
                type=entity_dict.get('type', 'entity'),
                rows=entity_dict.get('rows')
            )
            entities.append(entity)
            
        return DatabaseConfig(entities=entities) 