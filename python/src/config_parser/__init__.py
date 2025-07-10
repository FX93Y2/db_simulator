"""
Configuration parsers for DB Simulator.
"""

from typing import Dict, Any, List, Union, Optional
import yaml
import os
import logging
import tempfile

from .base import BaseConfigParser, ConfigValidationError

# Import database config components
from .db_parser import (
    DatabaseConfig,
    Entity,
    Relationship,
    Attribute,
    parse_db_config
)

# Import simulation config components
from .sim_parser import (
    SimulationConfig,
    EntityArrival,
    EventSimulation,
    ResourceRequirement,
    WorkShifts,
    ShiftPattern,
    ResourceShift,
    EventTypeDefinition,
    EventTransition,
    EventSequenceTransition,
    EventSequence,
    TableSpecification,
    # New event flows components
    Condition,
    Outcome,
    DecideConfig,
    EventStepConfig,
    Step,
    EventFlow,
    EventFlowsConfig,
    parse_sim_config,
    find_relationship_keys,
    find_event_type_column,
    find_resource_type_column,
    get_event_values,
    get_initial_event
)

# Create logger
logger = logging.getLogger(__name__)

# Enhanced versions of parse functions that handle string content
def parse_db_config_from_string(content: str) -> DatabaseConfig:
    """
    Parse database configuration from a YAML string instead of a file.
    
    Args:
        content: YAML content as a string
        
    Returns:
        DatabaseConfig: Parsed database configuration
    """
    try:
        # Create a temporary file to hold the content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_file:
            temp_file_path = temp_file.name
            temp_file.write(content)
        
        # Parse the configuration from the temporary file
        logger.info(f"Parsing DB config from temporary file: {temp_file_path}")
        result = parse_db_config(temp_file_path)
        
        # Clean up the temporary file
        os.unlink(temp_file_path)
        
        return result
    except Exception as e:
        logger.error(f"Error parsing DB config from string: {e}")
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass  # Ignore cleanup errors
        raise

def parse_sim_config_from_string(content: str, db_config: Optional[DatabaseConfig] = None) -> SimulationConfig:
    """
    Parse simulation configuration from a YAML string instead of a file.
    
    Args:
        content: YAML content as a string
        db_config: Optional database configuration to derive table specifications
        
    Returns:
        SimulationConfig: Parsed simulation configuration
    """
    try:
        # Create a temporary file to hold the content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_file:
            temp_file_path = temp_file.name
            temp_file.write(content)
        
        # Parse the configuration from the temporary file
        logger.info(f"Parsing simulation config from temporary file: {temp_file_path}")
        result = parse_sim_config(temp_file_path, db_config)
        
        # Clean up the temporary file
        os.unlink(temp_file_path)
        
        return result
    except Exception as e:
        logger.error(f"Error parsing simulation config from string: {e}")
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass  # Ignore cleanup errors
        raise

__all__ = [
    'BaseConfigParser',
    'ConfigValidationError',
    'DatabaseConfig',
    'Entity',
    'Relationship',
    'Attribute',
    'parse_db_config',
    'parse_db_config_from_string',
    'SimulationConfig',
    'EntityArrival',
    'EventSimulation',
    'ResourceRequirement',
    'WorkShifts',
    'ShiftPattern',
    'ResourceShift',
    'EventTypeDefinition',
    'EventTransition',
    'EventSequenceTransition',
    'EventSequence',
    'TableSpecification',
    # New event flows components
    'Condition',
    'Outcome',
    'DecideConfig',
    'EventStepConfig',
    'Step',
    'EventFlow',
    'EventFlowsConfig',
    'parse_sim_config',
    'parse_sim_config_from_string',
    'find_relationship_keys',
    'find_event_type_column',
    'find_resource_type_column',
    'get_event_values',
    'get_initial_event',
]
