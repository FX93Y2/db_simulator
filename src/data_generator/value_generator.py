import random
from faker import Faker
from ..utils.distributions import get_distribution

fake = Faker()

def generate_attribute_value(attr_config):
    if 'generator' in attr_config:
        generator_config = attr_config['generator']
        if generator_config['type'] == 'faker':
            return getattr(fake, generator_config['method'])()
        elif generator_config['type'] in ['uniform', 'normal', 'exponential', 'poisson']:
            dist = get_distribution(generator_config)
            return dist()
    elif 'choices' in attr_config:
        return random.choice(attr_config['choices'])
    elif attr_config['type'] == 'int':
        return random.randint(0, 100)  # Default for testing need customization function in config file
    elif attr_config['type'] == 'string':
        return fake.word()
    elif attr_config['type'] == 'float':
        return random.uniform(0, 100)  # Default