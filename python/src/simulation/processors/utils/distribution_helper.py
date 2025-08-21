"""
Distribution configuration helper for simulation processors.

This module provides utility functions for extracting distribution configurations
from various YAML formats used across simulation steps.
"""

from typing import Union, Dict, Any


def extract_distribution_config(config_value: Union[str, Dict[str, Any]]) -> Union[str, Dict[str, Any]]:
    """
    Extract distribution configuration from various formats for use with generate_from_distribution().
    
    This shared helper function handles all the different ways distributions can be specified:
    - Direct formula string: "EXPO(2)", "NORM(5, 1)"
    - Dict with 'formula' key: {"formula": "EXPO(2)"}
    - Dict with 'distribution' key: {"distribution": {"type": "exponential", "scale": 2}}
    - Direct distribution dict: {"type": "exponential", "scale": 2}
    
    Args:
        config_value: Distribution configuration in any supported format
            
    Returns:
        Distribution config suitable for generate_from_distribution()
        
    Raises:
        ValueError: If the config format is invalid
        
    Examples:
        >>> extract_distribution_config("EXPO(2)")
        "EXPO(2)"
        
        >>> extract_distribution_config({"formula": "NORM(5, 1)"})
        "NORM(5, 1)"
        
        >>> extract_distribution_config({"distribution": {"type": "normal", "mean": 5, "stddev": 1}})
        {"type": "normal", "mean": 5, "stddev": 1}
        
        >>> extract_distribution_config({"type": "uniform", "min": 3, "max": 10})
        {"type": "uniform", "min": 3, "max": 10}
    """
    if isinstance(config_value, str):
        # Direct formula string - pass through
        return config_value
    elif isinstance(config_value, dict):
        # Check for formula field first (preferred new format)
        if 'formula' in config_value:
            return config_value['formula']
        # Check for distribution field (nested dict format)
        elif 'distribution' in config_value:
            return config_value['distribution']
        else:
            # Assume the dict itself is the distribution config (direct dict format)
            return config_value
    else:
        raise ValueError(f"Invalid distribution config format: {type(config_value)}. "
                       f"Expected string formula or dict with 'formula'/'distribution' keys.")