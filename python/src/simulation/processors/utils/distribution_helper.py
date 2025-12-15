"""
Distribution configuration helper for simulation processors.

This module provides utility functions for extracting distribution configurations
from various YAML formats used across simulation steps.
"""

from typing import Union, Dict, Any, Tuple, Optional


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
    elif isinstance(config_value, (int, float)):
        # Constant value
        return {"type": "FIXED", "value": config_value}
    else:
        raise ValueError(f"Invalid distribution config format: {type(config_value)}. "
                       f"Expected string formula, dict, or numeric constant.")


def extract_distribution_config_with_time_unit(config_value: Union[str, Dict[str, Any]]) -> Tuple[Union[str, Dict[str, Any]], Optional[str]]:
    """
    Extract distribution configuration and time_unit from various formats.
    
    This enhanced helper function extracts both the distribution config and optional time_unit:
    - Direct formula string: "EXPO(2)" -> ("EXPO(2)", None)
    - Dict with formula and time_unit: {"formula": "EXPO(2)", "time_unit": "seconds"} -> ("EXPO(2)", "seconds")
    - Dict with distribution and time_unit: {"distribution": {...}, "time_unit": "hours"} -> ({...}, "hours")
    - Direct distribution dict without time_unit: {"type": "exponential", "scale": 2} -> ({...}, None)
    
    Args:
        config_value: Distribution configuration in any supported format
            
    Returns:
        Tuple of (distribution_config, time_unit)
        - distribution_config: Config suitable for generate_from_distribution()
        - time_unit: Time unit string if specified, None otherwise
        
    Raises:
        ValueError: If the config format is invalid
        
    Examples:
        >>> extract_distribution_config_with_time_unit("EXPO(2)")
        ("EXPO(2)", None)
        
        >>> extract_distribution_config_with_time_unit({"formula": "NORM(5, 1)", "time_unit": "hours"})
        ("NORM(5, 1)", "hours")
        
        >>> extract_distribution_config_with_time_unit({"distribution": {"type": "normal", "mean": 5}, "time_unit": "minutes"})
        ({"type": "normal", "mean": 5}, "minutes")
    """
    if isinstance(config_value, str):
        # Direct formula string - no time_unit
        return config_value, None
    elif isinstance(config_value, dict):
        # Extract time_unit if present
        time_unit = config_value.get('time_unit')
        
        # Check for formula field first (preferred new format)
        if 'formula' in config_value:
            return config_value['formula'], time_unit
        # Check for distribution field (nested dict format)
        elif 'distribution' in config_value:
            return config_value['distribution'], time_unit
        else:
            # Assume the dict itself is the distribution config (direct dict format)
            # But exclude time_unit from the distribution config
            dist_config = {k: v for k, v in config_value.items() if k != 'time_unit'}
            return dist_config, time_unit
    elif isinstance(config_value, (int, float)):
        # Constant value - no time_unit
        return {"type": "FIXED", "value": config_value}, None
    else:
        raise ValueError(f"Invalid distribution config format: {type(config_value)}. "
                       f"Expected string formula, dict, or numeric constant.")