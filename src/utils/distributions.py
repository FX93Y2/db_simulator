import random
import numpy as np

def get_distribution(config):
    if config['type'] == 'uniform':
        return lambda: random.uniform(config['min'], config['max'])
    elif config['type'] == 'normal':
        return lambda: np.random.normal(config['mean'], config['std'])
    elif config['type'] == 'exponential':
        return lambda: np.random.exponential(1 / config['lambda'])
    elif config['type'] == 'poisson':
        return lambda: np.random.poisson(config['lambda'])
    else:
        raise ValueError(f"Unknown distribution type: {config['type']}")