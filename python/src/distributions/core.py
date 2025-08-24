"""
Core distribution generation system for DB Simulator.

📊 Continuous Distributions

BETA(min, mode, max, shape1, shape2) - Beta distribution.

ERLA(mean, k) - Erlang distribution.

EXPO(mean) - Exponential distribution.

GAMA(alpha, beta) - Gamma distribution.

LOGN(mean, sigma) - Lognormal distribution.

NORM(mean, stddev) - Normal distribution.

TRIA(min, mode, max) - Triangular distribution.

UNIF(min, max) - Uniform distribution (INCLUSIVE bounds).

WEIB(alpha, beta) - Weibull distribution.

📊 Discrete Distributions

DISC(p1, v1, p2, v2, …, pn, vn) - Discrete distribution, chooses value vi with probability pi.

POIS(mean) - Poisson distribution.

📊 Miscellaneous Functions

RAND() - Uniform random number between 0 and 1.
"""

import numpy as np
import logging
from typing import Any, Dict, Optional, Union, List

logger = logging.getLogger(__name__)


def generate_from_distribution(dist_config: Union[str, Dict[str, Any]], 
                              size: Optional[int] = None) -> Union[float, List[float]]:
    """
    Generate random values from a statistical distribution.
    
    Supports both formula strings and configuration dictionaries:
    - Formula: "UNIF(3, 10)" (inclusive bounds), "NORM(5, 1)", "DISC(0.7, 'A', 0.3, 'B')"  
    - Dict: {"type": "uniform", "min": 3, "max": 10}
    
    Args:
        dist_config: Distribution configuration (formula string or dictionary)
        size: Number of values to generate (if None, returns a single value)
        
    Returns:
        Random value(s) from the distribution
        
    Examples:
        >>> generate_from_distribution("UNIF(3, 10)")
        7.3  # Can generate any value from 3 to 10, inclusive
        
        >>> generate_from_distribution({"type": "uniform", "min": 3, "max": 10}, size=3)
        [4.1, 8.7, 5.9]  # All values between 3 and 10, inclusive
        
        >>> generate_from_distribution("DISC(0.7, 'simple', 0.3, 'complex')")
        'simple'
    """
    # Import here to avoid circular imports
    from .formula_parser import parse_distribution_formula
    from .registry import DistributionRegistry
    
    # Handle formula strings
    if isinstance(dist_config, str):
        try:
            dist_config = parse_distribution_formula(dist_config)
        except ValueError as e:
            logger.error(f"Error parsing distribution formula: {e}")
            raise
    
    # Extract distribution type
    dist_type = dist_config.get('type', 'uniform')
    
    # Use registry to generate values
    return DistributionRegistry.generate(dist_type, dist_config, size)


def round_if_needed(value: Union[float, np.ndarray]) -> Union[int, float, np.ndarray]:
    """
    Round values if they are very close to integers.
    
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