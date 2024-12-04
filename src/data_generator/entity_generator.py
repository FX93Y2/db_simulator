from datetime import datetime, timedelta
import logging
import random
from typing import Dict, Any, Optional, List, Tuple, Union
from .value_generator import ValueGenerator
from ..common.constants import TableType, EntityStatus, ResourceStatus
logger = logging.getLogger(__name__)

class EntityGenerator:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.start_time = datetime.strptime(
            config['simulation_parameters']['start_date'],
            "%Y-%m-%d %H:%M:%S"
        )
        self.end_time = datetime.strptime(
            config['simulation_parameters']['end_date'],
            "%Y-%m-%d %H:%M:%S"
        )
        self.value_generator = ValueGenerator()
    def generate_initial_entities(self) -> Dict[str, Dict[int, Dict[str, Any]]]:
        """Generate all initial entities based on configuration"""
        try:
            entities = {}
            
            # Generate entities based on initial population configuration
            for entity_name, pop_config in self.config.get('initial_population', {}).items():
                entity_config = next(
                    (e for e in self.config['entities'] if e['name'] == entity_name),
                    None
                )
                
                if not entity_config:
                    raise ValueError(f"No configuration found for entity: {entity_name}")
                    
                count = pop_config['count']
                entities[entity_name] = {}
                
                for i in range(count):
                    entity_id = i + 1
                    creation_time = self.start_time
                    for attr in entity_config['attributes']:
                        if attr['name'] == 'CreatedAt' and 'generator' in attr:
                            creation_time = self.value_generator.generate_attribute_value(
                                attr,
                                entity_config,
                                self.config
                            )
                    
                    entity = self._create_single_entity(entity_id, entity_config, creation_time)
                    entities[entity_name][entity_id] = entity
                    
            return entities
            
        except Exception as e:
            logger.error(f"Failed to generate initial entities: {str(e)}")
            raise

    def _get_entities_by_type(self, table_type: str) -> List[str]:
        """Get list of entity names of a specific type"""
        return [
            entity['name'] for entity in self.config['entities']
            if entity.get('type') == table_type
        ]

    def _get_mapping_tables(self) -> List[str]:
        """Get list of mapping table names"""
        return [
            entity['name'] for entity in self.config['entities']
            if entity.get('auto_generated', False)
        ]

    def _get_entity_config(self, entity_name: str) -> Dict[str, Any]:
        """Get configuration for a specific entity"""
        return next(
            entity for entity in self.config['entities']
            if entity['name'] == entity_name
        )

    def _create_entities(self, entity_config: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
        """Create all entities of a given type"""
        entities = {}
        entity_name = entity_config['name']
        population_config = self.config['initial_population'].get(entity_name)
        
        if not population_config:
            logger.warning(f"No initial population defined for {entity_name}")
            return entities
        
        count = population_config['count']
        
        # Get time distribution for entity creation
        time_distribution = self._get_time_distribution(
            population_config.get('creation_time_distribution', 'UNIF(0, 24)')
        )
        
        try:
            for i in range(1, count + 1):
                creation_time = time_distribution()
                entity = self._create_single_entity(
                    entity_id=i,
                    entity_config=next(
                        e for e in self.config['entities'] 
                        if e['name'] == entity_name
                    ),
                    creation_time=creation_time
                )
                entities[i] = entity
                
        except Exception as e:
            logger.error(f"Failed to create entities for {entity_name}: {str(e)}")
            raise
            
        return entities

    def _create_single_entity(
        self,
        entity_id: int,
        entity_config: Dict[str, Any],
        creation_time: datetime
    ) -> Dict[str, Any]:
        """Create a single entity with the given configuration"""
        try:
            entity = {'id': entity_id}
            
            # Add creation time
            entity['CreatedAt'] = creation_time
            
            # For process entities, set initial status
            if entity_config.get('type') == TableType.PROCESS_ENTITY:
                entity['status'] = EntityStatus.NOT_STARTED 
            elif entity_config.get('type') == TableType.RESOURCE:
                entity['status'] = ResourceStatus.AVAILABLE
                
            # Generate values for all other attributes
            for attr in entity_config['attributes']:
                if attr['name'] not in ['id', 'CreatedAt', 'status']:
                    if 'foreign_key' in attr:
                        # Handle foreign key references properly
                        ref_table, _ = attr['foreign_key'].split('.')
                        # Get valid range for foreign key based on initial population
                        max_id = self.config['initial_population'][ref_table]['count']
                        entity[attr['name']] = random.randint(1, max_id)
                    else:
                        value = self.value_generator.generate_attribute_value(
                            attr,
                            entity_config,
                            self.config,
                            entity
                        )
                        entity[attr['name']] = value
            
            return entity
            
        except Exception as e:
            logger.error(f"Failed to create entity {entity_id} of type {entity_config['name']}: {str(e)}")
            raise

    def _handle_foreign_key(
        self,
        entity: Dict[str, Any],
        attr: Dict[str, Any],
        creation_time: datetime,
        existing_entities: Optional[Dict[str, Dict[int, Dict[str, Any]]]]
    ) -> None:
        """Handle foreign key relationships"""
        if not existing_entities:
            entity[attr['name']] = None
            return

        ref_entity, _ = attr['foreign_key'].split('.')
        valid_ids = [
            id for id, e in existing_entities[ref_entity].items()
            if 'CreatedAt' not in e or e['CreatedAt'] <= creation_time
        ]

        if not valid_ids:
            logger.warning(
                f"No valid IDs found for foreign key {attr['name']} "
                f"referencing {ref_entity} at time {creation_time}"
            )
            entity[attr['name']] = None
        else:
            entity[attr['name']] = random.choice(valid_ids)

    def _get_time_distribution(self, distribution_config: Union[str, Dict[str, Any]]):
        """Get time distribution function based on configuration"""
        try:
            # Handle string format (e.g., "UNIF(0, 24)")
            if isinstance(distribution_config, str):
                # Parse the string into a distribution config
                from ..utils.distributions import parse_distribution_string
                distribution_config = parse_distribution_string(distribution_config)
            
            distribution_type = distribution_config['distribution'].lower()
            
            if distribution_type == 'uniform':
                return lambda: self.start_time + timedelta(
                    hours=random.uniform(
                        float(distribution_config.get('min', 0)),
                        float(distribution_config.get('max', 24))
                    )
                )
            elif distribution_type == 'poisson':
                lambda_param = float(distribution_config.get('mean', 24))
                return lambda: self.start_time + timedelta(
                    hours=random.expovariate(1/lambda_param)
                )
            else:
                raise ValueError(f"Unsupported time distribution type: {distribution_type}")
        except Exception as e:
            logger.error(f"Error creating time distribution: {str(e)}")
            raise


def generate_initial_entities(config: Dict[str, Any]) -> Dict[str, Dict[int, Dict[str, Any]]]:
    """Convenience function to generate initial entities"""
    generator = EntityGenerator(config)
    return generator.generate_initial_entities()