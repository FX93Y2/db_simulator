"""
Formula parser for distribution specifications.

Parses formula strings like:
- "UNIF(3, 10)" → uniform distribution
- "NORM(5, 1)" → normal distribution  
- "DISC(0.7, 'simple', 0.3, 'complex')" → discrete distribution
- "TRIA(1, 3, 7)" → triangular distribution
- "RAND()" → random uniform [0,1]

The parser converts formula strings into configuration dictionaries
that can be used with the distribution generation system.
"""

import re
import ast
import logging
from typing import Dict, Any, List, Union

logger = logging.getLogger(__name__)


def parse_distribution_formula(formula: str) -> Dict[str, Any]:
    """
    Parse a distribution formula string into a configuration dictionary.
    
    Args:
        formula: Formula string like "UNIF(3, 10)" or "DISC(0.7, 'A', 0.3, 'B')"
        
    Returns:
        Dictionary configuration for the distribution
        
    Raises:
        ValueError: If formula syntax is invalid
        
    Examples:
        >>> parse_distribution_formula("UNIF(3, 10)")
        {"type": "UNIF", "min": 3, "max": 10}
        
        >>> parse_distribution_formula("NORM(5, 1)")
        {"type": "NORM", "mean": 5, "stddev": 1}
        
        >>> parse_distribution_formula("DISC(0.7, 'simple', 0.3, 'complex')")
        {"type": "DISC", "values": ["simple", "complex"], "weights": [0.7, 0.3]}
    """
    formula = formula.strip()
    
    # Match distribution name and parameters
    match = re.match(r'^([A-Z]+)\s*\((.*)\)$', formula)
    if not match:
        raise ValueError(f"Invalid formula syntax: {formula}")
    
    dist_name = match.group(1)
    params_str = match.group(2).strip()
    
    # Parse parameters
    params = []
    if params_str:
        params = _parse_parameters(params_str)
    
    # Convert to configuration based on distribution type
    return _convert_to_config(dist_name, params)


def _parse_parameters(params_str: str) -> List[Union[float, int, str]]:
    """
    Parse parameter string into a list of values.
    
    Handles numbers, strings, and quoted strings properly.
    """
    params = []
    
    # Split by commas, but respect quoted strings
    parts = _split_respecting_quotes(params_str)
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
            
        try:
            # Try to parse as a literal (handles numbers, strings, etc.)
            value = ast.literal_eval(part)
            params.append(value)
        except (ValueError, SyntaxError):
            # If literal_eval fails, treat as unquoted string
            params.append(part)
    
    return params


def _split_respecting_quotes(s: str) -> List[str]:
    """
    Split a string by commas, but don't split inside quoted strings.
    """
    parts = []
    current = []
    in_quotes = False
    quote_char = None
    
    i = 0
    while i < len(s):
        char = s[i]
        
        if char in ('"', "'") and not in_quotes:
            in_quotes = True
            quote_char = char
            current.append(char)
        elif char == quote_char and in_quotes:
            in_quotes = False
            quote_char = None
            current.append(char)
        elif char == ',' and not in_quotes:
            parts.append(''.join(current))
            current = []
        else:
            current.append(char)
        
        i += 1
    
    if current:
        parts.append(''.join(current))
    
    return parts


