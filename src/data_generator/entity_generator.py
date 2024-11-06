from datetime import datetime, timedelta
import logging
import random
from typing import Dict, Any, Optional, List, Tuple, Union
from .value_generator import generate_attribute_value

logger = logging.getLogger(__name__)

class TableType:
    RESOURCE = 'resource'
    PROCESS_ENTITY = 'process_entity'
    MAPPING = 'mapping'

class EntityStatus:
    NOT_STARTED = 'Not Started'
    IN_PROGRESS = 'In Progress'
    COMPLETED = 'Completed'

class ResourceStatus:
    AVAILABLE = 'Available'
    BUSY = 'Busy'

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

    def generate_initial_entities(self) -> Dict[str, Dict[int, Dict[str, Any]]]:
        """Generate all initial entities based on configuration"""
        try:
            entities = {}
            
            # Generate resources first
            resource_entities = self._get_entities_by_type(TableType.RESOURCE)
            for entity_name in resource_entities:
                entity_config = self._get_entity_config(entity_name)
                entities[entity_name] = self._create_entities(entity_config)
                
            # Generate process entities
            process_entities = self._get_entities_by_type(TableType.PROCESS_ENTITY)
            for entity_name in process_entities:
                entity_config = self._get_entity_config(entity_name)
                entities[entity_name] = self._create_entities(entity_config)
            
            # Initialize mapping tables
            mapping_entities = self._get_mapping_tables()
            for entity_name in mapping_entities:
                entities[entity_name] = {}
            
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

    def _create_entities(
        self,
        entity_config: Dict[str, Any],
        existing_entities: Optional[Dict[str, Dict[int, Dict[str, Any]]]] = None
    ) -> Dict[int, Dict[str, Any]]:
        """Create entities of a specific type"""
        if entity_config.get('auto_generated'):
            return {}

        entities = {}
        count = self.config['initial_population'][entity_config['name']]['count']
        
        # Get creation time distribution
        distribution_config = self.config['initial_population'][entity_config['name']].get(
            'creation_time_distribution',
            {'type': 'uniform'}
        )
        
        # Generate creation times
        time_distribution = self._get_time_distribution(distribution_config)
        creation_times = sorted([time_distribution() for _ in range(count)])
        
        # Create entities
        for i, creation_time in enumerate(creation_times, start=1):
            try:
                entity = self._create_single_entity(
                    entity_config,
                    creation_time,
                    existing_entities
                )
                entities[i] = entity
            except Exception as e:
                logger.error(f"Failed to create entity {i} of type {entity_config['name']}: {str(e)}")
                raise
        
        return entities

    def _create_single_entity(
        self,
        entity_config: Dict[str, Any],
        creation_time: datetime,
        existing_entities: Optional[Dict[str, Dict[int, Dict[str, Any]]]] = None
    ) -> Dict[str, Any]:
        """Create a single entity with all its attributes"""
        entity = {}
        
        # Set default status based on table type
        if entity_config['type'] == TableType.RESOURCE:
            entity['status'] = ResourceStatus.AVAILABLE
        elif entity_config['type'] == TableType.PROCESS_ENTITY:
            entity['status'] = EntityStatus.NOT_STARTED

        # Handle CreatedAt if defined
        if any(attr['name'] == 'CreatedAt' for attr in entity_config['attributes']):
            entity['CreatedAt'] = creation_time

        # Process all attributes
        dependent_attributes = []
        for attr in entity_config['attributes']:
            if attr['name'] == 'id' or attr['name'] == 'CreatedAt':
                continue

            if 'foreign_key' in attr:
                self._handle_foreign_key(entity, attr, creation_time, existing_entities)
            elif 'generator' in attr and attr['generator']['type'] == 'dependent':
                dependent_attributes.append(attr)
            else:
                entity[attr['name']] = generate_attribute_value(
                    attr,
                    entity_config,
                    self.config,
                    entity
                )

        # Handle dependent attributes after other attributes are set
        for attr in dependent_attributes:
            entity[attr['name']] = generate_attribute_value(
                attr,
                entity_config,
                self.config,
                entity
            )

        return entity

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