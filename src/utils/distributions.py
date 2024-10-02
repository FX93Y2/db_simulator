import random
import numpy as np

def get_distribution(config):
    if not isinstance(config, dict):
        raise ValueError(f"Expected dictionary for config, got {type(config)}")

    distribution_type = config.get('type')
    
    if distribution_type == 'uniform':
        return lambda: random.uniform(config['min'], config['max'])
    elif distribution_type == 'normal':
        return lambda: np.random.normal(config['mean'], config['std'])
    elif distribution_type == 'exponential':
        return lambda: np.random.exponential(1 / config['lambda'])
    elif distribution_type == 'poisson':
        return lambda: np.random.poisson(config['lambda'])
    elif distribution_type == 'constant' or distribution_type is None:
        return lambda: config.get('value', 0)
    else:
        raise ValueError(f"Unknown distribution type: {distribution_type}")