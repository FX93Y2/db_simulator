from faker import Faker
from ..utils.distributions import get_distribution
import random
import logging
from datetime import datetime, timedelta
import string
fake = Faker()
logger = logging.getLogger(__name__)

def generate_attribute_value(attr, entity_config, global_config, entity=None):
    if 'generator' in attr:
        if attr['generator']['type'] == 'dependent':
            return generate_dependent_value(attr, entity)
        else:
            return generate_from_generator(attr['generator'], entity_config, global_config)
    elif 'choices' in attr or attr['type'] == 'choice':
        return generate_from_choices(attr, entity_config, global_config)
    else:
        return generate_default_value(attr['type'])

def generate_dependent_value(attr, entity):
    if entity is None:
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

def generate_from_generator(generator_config, entity_config, global_config):
    generator_type = generator_config['type']
    if generator_type == 'faker':
        return generate_faker_value(generator_config)
    elif generator_type == 'choice':
        return random.choice(generator_config['choices'])
    elif generator_type in ['uniform', 'normal', 'exponential', 'poisson']:
        distribution = get_distribution(generator_config)
        return distribution()
    else:
        raise ValueError(f"Unknown generator type: {generator_type}")

def generate_faker_value(generator_config):
    method = generator_config['method']
    if method == 'sentence':
        nb_words = generator_config.get('nb_words', 6)
        return fake.sentence(nb_words=nb_words)
    elif hasattr(fake, method):
        return getattr(fake, method)()
    else:
        raise ValueError(f"Unknown Faker method: {method}")

def generate_from_choices(attr_config, entity_config, global_config):
    entity_name = entity_config['name']
    attr_name = attr_config.get('name')
    
    if not attr_name:
        logger.error(f"Attribute name missing in config: {attr_config}")
        raise ValueError("Attribute name is required for choice generation")

    choices = attr_config.get('choices', [])
    
    if not choices:
        logger.error(f"No choices available for attribute {attr_name} in entity {entity_name}")
        raise ValueError(f"No choices available for attribute {attr_name}")

    entity_initial_population = global_config['initial_population'].get(entity_name, {})
    entity_attributes = entity_initial_population.get('attributes', {})
    attr_distribution = entity_attributes.get(attr_name, {}).get('distribution')

    if attr_distribution:
        weights = attr_distribution.get('weights', [])
        if weights:
            return random.choices(choices, weights=weights)[0]
    
    return random.choice(choices)


def generate_default_value(attr_type):
    if attr_type == 'string':
        return ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    elif attr_type == 'int' or attr_type == 'integer':
        return random.randint(0, 1000)
    elif attr_type == 'float':
        return random.uniform(0, 1000)
    elif attr_type == 'boolean':
        return random.choice([True, False])
    elif attr_type == 'datetime':
        # Generate a random datetime within the last year
        return datetime.now() - timedelta(days=random.randint(0, 365))
    else:
        raise ValueError(f"Unknown attribute type: {attr_type}")