"""
Template utility functions for generating data from templates
"""

import re
import logging
from typing import Dict, Any, Optional, List
import random

logger = logging.getLogger(__name__)

def generate_from_template(template: str, context: Dict[str, Any], size: Optional[int] = None) -> Any:
    """
    Generate data using a string template with variables
    
    Args:
        template: Template string with {variable} placeholders
        context: Dictionary of variables to substitute in the template
        size: Size of data to generate (for arrays)
        
    Returns:
        Generated data from template
    """
    if size is not None:
        return [generate_from_template(template, context) for _ in range(size)]
        
    # Pattern to match variables in the template
    pattern = r'\{([^}]+)\}'
    
    def replace_var(match):
        var_name = match.group(1)
        
        # Check if the variable exists in the context
        if var_name in context:
            return str(context[var_name])
            
        # Handle special cases
        if var_name.startswith('random_'):
            # Random selection from a list
            options_str = var_name[7:]
            options = [opt.strip() for opt in options_str.split(',')]
            return random.choice(options)
            
        logger.warning(f"Template variable '{var_name}' not found in context")
        return f"{{Unknown: {var_name}}}"
        
    # Replace all variables in the template
    result = re.sub(pattern, replace_var, template)
    return result