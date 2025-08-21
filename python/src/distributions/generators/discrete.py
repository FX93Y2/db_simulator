"""
Discrete distribution generators.

Implements discrete probability distributions:
- DISC: Discrete distribution (choose from values with given probabilities)
- POIS: Poisson distribution
"""

import numpy as np
from typing import Optional, Union, List, Any


class DiscreteDistributions:
    """Static class containing all discrete distribution generators."""
    
    @staticmethod
    def discrete(values: List[Any], weights: Optional[List[float]] = None, 
                size: Optional[int] = None) -> Union[Any, List[Any]]:
        """
        DISC(p1, v1, p2, v2, ...) - Discrete distribution.
        
        Chooses values with specified probabilities.
        
        Args:
            values: List of possible values to choose from
            weights: List of probabilities for each value (must sum to 1.0)
            size: Number of samples to generate
            
        Returns:
            Random value(s) chosen from the discrete distribution
            
        Examples:
            >>> discrete(['A', 'B', 'C'], [0.5, 0.3, 0.2])
            'A'  # (with 50% probability)
            
            >>> discrete(['simple', 'complex'], [0.7, 0.3], size=5)
            ['simple', 'simple', 'complex', 'simple', 'simple']
        """
        if weights is not None:
            # Normalize weights to ensure they sum to 1.0
            weights = np.array(weights)
            weights = weights / np.sum(weights)
        
        result = np.random.choice(values, size=size, p=weights)
        
        # Handle single value case - np.random.choice returns numpy scalar
        # but we want to return the original type
        if size is None:
            if hasattr(result, 'item'):
                return result.item()
            return result
        
        return result.tolist()
    
    @staticmethod
    def poisson(lam: float, size: Optional[int] = None) -> Union[int, np.ndarray]:
        """
        POIS(lambda) - Poisson distribution.
        
        Args:
            lam: Lambda parameter (mean and variance of the distribution)
            size: Number of samples to generate
            
        Returns:
            Random value(s) from Poisson distribution
        """
        return np.random.poisson(lam, size)