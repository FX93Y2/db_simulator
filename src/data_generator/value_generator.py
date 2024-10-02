from faker import Faker
from ..utils.distributions import get_distribution
import random
import logging

fake = Faker()
logger = logging.getLogger(__name__)

def generate_attribute_value(attr_config, entity_config, global_config):
    if 'generator' in attr_config:
        return generate_from_generator(attr_config['generator'])
    elif 'choices' in attr_config or attr_config['type'] == 'choice':
        return generate_from_choices(attr_config, entity_config, global_config)
    else:
        return generate_default_value(attr_config['type'])

def generate_from_generator(generator_config):
    if generator_config['type'] == 'faker':
        return generate_faker_value(generator_config)
    elif generator_config['type'] in ['uniform', 'normal', 'exponential', 'poisson']:
        dist = get_distribution(generator_config)
        return dist()
    else:
        raise ValueError(f"Unknown generator type: {generator_config['type']}")

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
    if attr_type == 'int':
        return fake.random_int(0, 100)
    elif attr_type == 'float':
        return fake.pyfloat(left_digits=3, right_digits=2, positive=True)
    elif attr_type == 'string':
        return fake.word()
    else:
        raise ValueError(f"Unknown attribute type: {attr_type}")