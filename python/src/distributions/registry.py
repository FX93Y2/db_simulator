"""
Distribution registry and factory.

Provides a centralized registry of all supported distributions and handles
the mapping between distribution names and their implementations.
Includes backward compatibility mappings for existing configuration formats.
"""

import logging
from typing import Dict, Any, Optional, Union, List
from .generators.continuous import ContinuousDistributions
from .generators.discrete import DiscreteDistributions
from .generators.special import SpecialDistributions

logger = logging.getLogger(__name__)


class DistributionRegistry:
    """Registry and factory for all supported probability distributions."""
    
    # Case variations - only for convenience
    ALIASES = {
        # Case variations of standard names
        'unif': 'UNIF',
        'norm': 'NORM',
        'expo': 'EXPO', 
        'pois': 'POIS',
        'disc': 'DISC',
        'tria': 'TRIA',
        'logn': 'LOGN',
        'gama': 'GAMA',
        'weib': 'WEIB',
        'erla': 'ERLA',
        'beta': 'BETA',
        'rand': 'RAND',
        'fixed': 'FIXED',
    }
    
    @classmethod
    def generate(cls, dist_type: str, config: Dict[str, Any], size: Optional[int] = None) -> Union[float, List[float]]:
        """
        Generate random values from a specified distribution.
        
        Args:
            dist_type: Distribution type name (supports aliases)
            config: Configuration dictionary with distribution parameters
            size: Number of values to generate
            
        Returns:
            Generated random value(s)
            
        Raises:
            ValueError: If distribution type is not supported
        """
        # Normalize distribution name
        normalized_type = cls._normalize_dist_type(dist_type)
        
        # Route to appropriate generator
        if normalized_type == 'UNIF':
            return ContinuousDistributions.uniform(
                config.get('min', 0), config.get('max', 1), size
            )
        
        elif normalized_type == 'NORM':
            return ContinuousDistributions.normal(
                config.get('mean', 0), config.get('stddev', 1), size,
                config.get('min', float('-inf')), config.get('max', float('inf'))
            )
        
        elif normalized_type == 'EXPO':
            # Handle both 'scale' and 'mean' parameter names
            scale = config.get('scale') or config.get('mean', 1)
            return ContinuousDistributions.exponential(scale, size)
        
        elif normalized_type == 'POIS':
            # Handle both 'lambda' and 'lam' parameter names
            lam = config.get('lambda') or config.get('lam', 1)
            return DiscreteDistributions.poisson(lam, size)
        
        elif normalized_type == 'TRIA':
            return ContinuousDistributions.triangular(
                config.get('min', 0), config.get('mode', 0.5), config.get('max', 1), size
            )
        
        elif normalized_type == 'BETA':
            return ContinuousDistributions.beta(
                config.get('min', 0), config.get('max', 1),
                config.get('shape1', 2), config.get('shape2', 2), size
            )
        
        elif normalized_type == 'GAMA':
            return ContinuousDistributions.gamma(
                config.get('alpha', 2), config.get('beta', 1), size
            )
        
        elif normalized_type == 'ERLA':
            return ContinuousDistributions.erlang(
                config.get('mean', 1), config.get('k', 2), size
            )
        
        elif normalized_type == 'LOGN':
            return ContinuousDistributions.lognormal(
                config.get('mean', 0), config.get('sigma', 1), size
            )
        
        elif normalized_type == 'WEIB':
            return ContinuousDistributions.weibull(
                config.get('alpha', 1), config.get('beta', 1), size
            )
        
        elif normalized_type == 'DISC':
            return DiscreteDistributions.discrete(
                config.get('values', [0]), config.get('weights'), size
            )
        
        elif normalized_type == 'RAND':
            return SpecialDistributions.rand(size)
        
        elif normalized_type == 'FIXED':
            return SpecialDistributions.fixed(config.get('value', 0), size)
        
        else:
            raise ValueError(f"Unsupported distribution type: {dist_type}")
    
    @classmethod
    def _normalize_dist_type(cls, dist_type: str) -> str:
        """
        Normalize distribution type name to standard form.
        
        Args:
            dist_type: Distribution type (may be alias)
            
        Returns:
            Normalized distribution type name
        """
        # Try exact match first
        if dist_type in cls.ALIASES:
            return cls.ALIASES[dist_type]
        
        # Try case-insensitive match
        lower_type = dist_type.lower()
        if lower_type in cls.ALIASES:
            return cls.ALIASES[lower_type]
        
        # Try uppercase (standard form)
        upper_type = dist_type.upper()
        if upper_type in ['UNIF', 'NORM', 'EXPO', 'POIS', 'TRIA', 'BETA', 
                         'GAMA', 'ERLA', 'LOGN', 'WEIB', 'DISC', 'RAND', 'FIXED']:
            return upper_type
        
        # If no match found, return original (will cause error in generate())
        return dist_type
    
    @classmethod 
    def get_supported_distributions(cls) -> List[str]:
        """
        Get list of all supported distribution names (standard forms).
        
        Returns:
            List of standard distribution names
        """
        return ['UNIF', 'NORM', 'EXPO', 'POIS', 'TRIA', 'BETA', 
                'GAMA', 'ERLA', 'LOGN', 'WEIB', 'DISC', 'RAND', 'FIXED']
    
    @classmethod
    def get_aliases(cls) -> Dict[str, str]:
        """
        Get mapping of all aliases to standard names.
        
        Returns:
            Dictionary mapping aliases to standard names
        """
        return cls.ALIASES.copy()
    
    @classmethod
    def is_supported(cls, dist_type: str) -> bool:
        """
        Check if a distribution type is supported.
        
        Args:
            dist_type: Distribution type name to check
            
        Returns:
            True if supported, False otherwise
        """
        try:
            normalized = cls._normalize_dist_type(dist_type)
            return normalized in cls.get_supported_distributions()
        except:
            return False