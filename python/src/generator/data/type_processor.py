"""
Type-aware value processing for database attributes.

This module provides utilities to format generated values according to their
specified data types (decimal precision, integer rounding, etc.).
"""

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Any


def process_value_for_type(value: Any, attr_type: str) -> Any:
    """
    Process a generated value to match the expected data type format.
    
    Args:
        value: The generated value
        attr_type: The attribute's data type specification
        
    Returns:
        The processed value formatted for the data type
    """
    if value is None:
        return None
        
    # Handle parameterized types like decimal(10,2), varchar(50)
    if '(' in attr_type:
        base_type = attr_type.split('(')[0].lower()
        params = attr_type.split('(')[1].rstrip(')').split(',')
        
        if base_type in ['decimal', 'numeric']:
            # Extract precision and scale
            precision = int(params[0]) if len(params) > 0 else 10
            scale = int(params[1]) if len(params) > 1 else 2
            
            # Convert to Decimal and round to specified scale, then convert to float for SQLite
            if isinstance(value, (int, float)):
                decimal_value = Decimal(str(value))
                # Create a string representation with the right number of decimal places
                format_str = f"0.{'0' * scale}"
                rounded_decimal = decimal_value.quantize(Decimal(format_str), rounding=ROUND_HALF_UP)
                # Convert back to float for SQLite compatibility
                return float(rounded_decimal)
            return value

        elif base_type in ['varchar', 'char']:
            # Truncate string to specified length if necessary
            length = int(params[0]) if len(params) > 0 else 255
            if isinstance(value, str) and len(value) > length:
                return value[:length]
            return str(value) if value is not None else None
    
    # Handle non-parameterized types
    base_type = attr_type.lower()
    
    if base_type in ['integer', 'int', 'bigint', 'smallint', 'tinyint']:
        # Convert to integer, rounding if necessary
        if isinstance(value, float):
            return int(round(value))
        elif isinstance(value, str) and value.replace('.', '').replace('-', '').isdigit():
            return int(float(value))
        return int(value) if value is not None else None
        
    elif base_type in ['decimal', 'numeric']:
        # Default decimal with 2 decimal places, convert to float for SQLite
        if isinstance(value, (int, float)):
            decimal_value = Decimal(str(value))
            rounded_decimal = decimal_value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            return float(rounded_decimal)
        return value
        
    elif base_type in ['float', 'double', 'real']:
        # Ensure value is float
        return float(value) if value is not None else None
        
    elif base_type in ['boolean', 'bool']:
        # Convert to boolean
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        return bool(value) if value is not None else None
        
    elif base_type in ['varchar', 'char', 'text', 'string', 'event_type']:
        # Convert to string (including event_type semantic type)
        return str(value) if value is not None else None
    
    # For datetime types, return as-is (should already be properly formatted)
    return value
