import yaml
import logging

logger = logging.getLogger(__name__)

def parse_config(config_path):
    with open(config_path, 'r') as file:
        config = yaml.safe_load(file)
    
    # Required keys for all configurations
    required_keys = ['entities', 'initial_population']
    for key in required_keys:
        if key not in config:
            raise ValueError(f"Missing required key in configuration: {key}")
    
    if 'simulation' and 'events' in config:
        logger.info("Parsed configuration includes events. Running in simulation mode.")
    else:
        logger.info("No events found in configuration. Running in database generation mode.")
    
    if not config['entities']:
        raise ValueError("At least one entity must be defined in the configuration.")
    
    for entity in config['entities']:
        entity_name = entity['name']
        if entity_name not in config['initial_population']:
            logger.warning(f"No initial population specified for entity: {entity_name}")
    
    logger.info(f"Configuration parsed successfully. Entities defined: {', '.join(e['name'] for e in config['entities'])}")
    
    return config