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
        if 'duration' not in process:
            raise ValueError(f"Process '{process['name']}' missing duration configuration")
        if 'target_entity' not in process:
            raise ValueError(f"Process '{process['name']}' missing target_entity")

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