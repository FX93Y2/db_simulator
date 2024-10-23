import random
import numpy as np

def get_distribution(config):
    """Get a basic distribution function based on configuration"""
    if not isinstance(config, dict):
        raise ValueError(f"Expected dictionary for config, got {type(config)}")

    # Get distribution type from either 'type' or 'distribution' key
    distribution_type = config.get('type') or config.get('distribution')
    if not distribution_type:
        raise ValueError(f"No distribution type found in config: {config}")
    
    if distribution_type == 'uniform':
        min_val = float(config.get('min', 0))
        max_val = float(config.get('max', 1))
        return lambda: random.uniform(min_val, max_val)
        
    elif distribution_type == 'normal':
        mean = float(config.get('mean', 0))
        std = float(config.get('std', 1))
        return lambda: np.random.normal(mean, std)
        
    elif distribution_type == 'exponential':
        lambda_val = float(config.get('lambda', 1))
        return lambda: np.random.exponential(1 / lambda_val)
        
    elif distribution_type == 'poisson':
        lambda_val = float(config.get('lambda', 1))
        return lambda: np.random.poisson(lambda_val)
        
    elif distribution_type == 'choice':
        choices = config.get('choices', [])
        return lambda: random.choice(choices)
        
    elif distribution_type == 'constant':
        return lambda: config.get('value', 0)
        
    else:
        raise ValueError(f"Unknown distribution type: {distribution_type}")