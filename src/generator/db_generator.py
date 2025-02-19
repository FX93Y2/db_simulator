from typing import Dict, Any, Optional, List, Union
from pathlib import Path
import logging

from src.config.db_config import DatabaseConfig, DatabaseConfigParser, EntityConfig, AttributeConfig
from src.models import DatabaseManager, ModelRegistry
from src.utils.distribution_utils import generate_from_distribution, round_if_needed
from src.utils.faker_utils import generate_fake_data
from src.utils.template_utils import generate_from_template

logger = logging.getLogger(__name__)

class DatabaseGenerator:
    def __init__(self, config_path: Path, db_path: Optional[str] = None):
        """Initialize database generator with config file path"""
        self.config = DatabaseConfigParser.parse(config_path)
        self.model_registry = ModelRegistry()
        self.db = DatabaseManager(self.model_registry, db_path)
        
        # Create models from configuration
        self._create_models()
        self.db.create_all()
        
    def _create_models(self):
        """Create SQLAlchemy models from configuration"""
        # First pass: Create all models without relationships
        for entity_config in self.config.entities:
            attributes = self._convert_attributes(entity_config.attributes)
            self.model_registry.create_model(entity_config.name, attributes)
            
        # Second pass: Add relationships
        for entity_config in self.config.entities:
            relationships = self._extract_relationships(entity_config)
            if relationships:
                model = self.model_registry.get_model(entity_config.name)
                for rel_name, rel_config in relationships.items():
                    setattr(model, rel_name, rel_config)
                    
    def _convert_attributes(self, attributes: List[AttributeConfig]) -> Dict[str, Dict[str, Any]]:
        """Convert AttributeConfig objects to dictionary format for model creation"""
        return {
            attr.name: {
                'type': attr.type,
                'ref': attr.ref
            }
            for attr in attributes
        }
        
    def _extract_relationships(self, entity_config: EntityConfig) -> Dict[str, Dict[str, Any]]:
        """Extract relationship configurations from entity config"""
        relationships = {}
        for attr in entity_config.attributes:
            if attr.type == 'fk' and attr.ref:
                ref_table, _ = attr.ref.split('.')
                rel_name = ref_table.lower()
                relationships[rel_name] = {
                    'target_entity': ref_table,
                    'back_populates': f'{entity_config.name.lower()}s'
                }
        return relationships
        
    def generate_attribute_value(self, attr: AttributeConfig, context: Dict[str, Any] = None, size: Optional[int] = None) -> Any:
        """Generate value for a single attribute based on its configuration"""
        if not attr.generator:
            return None
            
        if attr.generator.type == 'faker':
            return generate_fake_data(attr.generator.method, size)
            
        elif attr.generator.type == 'distribution':
            value = generate_from_distribution(attr.generator.distribution, size)
            return round_if_needed(value)
            
        elif attr.generator.type == 'template':
            return generate_from_template(attr.generator.template, context or {}, size)
            
        else:
            raise ValueError(f"Unsupported generator type: {attr.generator.type}")
            
    def _get_row_count(self, rows: Union[int, str, None]) -> int:
        """Convert rows specification to an integer"""
        if rows is None:
            return 1
        if isinstance(rows, int):
            return rows
        if isinstance(rows, str):
            if rows.lower() == 'n/a':
                return 1  # Default for dynamic tables in test mode
            try:
                return int(rows)
            except ValueError:
                logger.warning(f"Invalid rows value '{rows}', using default of 1")
                return 1
        return 1
            
    def generate_entity_data(self, entity_config: EntityConfig) -> List[Dict[str, Any]]:
        """Generate data for an entity based on its configuration"""
        rows = self._get_row_count(entity_config.rows)
        data = []
        
        for i in range(rows):
            context = {'id': i + 1}  # Base context for template generation
            row_data = {}
            
            for attr in entity_config.attributes:
                if attr.type == 'pk':
                    row_data[attr.name] = i + 1
                    context[attr.name] = i + 1  # Add to context for template use
                elif attr.type == 'fk':
                    # Handle foreign keys during insertion
                    continue
                else:
                    value = self.generate_attribute_value(attr, context)
                    row_data[attr.name] = value
                    context[attr.name] = value  # Add to context for template use
                    
            data.append(row_data)
            
        return data
        
    def generate_all(self):
        """Generate data for all entities in the configuration"""
        with self.db as session:
            # First pass: Create all parent entities and store their IDs
            parent_ids = {}  # Store parent IDs for FK distribution
            for entity_config in self.config.entities:
                if not any(attr.type == 'fk' for attr in entity_config.attributes):
                    logger.info(f"Generating data for parent entity: {entity_config.name}")
                    data = self.generate_entity_data(entity_config)
                    
                    # Store generated instances and their IDs
                    instances = []
                    for row in data:
                        model_class = self.model_registry.get_model(entity_config.name)
                        instance = model_class(**row)
                        session.add(instance)
                        instances.append(instance)
                    
                    session.flush()  # Flush to get IDs
                    parent_ids[entity_config.name] = [inst.id for inst in instances]
                    logger.debug(f"Generated IDs for {entity_config.name}: {parent_ids[entity_config.name]}")
                        
            session.commit()
            
            # Second pass: Create child entities with foreign keys
            for entity_config in self.config.entities:
                if any(attr.type == 'fk' for attr in entity_config.attributes):
                    logger.info(f"Generating data for child entity: {entity_config.name}")
                    data = self.generate_entity_data(entity_config)
                    
                    for row in data:
                        # Handle foreign key relationships
                        for attr in entity_config.attributes:
                            if attr.type == 'fk' and attr.ref:
                                parent_table, parent_col = attr.ref.split('.')
                                
                                # Check if there's a distribution for this FK
                                if attr.generator and attr.generator.type == 'distribution':
                                    dist_config = attr.generator.distribution
                                    if dist_config.get('mode') == 'parent_id':
                                        # Use weights to choose parent ID
                                        available_ids = parent_ids[parent_table]
                                        weights = dist_config.get('weights')
                                        if weights and len(weights) == len(available_ids):
                                            row[attr.name] = int(generate_from_distribution({
                                                'type': 'choice',
                                                'values': available_ids,
                                                'weights': weights
                                            }))
                                        else:
                                            # Fallback to random choice if weights don't match
                                            row[attr.name] = int(generate_from_distribution({
                                                'type': 'choice',
                                                'values': available_ids
                                            }))
                                        continue
                                
                                # Default behavior: get first parent
                                if parent_table in parent_ids and parent_ids[parent_table]:
                                    row[attr.name] = parent_ids[parent_table][0]
                                else:
                                    raise ValueError(f"No parent records found for {parent_table}")
                                    
                        model_class = self.model_registry.get_model(entity_config.name)
                        instance = model_class(**row)
                        session.add(instance)
                        
            session.commit() 