"""
Template-based data generation for database entities.
"""

import re
import logging
import random
from typing import Dict, Any, Optional

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
            options_str = var_name[7:]  # Remove 'random_' prefix
            options = [opt.strip() for opt in options_str.split(',')]
            return random.choice(options)
            
        logger.warning(f"Template variable '{var_name}' not found in context")
        return f"{{Unknown: {var_name}}}"
        
    # Replace all variables in the template
    result = re.sub(pattern, replace_var, template)
    return result


def validate_template(template: str) -> tuple[bool, str]:
    """
    Validate a template string for syntax errors.
    
    Args:
        template: Template string to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not template:
        return False, "Template cannot be empty"
    
    try:
        # Check for balanced braces
        pattern = r'\{([^}]+)\}'
        matches = re.findall(pattern, template)
        
        # Check for empty variables
        for match in matches:
            if not match.strip():
                return False, f"Empty variable placeholder found: {{{match}}}"
                
            # Validate random_ syntax
            if match.startswith('random_'):
                options_str = match[7:]
                if not options_str:
                    return False, f"Empty options list for random variable: {{{match}}}"
                options = [opt.strip() for opt in options_str.split(',')]
                if not options or any(not opt for opt in options):
                    return False, f"Invalid options list for random variable: {{{match}}}"
        
        return True, ""
        
    except Exception as e:
        return False, f"Template validation error: {str(e)}"


def extract_template_variables(template: str) -> list[str]:
    """
    Extract all variable names from a template string.
    
    Args:
        template: Template string to analyze
        
    Returns:
        List of variable names found in the template
    """
    pattern = r'\{([^}]+)\}'
    matches = re.findall(pattern, template)
    
    variables = []
    for match in matches:
        if match.startswith('random_'):
            variables.append(match)  # Include the full random_ specification
        else:
            variables.append(match)
    
    return list(set(variables))  # Remove duplicates