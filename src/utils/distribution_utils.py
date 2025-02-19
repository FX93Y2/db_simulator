from typing import List, Dict, Any, Optional
import numpy as np
import logging

logger = logging.getLogger(__name__)

def _normalize_distribution_type(dist_type: str) -> str:
    """Normalize distribution type string to handle common typos"""
    dist_type = dist_type.lower().strip()
    
    # Map of common typos to correct values
    typo_map = {
        'choic': 'choice',
        'normal': 'normal',
        'gaussian': 'normal',
        'poisson': 'poisson',
        'pois': 'poisson'
    }
    
    return typo_map.get(dist_type, dist_type)

def generate_from_distribution(distribution_config: Dict[str, Any], size: Optional[int] = None) -> Any:
    """Generate values from a statistical distribution based on configuration"""
    if not isinstance(distribution_config, dict):
        raise ValueError(f"Invalid distribution configuration: {distribution_config}")
        
    dist_type = _normalize_distribution_type(distribution_config['type'])
    
    try:
        if dist_type == 'normal':
            return np.random.normal(
                loc=distribution_config.get('mean', 0),
                scale=distribution_config.get('std', 1),
                size=size
            )
        
        elif dist_type == 'poisson':
            return np.random.poisson(
                lam=distribution_config.get('rate', 1),
                size=size
            )
        
        elif dist_type == 'choice':
            values = distribution_config.get('values', [])
            if not values:
                raise ValueError("Choice distribution requires 'values' parameter")
                
            weights = distribution_config.get('weights')
            if weights:
                weights = np.array(weights) / np.sum(weights)  # Normalize weights
            
            return np.random.choice(
                values,
                size=size,
                p=weights
            )
        
        else:
            raise ValueError(f"Unsupported distribution type: {dist_type}")
            
    except KeyError as e:
        logger.error(f"Missing required parameter for distribution {dist_type}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error generating values for distribution {dist_type}: {e}")
        raise

def round_if_needed(value: Any) -> Any:
    """Round numeric values if they need to be integers"""
    if isinstance(value, np.ndarray):
        if np.issubdtype(value.dtype, np.floating):
            return np.round(value).astype(int)
    elif isinstance(value, float):
        return round(value)
    return value