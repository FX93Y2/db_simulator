"""
Special distribution generators.

Implements special-purpose distributions and functions:
- RAND: Random uniform [0,1]
- FIXED: Fixed constant value (not technically a distribution)
"""

import numpy as np
from typing import Optional, Union, Any


class SpecialDistributions:
    """Static class containing special distribution generators and functions."""
    
    @staticmethod
    def rand(size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        RAND() - Uniform random number between 0 and 1.
        
        Args:
            size: Number of samples to generate
            
        Returns:
            Random value(s) uniformly distributed in [0, 1]
        """
        return np.random.uniform(0, 1, size)
    
    @staticmethod
    def fixed(value: Any, size: Optional[int] = None) -> Union[Any, np.ndarray]:
        """
        FIXED(value) - Fixed constant value.
        
        Not technically a distribution, but useful for configuration.
        
        Args:
            value: The constant value to return
            size: Number of samples to generate (all will be the same value)
            
        Returns:
            The fixed value, or an array of the fixed value
        """
        if size is None:
            return value
        return np.full(size, value)