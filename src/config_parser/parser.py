import yaml
import logging
from typing import Dict, Any
from .config_enhancer import enhance_config

logger = logging.getLogger(__name__)

def parse_config(config_path: str) -> Dict[str, Any]:
    """
    Parse and validate configuration file
    Returns enhanced configuration if process tracking is needed
    """
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)
        
        # Validate basic configuration
        validate_config(config)
        
        # Enhance configuration if needed
        enhanced_config = enhance_config(config)
        
        # Log configuration details
        log_config_details(enhanced_config)
        
        return enhanced_config
        
    except Exception as e:
        logger.error(f"Error parsing configuration file: {str(e)}")
        raise

def validate_config(config: Dict[str, Any]):
    """Validate configuration structure and required fields"""
    # Required keys for all configurations
    required_keys = ['entities', 'initial_population', 'simulation_parameters']
    for key in required_keys:
        if key not in config:
            raise ValueError(f"Missing required key in configuration: {key}")
    
    # Validate entities
    if not config['entities']:
        raise ValueError("At least one entity must be defined in the configuration.")
    
    # Validate initial population
    for entity in config['entities']:
        entity_name = entity['name']
        if entity_name not in config['initial_population']:
            logger.warning(f"No initial population specified for entity: {entity_name}")
    
    # Validate simulation parameters
    required_sim_params = ['start_date', 'end_date']
    for param in required_sim_params:
        if param not in config['simulation_parameters']:
            raise ValueError(f"Missing required simulation parameter: {param}")
    
    # Additional validation for process configurations
    if 'process_definitions' in config:
        validate_process_config(config)

def validate_process_config(config: Dict[str, Any]):
    """Validate process-specific configuration elements"""
    for process in config['process_definitions']:
        if 'name' not in process:
            raise ValueError("Process definition missing required 'name' field")
            
        if 'required_resources' not in process:
            raise ValueError(f"Process '{process['name']}' missing required_resources")
            
        # Check for either duration or total_hours
        if 'duration' not in process and 'total_hours' not in process:
            raise ValueError(
                f"Process '{process['name']}' missing either duration or total_hours configuration"
            )
            
        if 'target_entity' not in process:
            raise ValueError(f"Process '{process['name']}' missing target_entity")
            
        # Validate work schedule if present
        if 'work_schedule' in process:
            schedule = process['work_schedule']
            required_schedule_fields = ['hours_per_day', 'start_hour', 'end_hour', 'work_days']
            for field in required_schedule_fields:
                if field not in schedule:
                    raise ValueError(
                        f"Process '{process['name']}' work_schedule missing required field: {field}"
                    )
                    
            # Validate work days
            if not all(isinstance(day, int) and 1 <= day <= 7 for day in schedule['work_days']):
                raise ValueError(
                    f"Process '{process['name']}' work_schedule has invalid work_days. "
                    "Must be integers 1-7 (Monday-Sunday)"
                )
                
            # Validate hours
            if not (0 <= schedule['start_hour'] < 24 and 0 < schedule['end_hour'] <= 24):
                raise ValueError(
                    f"Process '{process['name']}' work_schedule has invalid hours. "
                    "Must be between 0-24"
                )

def log_config_details(config: Dict[str, Any]):
    """Log important configuration details"""
    # Log basic configuration info
    entity_names = ', '.join(e['name'] for e in config['entities'])
    logger.info(f"Configuration parsed successfully. Entities defined: {entity_names}")
    
    # Log simulation mode
    if 'events' in config:
        logger.info("Configuration includes events. Running in simulation mode.")
    else:
        logger.info("No events found in configuration. Running in database generation mode.")
    
    # Log process tracking info if present
    if 'process_definitions' in config:
        process_names = ', '.join(p['name'] for p in config['process_definitions'])
        logger.info(f"Process definitions found: {process_names}")
    
    # Log relationship info
    if 'relationships' in config:
        relationship_count = len(config['relationships'])
        logger.info(f"Relationships defined: {relationship_count}")