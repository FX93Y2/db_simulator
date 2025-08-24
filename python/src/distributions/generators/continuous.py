"""
Continuous distribution generators.

Implements all continuous probability distributions used in discrete event simulation:
- BETA: Beta distribution
- ERLA: Erlang distribution  
- EXPO: Exponential distribution
- GAMA: Gamma distribution
- LOGN: Lognormal distribution
- NORM: Normal distribution
- TRIA: Triangular distribution
- UNIF: Uniform distribution
- WEIB: Weibull distribution
"""

import numpy as np
from typing import Optional, Union


class ContinuousDistributions:
    """Static class containing all continuous distribution generators."""
    
    @staticmethod
    def uniform(min_val: float, max_val: float, size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        UNIF(min, max) - Uniform distribution (INCLUSIVE of both bounds).
        
        Generates values in [min, max] inclusive.
        
        IMPORTANT: This distribution is inclusive of BOTH min and max values.
        For example, UNIF(1, 40) can generate any value from 1 to 40, including both 1 and 40.
        
        Args:
            min_val: Minimum value (inclusive)
            max_val: Maximum value (inclusive)
            size: Number of samples to generate
            
        Returns:
            Random value(s) from uniform distribution [min, max] inclusive
        """
        # For integer bounds, use randint which is inclusive
        if isinstance(min_val, (int, np.integer)) and isinstance(max_val, (int, np.integer)):
            if size is None:
                return np.random.randint(min_val, max_val + 1)
            else:
                return np.random.randint(min_val, max_val + 1, size=size)
        else:
            # For floats, add small epsilon to include max
            epsilon = np.nextafter(max_val, max_val + 1) - max_val
            return np.random.uniform(min_val, max_val + epsilon, size)
    
    @staticmethod
    def normal(mean: float, stddev: float, size: Optional[int] = None, 
               min_val: float = float('-inf'), max_val: float = float('inf')) -> Union[float, np.ndarray]:
        """
        NORM(mean, stddev) - Normal distribution.
        
        Args:
            mean: Mean of the distribution
            stddev: Standard deviation
            size: Number of samples to generate
            min_val: Minimum value (for clamping)
            max_val: Maximum value (for clamping)
            
        Returns:
            Random value(s) from normal distribution, optionally clamped
        """
        values = np.random.normal(mean, stddev, size)
        return np.clip(values, min_val, max_val)
    
    @staticmethod
    def exponential(scale: float, size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        EXPO(mean) - Exponential distribution.
        
        Args:
            scale: Scale parameter (same as mean for exponential)
            size: Number of samples to generate
            
        Returns:
            Random value(s) from exponential distribution
        """
        return np.random.exponential(scale, size)
    
    @staticmethod
    def beta(min_val: float, max_val: float, shape1: float, shape2: float, 
             size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        BETA(min, max, shape1, shape2) - Beta distribution scaled to [min, max].
        
        Args:
            min_val: Minimum value of scaled distribution
            max_val: Maximum value of scaled distribution  
            shape1: First shape parameter (alpha)
            shape2: Second shape parameter (beta)
            size: Number of samples to generate
            
        Returns:
            Random value(s) from scaled beta distribution
        """
        beta_vals = np.random.beta(shape1, shape2, size)
        return min_val + beta_vals * (max_val - min_val)
    
    @staticmethod
    def gamma(alpha: float, beta: float, size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        GAMA(alpha, beta) - Gamma distribution.
        
        Args:
            alpha: Shape parameter
            beta: Scale parameter
            size: Number of samples to generate
            
        Returns:
            Random value(s) from gamma distribution
        """
        return np.random.gamma(alpha, beta, size)
    
    @staticmethod  
    def erlang(mean: float, k: int, size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        ERLA(mean, k) - Erlang distribution.
        
        Erlang is a special case of Gamma with integer shape parameter.
        
        Args:
            mean: Mean of the distribution
            k: Number of stages (integer shape parameter)
            size: Number of samples to generate
            
        Returns:
            Random value(s) from Erlang distribution
        """
        # For Erlang: shape = k, scale = mean/k
        scale = mean / k
        return np.random.gamma(k, scale, size)
    
    @staticmethod
    def lognormal(mean: float, sigma: float, size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        LOGN(mean, sigma) - Lognormal distribution.
        
        Args:
            mean: Mean of underlying normal distribution
            sigma: Standard deviation of underlying normal distribution
            size: Number of samples to generate
            
        Returns:
            Random value(s) from lognormal distribution
        """
        return np.random.lognormal(mean, sigma, size)
    
    @staticmethod
    def triangular(min_val: float, mode: float, max_val: float, 
                   size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        TRIA(min, mode, max) - Triangular distribution.
        
        Args:
            min_val: Minimum value
            mode: Mode (most likely value)  
            max_val: Maximum value
            size: Number of samples to generate
            
        Returns:
            Random value(s) from triangular distribution
        """
        return np.random.triangular(min_val, mode, max_val, size)
    
    @staticmethod
    def weibull(alpha: float, beta: float, size: Optional[int] = None) -> Union[float, np.ndarray]:
        """
        WEIB(alpha, beta) - Weibull distribution.
        
        Args:
            alpha: Shape parameter
            beta: Scale parameter
            size: Number of samples to generate
            
        Returns:
            Random value(s) from Weibull distribution
        """
        return beta * np.random.weibull(alpha, size)