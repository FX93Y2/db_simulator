import re
import random
import numpy as np
from typing import Any, Dict, Callable, Union
import logging

logger = logging.getLogger(__name__)

DISTRIBUTION_PATTERNS = {
    'NORM': r'NORM\((?P<mean>-?\d+\.?\d*),\s*(?P<std>\d+\.?\d*)\)',
    'EXPO': r'EXPO\((?P<mean>\d+\.?\d*)\)',
    'TRIA': r'TRIA\((?P<min>\d+\.?\d*),\s*(?P<mode>\d+\.?\d*),\s*(?P<max>\d+\.?\d*)\)',
    'UNIF': r'UNIF\((?P<min>\d+\.?\d*),\s*(?P<max>\d+\.?\d*)\)',
    'POIS': r'POIS\((?P<mean>\d+\.?\d*)\)',
    'CONS': r'CONS\((?P<value>-?\d+\.?\d*)\)',
    'DISC': r'DISC\((?P<values>[\d\.,\s]+)\)', 
    # Alternative names
    'UNIFORM': r'UNIF\((?P<min>\d+\.?\d*),\s*(?P<max>\d+\.?\d*)\)',
    'NORMAL': r'NORM\((?P<mean>-?\d+\.?\d*),\s*(?P<std>\d+\.?\d*)\)',
    'EXPONENTIAL': r'EXPO\((?P<mean>\d+\.?\d*)\)',
    'TRIANGULAR': r'TRIA\((?P<min>\d+\.?\d*),\s*(?P<mode>\d+\.?\d*),\s*(?P<max>\d+\.?\d*)\)',
    'POISSON': r'POIS\((?P<mean>\d+\.?\d*)\)',
    'CONSTANT': r'CONS\((?P<value>-?\d+\.?\d*)\)',
    'DISCRETE': r'DISC\((?P<values>[\d\.,\s]+)\)' 
}

def parse_distribution_string(dist_str: str) -> Dict[str, Any]:
    """Parse Arena-style distribution string into distribution parameters"""
    dist_str = dist_str.strip().upper()
    
    for dist_type, pattern in DISTRIBUTION_PATTERNS.items():
        match = re.match(pattern, dist_str)
        if match:
            params = match.groupdict()
            
            # Special handling for DISC distribution
            if dist_type in ['DISC', 'DISCRETE']:
                values = [float(x.strip()) for x in params['values'].split(',')]
                return {
                    'distribution': 'discrete',
                    'cumulative_probabilities': values
                }
            
            # Convert other parameters to float
            params = {k: float(v) for k, v in params.items()}
            
            # Map to standard distribution format
            if dist_type in ['NORM', 'NORMAL']:
                return {
                    'distribution': 'normal',
                    'mean': params['mean'],
                    'std': params['std']
                }
            elif dist_type in ['EXPO', 'EXPONENTIAL']:
                return {
                    'distribution': 'exponential',
                    'mean': params['mean']
                }
            elif dist_type in ['TRIA', 'TRIANGULAR']:
                return {
                    'distribution': 'triangular',
                    'min': params['min'],
                    'mode': params['mode'],
                    'max': params['max']
                }
            elif dist_type in ['UNIF', 'UNIFORM']:
                return {
                    'distribution': 'uniform',
                    'min': params['min'],
                    'max': params['max']
                }
            elif dist_type in ['POIS', 'POISSON']:
                return {
                    'distribution': 'poisson',
                    'mean': params['mean']
                }
            elif dist_type in ['CONS', 'CONSTANT']:
                return {
                    'distribution': 'constant',
                    'value': params['value']
                }
    
    raise ValueError(f"Invalid distribution format: {dist_str}")

def get_distribution(config: Union[str, Dict[str, Any], int, float]) -> Callable[[], float]:
    """Get a distribution function based on configuration"""
    try:
        # Parse string config
        if isinstance(config, str):
            config = parse_distribution_string(config)
        elif isinstance(config, (int, float)):
            config = {'distribution': 'constant', 'value': float(config)}
        elif not isinstance(config, dict):
            raise ValueError(f"Invalid distribution configuration type: {type(config)}")
        
        distribution_type = config.get('distribution', '').lower()
        
        if distribution_type == 'normal':
            mean = float(config.get('mean', config.get('loc', 0)))
            std = float(config.get('std', config.get('scale', 1)))
            return lambda: float(np.random.normal(mean, std))
            
        elif distribution_type == 'uniform':
            min_val = float(config.get('min', 0))
            max_val = float(config.get('max', 1))
            return lambda: float(np.random.uniform(min_val, max_val))
            
        elif distribution_type == 'exponential':
            mean = float(config.get('mean', 1))
            return lambda: float(np.random.exponential(mean))
            
        elif distribution_type == 'triangular':
            min_val = float(config.get('min', 0))
            mode = float(config.get('mode'))
            max_val = float(config.get('max', 1))
            return lambda: float(np.random.triangular(min_val, mode, max_val))
            
        elif distribution_type == 'poisson':
            mean = float(config.get('mean', config.get('lambda', 1)))
            return lambda: float(np.random.poisson(mean))
            
        elif distribution_type == 'discrete':
            cum_probs = config['cumulative_probabilities']
            # Validate probabilities
            if not (0.99 <= sum(cum_probs) <= 1.01): 
                raise ValueError(
                    f"Probabilities must sum to 1.0, got {sum(cum_probs)} from {cum_probs}"
                )
            
            def discrete_sampler():
                r = random.random() 
                cumulative = 0
                for i, prob in enumerate(cum_probs):
                    cumulative += prob
                    if r <= cumulative:
                        return float(i) 
                return float(len(cum_probs) - 1)
            return discrete_sampler
            
        elif distribution_type == 'constant':
            value = float(config.get('value', 0))
            return lambda: value
            
        else:
            raise ValueError(f"Unknown distribution type: {distribution_type}")
            
    except Exception as e:
        logger.error(f"Error creating distribution: {str(e)}")
        raise

def format_distribution(config: Dict[str, Any]) -> str:
    """Format distribution configuration as Arena-style string"""
    dist_type = config['distribution'].upper()
    
    if dist_type in ['NORMAL', 'NORM']:
        return f"NORM({config['mean']}, {config['std']})"
    elif dist_type in ['EXPONENTIAL', 'EXPO']:
        return f"EXPO({config['mean']})"
    elif dist_type in ['TRIANGULAR', 'TRIA']:
        return f"TRIA({config['min']}, {config['mode']}, {config['max']})"
    elif dist_type in ['UNIFORM', 'UNIF']:
        return f"UNIF({config['min']}, {config['max']})"
    elif dist_type in ['POISSON', 'POIS']:
        return f"POIS({config['mean']})"
    elif dist_type in ['CONSTANT', 'CONS']:
        return f"CONS({config['value']})"
    elif dist_type == 'DISCRETE':
        probs = ', '.join(str(p) for p in config['cumulative_probabilities'])
        return f"DISC({probs})"
    else:
        raise ValueError(f"Unknown distribution type: {dist_type}")

# Example usages in docstring
"""
Examples:
    >>> dist = get_distribution("NORM(100, 10)")
    >>> dist = get_distribution("EXPO(30)")
    >>> dist = get_distribution("TRIA(10, 20, 30)")
    >>> dist = get_distribution("UNIF(0, 100)")
    >>> dist = get_distribution("POIS(5)")
    >>> dist = get_distribution("CONS(42)")
    
    # Dictionary format (still supported)
    >>> dist = get_distribution({
    ...     'distribution': 'normal',
    ...     'mean': 100,
    ...     'std': 10
    ... })
"""