def _convert_to_config(dist_name: str, params: List[Union[float, int, str]]) -> Dict[str, Any]:
    """
    Convert distribution name and parameters to configuration dictionary.
    """
    dist_name = dist_name.upper()
    
    if dist_name == 'UNIF':
        if len(params) != 2:
            raise ValueError(f"UNIF requires 2 parameters (min, max), got {len(params)}")
        return {"type": "UNIF", "min": params[0], "max": params[1]}
    
    elif dist_name == 'NORM':
        if len(params) != 2:
            raise ValueError(f"NORM requires 2 parameters (mean, stddev), got {len(params)}")
        return {"type": "NORM", "mean": params[0], "stddev": params[1]}
    
    elif dist_name == 'EXPO':
        if len(params) != 1:
            raise ValueError(f"EXPO requires 1 parameter (mean), got {len(params)}")
        # Note: numpy.random.exponential uses scale, not mean
        return {"type": "EXPO", "scale": params[0]}
    
    elif dist_name == 'POIS':
        if len(params) != 1:
            raise ValueError(f"POIS requires 1 parameter (lambda), got {len(params)}")
        return {"type": "POIS", "lambda": params[0]}
    
    elif dist_name == 'TRIA':
        if len(params) != 3:
            raise ValueError(f"TRIA requires 3 parameters (min, mode, max), got {len(params)}")
        return {"type": "TRIA", "min": params[0], "mode": params[1], "max": params[2]}
    
    elif dist_name == 'BETA':
        if len(params) not in (2, 5):
            raise ValueError(f"BETA requires 2 parameters (shape1, shape2) or 5 parameters (min, mode, max, shape1, shape2), got {len(params)}")
        
        if len(params) == 2:
            # Standard beta [0,1]
            return {"type": "BETA", "min": 0, "max": 1, "shape1": params[0], "shape2": params[1]}
        else:
            # Scaled beta
            return {"type": "BETA", "min": params[0], "mode": params[1], "max": params[2], 
                   "shape1": params[3], "shape2": params[4]}
    
    elif dist_name == 'GAMA':
        if len(params) != 2:
            raise ValueError(f"GAMA requires 2 parameters (alpha, beta), got {len(params)}")
        return {"type": "GAMA", "alpha": params[0], "beta": params[1]}
    
    elif dist_name == 'ERLA':
        if len(params) != 2:
            raise ValueError(f"ERLA requires 2 parameters (mean, k), got {len(params)}")
        return {"type": "ERLA", "mean": params[0], "k": int(params[1])}
    
    elif dist_name == 'LOGN':
        if len(params) != 2:
            raise ValueError(f"LOGN requires 2 parameters (mean, sigma), got {len(params)}")
        return {"type": "LOGN", "mean": params[0], "sigma": params[1]}
    
    elif dist_name == 'WEIB':
        if len(params) != 2:
            raise ValueError(f"WEIB requires 2 parameters (alpha, beta), got {len(params)}")
        return {"type": "WEIB", "alpha": params[0], "beta": params[1]}
    
    elif dist_name == 'DISC':
        if len(params) < 2 or len(params) % 2 != 0:
            raise ValueError(f"DISC requires even number of parameters (p1, v1, p2, v2, ...), got {len(params)}")
        
        # Try standard order: (weight, value, weight, value...)
        weights1 = []
        values1 = []
        weights1_valid = True
        weights1_sum = 0
        
        for i in range(0, len(params), 2):
            w = params[i]
            if not isinstance(w, (int, float)):
                weights1_valid = False
                break
            weights1.append(w)
            weights1_sum += w
            values1.append(params[i + 1])
            
        # Try swapped order: (value, weight, value, weight...)
        weights2 = []
        values2 = []
        weights2_valid = True
        weights2_sum = 0
        
        for i in range(0, len(params), 2):
            w = params[i + 1]
            if not isinstance(w, (int, float)):
                weights2_valid = False
                break
            weights2.append(w)
            weights2_sum += w
            values2.append(params[i])

        # Decide which order to use
        # 1. If standard works and sums to approx 1.0, use it.
        # 2. If standard is invalid but swapped is valid, use swapped.
        # 3. If both valid, prefer the one closer to 1.0 sum.
        # 4. Fallback to standard if both doubtful (will likely fail later but consistent behavior).
        
        use_swapped = False
        
        if weights1_valid and abs(weights1_sum - 1.0) < 0.01:
            use_swapped = False
        elif weights2_valid and abs(weights2_sum - 1.0) < 0.01:
            use_swapped = True
        elif not weights1_valid and weights2_valid:
            use_swapped = True
        elif weights1_valid and weights2_valid:
            # Both valid numbers, pick closest to 1.0
            diff1 = abs(weights1_sum - 1.0)
            diff2 = abs(weights2_sum - 1.0)
            use_swapped = diff2 < diff1
        
        if use_swapped:
            return {"type": "DISC", "values": values2, "weights": weights2}
        else:
            return {"type": "DISC", "values": values1, "weights": weights1}
    
    elif dist_name == 'RAND':
        if len(params) != 0:
            raise ValueError(f"RAND requires 0 parameters, got {len(params)}")
        return {"type": "RAND"}
    
    elif dist_name == 'FIXED':
        if len(params) != 1:
            raise ValueError(f"FIXED requires 1 parameter (value), got {len(params)}")
        return {"type": "FIXED", "value": params[0]}
    
    else:
        raise ValueError(f"Unsupported distribution: {dist_name}")


def validate_formula_syntax(formula: str) -> bool:
    """
    Validate that a formula has correct syntax without parsing it completely.
    
    Args:
        formula: Formula string to validate
        
    Returns:
        True if syntax is valid, False otherwise
    """
    try:
        parse_distribution_formula(formula)
        return True
    except ValueError:
        return False