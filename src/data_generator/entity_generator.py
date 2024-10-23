from datetime import datetime, timedelta
import logging
import random
from typing import Dict, Any, Optional
from .value_generator import generate_attribute_value

logger = logging.getLogger(__name__)

class EntityGenerator:
    def __init__(self, config: Dict[str, Any]):
        self.config = config  # Store original config
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
            
            # Generate independent entities first
            independent_entities = self._get_independent_entities()
            for entity_name in independent_entities:
                entity_config = self._get_entity_config(entity_name)
                entities[entity_name] = self._create_entities(entity_config)
            
            # Then generate dependent entities
            dependent_entities = self._get_dependent_entities(independent_entities)
            for entity_name in dependent_entities:
                entity_config = self._get_entity_config(entity_name)
                entities[entity_name] = self._create_entities(entity_config, entities)
            
            return entities
        except Exception as e:
            logger.error(f"Failed to generate initial entities: {str(e)}")
            raise

    def _get_independent_entities(self) -> list:
        """Get list of entities with no foreign key dependencies"""
        return [
            entity['name'] for entity in self.config['entities'] 
            if not any('foreign_key' in attr for attr in entity['attributes'])
        ]

    def _get_dependent_entities(self, independent_entities: list) -> list:
        """Get list of entities with foreign key dependencies"""
        return [
            entity['name'] for entity in self.config['entities'] 
            if entity['name'] not in independent_entities
        ]

    def _get_entity_config(self, entity_name: str) -> Dict[str, Any]:
        """Get configuration for a specific entity"""
        return next(e for e in self.config['entities'] if e['name'] == entity_name)

    def _create_entities(
        self,
        entity_config: Dict[str, Any],
        existing_entities: Optional[Dict[str, Dict[int, Dict[str, Any]]]] = None
    ) -> Dict[int, Dict[str, Any]]:
        """Create entities of a specific type"""
        entities = {}
        count = self.config['initial_population'][entity_config['name']]['count']
        
        distribution_config = self.config['initial_population'][entity_config['name']].get(
            'creation_time_distribution',
            {'type': 'uniform'}
        )
        
        time_distribution = self._get_time_distribution(distribution_config)
        creation_times = sorted([time_distribution() for _ in range(count)])
        
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
        dependent_attributes = []

        # Handle CreatedAt if defined
        if any(attr['name'] == 'CreatedAt' for attr in entity_config['attributes']):
            entity['CreatedAt'] = creation_time

        # Process all attributes
        for attr in entity_config['attributes']:
            if attr['name'] == 'id':
                continue

            if attr['name'] == 'CreatedAt':
                continue  # Already handled above

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

    def _get_time_distribution(self, distribution_config: Dict[str, Any]):
        """Get time distribution function based on configuration"""
        distribution_type = distribution_config['type']
        
        if distribution_type == 'uniform':
            return lambda: self.start_time + timedelta(
                seconds=random.uniform(
                    0,
                    (self.end_time - self.start_time).total_seconds()
                )
            )
        elif distribution_type == 'poisson':
            lambda_param = (self.end_time - self.start_time).total_seconds() / 86400
            return lambda: self.start_time + timedelta(
                days=random.expovariate(1/lambda_param)
            )
        else:
            raise ValueError(f"Unsupported time distribution type: {distribution_type}")


def generate_initial_entities(config: Dict[str, Any]) -> Dict[str, Dict[int, Dict[str, Any]]]:
    """Convenience function to generate initial entities"""
    generator = EntityGenerator(config)
    return generator.generate_initial_entities()