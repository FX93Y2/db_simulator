from faker import Faker
from typing import Any, Dict, Optional
import random
import logging
import string
from datetime import datetime, timedelta
from ..utils.distributions import get_distribution

logger = logging.getLogger(__name__)
fake = Faker()

class ValueGenerator:
    """Handle generation of attribute values based on configuration"""
    
    def __init__(self):
        self.fake = Faker()

    def generate_attribute_value(
        self,
        attr: Dict[str, Any],
        entity_config: Dict[str, Any],
        global_config: Dict[str, Any],
        entity: Optional[Dict[str, Any]] = None
    ) -> Any:
        """Generate a value for an attribute based on its configuration"""
        try:
            if 'generator' in attr:
                if attr['generator']['type'] == 'dependent':
                    return self._generate_dependent_value(attr, entity)
                return self._generate_from_generator(
                    attr['generator'],
                    entity_config,
                    global_config
                )
            elif 'choices' in attr or attr['type'] == 'choice':
                return self._generate_from_choices(attr, entity_config, global_config)
            else:
                return self._generate_default_value(attr['type'])
        except Exception as e:
            logger.error(f"Failed to generate value for attribute {attr.get('name', 'unknown')}: {str(e)}")
            raise

    def _generate_dependent_value(
        self,
        attr: Dict[str, Any],
        entity: Optional[Dict[str, Any]]
    ) -> Any:
        """Generate a value that depends on another attribute"""
        if not entity:
            raise ValueError("Entity is required for dependent value generation")

        dependency = attr['generator']['dependency']
        conditions = attr['generator']['conditions']
        
        dependent_value = entity.get(dependency)
        if dependent_value is None:
            raise ValueError(f"Dependent value '{dependency}' not found in entity")
        
        if dependent_value not in conditions:
            raise ValueError(f"No condition defined for {dependency} value: {dependent_value}")
        
        condition = conditions[dependent_value]
        distribution = get_distribution(condition)
        return distribution()

    def _generate_from_generator(
        self,
        generator_config: Dict[str, Any],
        entity_config: Dict[str, Any],
        global_config: Dict[str, Any]
    ) -> Any:
        """Generate a value using a specified generator"""
        generator_type = generator_config['type']
        
        if generator_type == 'faker':
            return self._generate_faker_value(generator_config)
        elif generator_type == 'choice':
            return random.choice(generator_config['choices'])
        elif generator_type in ['uniform', 'normal', 'exponential', 'poisson']:
            distribution = get_distribution(generator_config)
            return distribution()
        else:
            raise ValueError(f"Unknown generator type: {generator_type}")

    def _generate_faker_value(self, generator_config: Dict[str, Any]) -> Any:
        """Generate a value using Faker"""
        method = generator_config['method']
        
        if method == 'sentence':
            nb_words = generator_config.get('nb_words', 6)
            return self.fake.sentence(nb_words=nb_words)
        elif hasattr(self.fake, method):
            return getattr(self.fake, method)()
        else:
            raise ValueError(f"Unknown Faker method: {method}")

    def _generate_from_choices(
        self,
        attr_config: Dict[str, Any],
        entity_config: Dict[str, Any],
        global_config: Dict[str, Any]
    ) -> Any:
        """Generate a value from a list of choices"""
        entity_name = entity_config['name']
        attr_name = attr_config.get('name')
        
        if not attr_name:
            raise ValueError("Attribute name is required for choice generation")

        choices = attr_config.get('choices', [])
        if not choices:
            raise ValueError(f"No choices available for attribute {attr_name}")

        # Check for weighted distribution
        entity_initial_population = global_config['initial_population'].get(entity_name, {})
        entity_attributes = entity_initial_population.get('attributes', {})
        attr_distribution = entity_attributes.get(attr_name, {}).get('distribution')

        if attr_distribution and 'weights' in attr_distribution:
            return random.choices(choices, weights=attr_distribution['weights'])[0]
        
        return random.choice(choices)

    def _generate_default_value(self, attr_type: str) -> Any:
        """Generate a default value based on attribute type"""
        if attr_type == 'string':
            return ''.join(random.choices(
                string.ascii_letters + string.digits,
                k=10
            ))
        elif attr_type in ['int', 'integer']:
            return random.randint(0, 1000)
        elif attr_type == 'float':
            return random.uniform(0, 1000)
        elif attr_type == 'boolean':
            return random.choice([True, False])
        elif attr_type == 'datetime':
            return datetime.now() - timedelta(
                days=random.randint(0, 365)
            )
        else:
            raise ValueError(f"Unknown attribute type: {attr_type}")


# Create a singleton instance
value_generator = ValueGenerator()

def generate_attribute_value(
    attr: Dict[str, Any],
    entity_config: Dict[str, Any],
    global_config: Dict[str, Any],
    entity: Optional[Dict[str, Any]] = None
) -> Any:
    """Convenience function"""
    return value_generator.generate_attribute_value(
        attr,
        entity_config,
        global_config,
        entity
    )