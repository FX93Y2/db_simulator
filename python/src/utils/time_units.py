"""
Time unit system for simulation time handling.

This module provides time unit definitions and conversion utilities
for the simulation system. All internal time calculations use minutes
as the base unit, with conversions to/from other units as needed.
"""

from enum import Enum
from typing import Union


class TimeUnit(Enum):
    """
    Supported time units with their conversion factors to minutes.
    
    Each enum value is a tuple of (display_name, conversion_factor_to_minutes)
    """
    SECONDS = ('seconds', 1/60)    # 1 second = 1/60 minutes
    MINUTES = ('minutes', 1)       # 1 minute = 1 minute (base unit)
    HOURS = ('hours', 60)          # 1 hour = 60 minutes
    DAYS = ('days', 1440)          # 1 day = 1440 minutes (24 * 60)
    
    @property
    def display_name(self) -> str:
        """Get the human-readable name of the time unit."""
        return self.value[0]
    
    @property
    def conversion_factor(self) -> float:
        """Get the conversion factor to minutes."""
        return self.value[1]
    
    @classmethod
    def from_string(cls, unit_str: str) -> 'TimeUnit':
        """
        Parse a time unit from string.
        
        Args:
            unit_str: String representation of time unit
            
        Returns:
            TimeUnit enum value
            
        Raises:
            ValueError: If unit_str is not a valid time unit
        """
        unit_str = unit_str.lower().strip()
        
        # Handle common variations
        unit_mapping = {
            'second': cls.SECONDS,
            'seconds': cls.SECONDS,
            'sec': cls.SECONDS,
            'minute': cls.MINUTES,
            'minutes': cls.MINUTES,
            'min': cls.MINUTES,
            'hour': cls.HOURS,
            'hours': cls.HOURS,
            'hr': cls.HOURS,
            'day': cls.DAYS,
            'days': cls.DAYS
        }
        
        if unit_str in unit_mapping:
            return unit_mapping[unit_str]
        
        raise ValueError(f"Unknown time unit: {unit_str}. Supported units: {list(unit_mapping.keys())}")


class TimeUnitConverter:
    """
    Utility class for converting between different time units.
    
    All conversions are done through minutes as the internal base unit.
    """
    
    @staticmethod
    def to_minutes(value: float, from_unit: Union[TimeUnit, str]) -> float:
        """
        Convert a time value to minutes (internal base unit).
        
        Args:
            value: Time value to convert
            from_unit: Source time unit (TimeUnit enum or string)
            
        Returns:
            Time value in minutes
            
        Example:
            >>> TimeUnitConverter.to_minutes(2, TimeUnit.HOURS)
            120.0
            >>> TimeUnitConverter.to_minutes(30, 'seconds')
            0.5
        """
        if isinstance(from_unit, str):
            from_unit = TimeUnit.from_string(from_unit)
        
        return value * from_unit.conversion_factor
    
    @staticmethod
    def from_minutes(minutes: float, to_unit: Union[TimeUnit, str]) -> float:
        """
        Convert minutes to the specified time unit.
        
        Args:
            minutes: Time value in minutes
            to_unit: Target time unit (TimeUnit enum or string)
            
        Returns:
            Time value in the target unit
            
        Example:
            >>> TimeUnitConverter.from_minutes(120, TimeUnit.HOURS)
            2.0
            >>> TimeUnitConverter.from_minutes(0.5, 'seconds')
            30.0
        """
        if isinstance(to_unit, str):
            to_unit = TimeUnit.from_string(to_unit)
        
        return minutes / to_unit.conversion_factor
    
    @staticmethod
    def convert(value: float, from_unit: Union[TimeUnit, str], to_unit: Union[TimeUnit, str]) -> float:
        """
        Convert a time value from one unit to another.
        
        Args:
            value: Time value to convert
            from_unit: Source time unit (TimeUnit enum or string)
            to_unit: Target time unit (TimeUnit enum or string)
            
        Returns:
            Time value in the target unit
            
        Example:
            >>> TimeUnitConverter.convert(2, 'hours', 'seconds')
            7200.0
            >>> TimeUnitConverter.convert(1440, TimeUnit.MINUTES, TimeUnit.DAYS)
            1.0
        """
        # Convert to minutes first, then to target unit
        minutes = TimeUnitConverter.to_minutes(value, from_unit)
        return TimeUnitConverter.from_minutes(minutes, to_unit)
    
    @staticmethod
    def get_display_string(value: float, unit: Union[TimeUnit, str]) -> str:
        """
        Get a formatted display string for a time value.
        
        Args:
            value: Time value
            unit: Time unit (TimeUnit enum or string)
            
        Returns:
            Formatted string like "2.5 hours" or "30 seconds"
            
        Example:
            >>> TimeUnitConverter.get_display_string(2.5, TimeUnit.HOURS)
            "2.5 hours"
        """
        if isinstance(unit, str):
            unit = TimeUnit.from_string(unit)
        
        # Use singular form for value of 1, plural otherwise
        if value == 1.0:
            unit_str = unit.display_name.rstrip('s')  # Remove 's' for singular
        else:
            unit_str = unit.display_name
        
        return f"{value} {unit_str}"


def validate_base_time_unit(unit_str: str) -> bool:
    """
    Validate that a string represents a valid base time unit.
    
    Args:
        unit_str: String to validate
        
    Returns:
        True if valid, False otherwise
    """
    try:
        TimeUnit.from_string(unit_str)
        return True
    except ValueError:
        return False


def get_supported_time_units() -> list[str]:
    """
    Get a list of all supported time unit strings.
    
    Returns:
        List of supported time unit strings
    """
    return ['seconds', 'minutes', 'hours', 'days']