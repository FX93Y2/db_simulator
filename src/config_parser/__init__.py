"""
Configuration parser module for the DB Simulator

This module contains parsers for database and simulation configuration files,
providing a structured approach to loading and validating configuration data.
"""

# Core parser classes
from src.config_parser.base import BaseConfigParser, ConfigValidationError

# Database configuration parsing
from src.config_parser.db_parser import (
    parse_db_config,
    DatabaseConfig,
    Entity,
    Attribute,
    Generator,
    Relationship
)

# Simulation configuration parsing
from src.config_parser.sim_parser import (
    parse_sim_config,
    SimulationConfig,
    EventSimulation,
    ResourceTable,
    ResourceRequirement,
    EntityArrival,
    ShiftPattern,
    ResourceShift,
    WorkShifts
)

__all__ = [
    # Core classes
    'BaseConfigParser',
    'ConfigValidationError',
    
    # Database config
    'parse_db_config',
    'DatabaseConfig',
    'Entity',
    'Attribute',
    'Generator',
    'Relationship',
    
    # Simulation config
    'parse_sim_config',
    'SimulationConfig',
    'EventSimulation',
    'ResourceTable',
    'ResourceRequirement',
    'EntityArrival',
    'ShiftPattern',
    'ResourceShift',
    'WorkShifts'
]
