"""
Utility functions for generating data from statistical distributions
"""

import numpy as np
import logging
from typing import Any, Dict, Optional, Union, List

logger = logging.getLogger(__name__)

def generate_from_distribution(dist_config: Dict[str, Any], size: Optional[int] = None) -> Union[float, List[float]]:
    """
    Generate random values from a statistical distribution
    
    Args:
        dist_config: Distribution configuration dictionary
        size: Number of values to generate (if None, returns a single value)
        
    Returns:
        Random value(s) from the distribution
    """
    dist_type = dist_config.get('type', 'uniform').lower()
    
    if dist_type == 'uniform':
        min_val = dist_config.get('min', 0)
        max_val = dist_config.get('max', 1)
        return np.random.uniform(min_val, max_val, size)
        
    elif dist_type == 'normal':
        mean = dist_config.get('mean', 0)
        stddev = dist_config.get('stddev', 1)
        min_val = dist_config.get('min', float('-inf'))
        max_val = dist_config.get('max', float('inf'))
        
        # Generate values and clamp them to the specified range
        values = np.random.normal(mean, stddev, size)
        return np.clip(values, min_val, max_val)
        
    elif dist_type == 'poisson':
        lam = dist_config.get('lambda', 1)
        return np.random.poisson(lam, size)
        
    elif dist_type == 'exponential':
        scale = dist_config.get('scale', 1)
        return np.random.exponential(scale, size)
        
    elif dist_type == 'fixed':
        value = dist_config.get('value', 0)
        if size is None:
            return value
        return np.full(size, value)
        
    elif dist_type == 'discrete':
        values = dist_config.get('values', [0])
        weights = dist_config.get('weights', None)
        return np.random.choice(values, size=size, p=weights)
        
    else:
        logger.warning(f"Unsupported distribution type: {dist_type}. Using uniform distribution.")
        return np.random.uniform(0, 1, size)
        
def round_if_needed(value: Union[float, np.ndarray]) -> Union[int, float, np.ndarray]:
    """
    Round values if they are very close to integers
    
    Args:
        value: Value or array to check for rounding
        
    Returns:
        Rounded value if close to an integer, otherwise the original value
    """
    if isinstance(value, np.ndarray):
        # For arrays, convert integers and near-integers
        integer_mask = np.isclose(value, np.round(value), rtol=1e-5, atol=1e-8)
        result = value.copy()
        result[integer_mask] = np.round(value[integer_mask])
        return result
    
    # For single values
    if np.isclose(value, round(value), rtol=1e-5, atol=1e-8):
        return int(round(value))
    return value