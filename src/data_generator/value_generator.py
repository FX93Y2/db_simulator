from faker import Faker
from ..utils.distributions import get_distribution

fake = Faker()

def generate_attribute_value(attr_config, entities=None):
    if 'generator' in attr_config:
        generator_config = attr_config['generator']
        if generator_config['type'] == 'faker':
            return getattr(fake, generator_config['method'])()
        elif generator_config['type'] in ['uniform', 'normal', 'exponential', 'poisson']:
            dist = get_distribution(generator_config)
            return dist()
    elif attr_config['type'] == 'int':
        return fake.random_int(0, 100) # Default value for testing, need customization
    elif attr_config['type'] == 'float':
        return fake.pyfloat(left_digits=3, right_digits=2, positive=True)
    elif attr_config['type'] == 'string':
        return fake.word()
    else:
        raise ValueError(f"Unknown attribute type: {attr_config['type']}")