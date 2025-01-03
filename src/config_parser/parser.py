import yaml
import logging
from datetime import datetime
from typing import Dict, Any, List, Union
from ..common.constants import TableType
from ..utils.distributions import parse_distribution_string

logger = logging.getLogger(__name__)

def parse_config(config_path: str) -> Dict[str, Any]:
    """Parse and validate configuration file"""
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)
        
        # Validate configuration structure
        validate_config(config)
        
        # Log configuration details
        log_config_details(config)
        
        return config
        
    except Exception as e:
        logger.error(f"Error parsing configuration file: {str(e)}")
        raise

def validate_config(config: Dict[str, Any]):
    """Validate configuration structure and required fields"""
    _validate_required_sections(config)
    _validate_entities(config.get('entities', []))
    _validate_relationships(config.get('relationships', []))
    _validate_initial_population(config.get('initial_population', {}), config['entities'])
    _validate_resource_definitions(config.get('resource_definitions', []))
    _validate_events(config.get('events', []))
    _validate_simulation_parameters(config.get('simulation_parameters', {}))
    
    if 'resource_definitions' in config:
        _validate_resource_definitions(config['resource_definitions'])

def _validate_required_sections(config: Dict[str, Any]):
    """Validate required configuration sections"""
    required_sections = ['entities', 'initial_population', 'simulation_parameters']
    missing_sections = [section for section in required_sections if section not in config]
    
    if missing_sections:
        raise ValueError(f"Missing required sections: {', '.join(missing_sections)}")

def _validate_entities(entities: List[Dict[str, Any]]):
    """Validate entity configurations"""
    if not entities:
        raise ValueError("At least one entity must be defined")
    
    entity_names = set()
    for entity in entities:
        # Validate basic structure
        if 'name' not in entity:
            raise ValueError("Entity missing required 'name' field")
        if entity['name'] in entity_names:
            raise ValueError(f"Duplicate entity name: {entity['name']}")
        entity_names.add(entity['name'])
        
        if 'type' not in entity:
            raise ValueError(f"Entity {entity['name']} missing required 'type' field")
        if 'attributes' not in entity:
            raise ValueError(f"Entity {entity['name']} missing required 'attributes' field")
            
        # Skip type validation for auto-generated tables
        if entity.get('auto_generated', False):
            continue
            
        valid_types = [TableType.RESOURCE, TableType.PROCESS_ENTITY, TableType.ENTITY]
        if entity['type'] not in valid_types:
            raise ValueError(
                f"Invalid entity type for {entity['name']}: {entity['type']}. "
                f"Must be one of: {', '.join(str(t) for t in valid_types)}"
            )
                
def _validate_generator_config(generator: Dict[str, Any], entity_name: str, attr_name: str):
    """Validate generator configuration"""
    if 'type' not in generator:
        raise ValueError(f"Generator for {entity_name}.{attr_name} missing 'type' field")
        
    if generator['type'] == 'distribution':
        if 'distribution' not in generator:
            raise ValueError(
                f"Distribution generator for {entity_name}.{attr_name} "
                f"missing 'distribution' config"
            )
        
        if 'choices' in generator:
            dist_str = generator['distribution']
            if not dist_str.startswith('DISC('):
                raise ValueError(
                    f"Choice-based distribution must use DISC() for "
                    f"{entity_name}.{attr_name}"
                )
            
            # Validate probabilities sum to 1.0 (with small tolerance for floating point)
            probs = [float(x.strip()) for x in dist_str[5:-1].split(',')]
            if not 0.99 <= sum(probs) <= 1.01:
                raise ValueError(
                    f"Probabilities in DISC distribution must sum to 1.0 for "
                    f"{entity_name}.{attr_name}"
                )
            
            # Validate probability count matches choices
            if len(probs) != len(generator['choices']):
                raise ValueError(
                    f"Number of probabilities ({len(probs)}) must match "
                    f"number of choices ({len(generator['choices'])}) for "
                    f"{entity_name}.{attr_name}"
                )

def _validate_attributes(attributes: List[Dict[str, Any]], entity_name: str):
    """Validate entity attributes"""
    attribute_names = set()
    has_primary_key = False
    
    for attr in attributes:
        if 'name' not in attr:
            raise ValueError(f"Attribute in entity {entity_name} missing 'name' field")
            
        if attr['name'] in attribute_names:
            raise ValueError(f"Duplicate attribute name {attr['name']} in entity {entity_name}")
            
        attribute_names.add(attr['name'])
        
        if 'type' not in attr:
            raise ValueError(f"Attribute {attr['name']} in entity {entity_name} missing 'type' field")
            
        if attr.get('primary_key'):
            has_primary_key = True
            
        if 'generator' in attr:
            _validate_generator(attr['generator'], attr['name'], entity_name)
            
    if not has_primary_key and 'id' not in attribute_names:
        logger.info(f"No primary key defined for entity {entity_name}, adding default 'id' field")

def _validate_generator(generator: Dict[str, Any], attr_name: str, entity_name: str):
    """Validate attribute generator configuration"""
    if 'type' not in generator:
        raise ValueError(
            f"Generator for attribute {attr_name} in entity {entity_name} missing 'type' field"
        )
    
    generator_type = generator['type']
    
    if generator_type == 'faker' and 'method' not in generator:
        raise ValueError(
            f"Faker generator for attribute {attr_name} in entity {entity_name} missing 'method' field"
        )
    
    if generator_type == 'choice' and 'choices' not in generator:
        raise ValueError(
            f"Choice generator for attribute {attr_name} in entity {entity_name} missing 'choices' field"
        )

def _validate_relationships(relationships: List[Dict[str, Any]]):
    """Validate relationship configurations"""
    for rel in relationships:
        required_fields = ['from', 'to', 'type']
        missing_fields = [field for field in required_fields if field not in rel]
        
        if missing_fields:
            raise ValueError(f"Relationship missing required fields: {', '.join(missing_fields)}")
            
        if rel['type'] not in ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many']:
            raise ValueError(f"Invalid relationship type: {rel['type']}")
        
def _validate_resource_definitions(definitions: List[Dict[str, Any]]):
    """Validate resource definitions"""
    for definition in definitions:
        required_fields = ['table', 'type_field']
        
        missing_fields = [
            field for field in required_fields 
            if field not in definition
        ]
        
        if missing_fields:
            raise ValueError(
                f"Resource definition missing required fields: {', '.join(missing_fields)}"
            )
        
        # Validate that referenced table exists and is a resource type
        table_name = definition['table']
        type_field = definition['type_field']

def _validate_initial_population(population: Dict[str, Any], entities: List[Dict[str, Any]]):
    """Validate initial population configuration"""
    entity_names = {entity['name'] for entity in entities}
    
    for entity_name, config in population.items():
        if entity_name not in entity_names:
            raise ValueError(f"Initial population specified for undefined entity: {entity_name}")
            
        if 'count' not in config:
            raise ValueError(f"Initial population for {entity_name} missing 'count' field")
            
        if config['count'] < 0:
            raise ValueError(f"Invalid count for {entity_name}: {config['count']}")
            
        if 'creation_time_distribution' in config:
            _validate_distribution(
                config['creation_time_distribution'],
                f"creation time distribution for {entity_name}"
            )

def _validate_events(events: List[Dict[str, Any]]):
    """Validate event configurations"""
    for event in events:
        if 'name' not in event:
            raise ValueError("Event missing required 'name' field")
            
        if 'type' not in event:
            raise ValueError(f"Event {event['name']} missing required 'type' field")
            
        if event['type'] == 'Process':
            _validate_process_config(event)

def _validate_process_config(event: Dict[str, Any]):
    """Validate process event configuration"""
    required_fields = ['name', 'type', 'entity']
    missing_fields = [field for field in required_fields if field not in event]
    if missing_fields:
        raise ValueError(f"Process event missing required fields: {', '.join(missing_fields)}")
    
    # Validate entity specification
    if 'entity' not in event:
        raise ValueError(f"Process event {event['name']} missing 'entity' field")
        
    entity = event['entity']
    if isinstance(entity, dict):
        required_entity_fields = ['entity_table', 'group_by', 'type']
        missing_entity_fields = [
            field for field in required_entity_fields 
            if field not in entity
        ]
        if missing_entity_fields:
            raise ValueError(
                f"Process event entity config missing fields: {', '.join(missing_entity_fields)}"
            )
    elif not isinstance(entity, str):
        raise ValueError(
            f"Process event entity must be either a string or a dictionary, got {type(entity)}"
        )
    
    # Validate process configuration
    if 'process_config' not in event:
        raise ValueError(f"Process event {event['name']} missing process_config")
        
    config = event['process_config']
    
    # Validate required resources with grouping
    if 'required_resources' in config:
        for resource in config['required_resources']:
            required_resource_fields = ['resource_table', 'group_by', 'type']
            missing_resource_fields = [
                field for field in required_resource_fields 
                if field not in resource
            ]
            if missing_resource_fields:
                raise ValueError(
                    f"Required resource in {event['name']} missing fields: "
                    f"{', '.join(missing_resource_fields)}"
                )
            
    # Validate dependencies with conditions
    if 'dependencies' in config:
        for dep in config['dependencies']:
            if 'conditions' in dep:
                for condition in dep['conditions']:
                    if 'entity_type' not in condition:
                        raise ValueError(
                            f"Dependency condition in {event['name']} missing entity_type"
                        )

def _validate_distribution(distribution: Union[str, Dict[str, Any]], context: str):
    """Validate distribution configuration in either Arena-style or dictionary format"""
    try:
        if isinstance(distribution, str):
            # Parse and validate Arena-style string
            parse_distribution_string(distribution)
        elif isinstance(distribution, dict):
            if 'distribution' not in distribution:
                raise ValueError(f"Distribution type not specified in {context}")
            
            dist_type = distribution['distribution'].lower()
            
            if dist_type == 'normal':
                _validate_params(['mean', 'std'], distribution, context)
            elif dist_type == 'uniform':
                _validate_params(['min', 'max'], distribution, context)
            elif dist_type == 'exponential':
                _validate_params(['mean'], distribution, context)
            elif dist_type == 'triangular':
                _validate_params(['min', 'mode', 'max'], distribution, context)
            elif dist_type == 'poisson':
                _validate_params(['mean'], distribution, context)
            elif dist_type == 'constant':
                _validate_params(['value'], distribution, context)
            else:
                raise ValueError(f"Unknown distribution type in {context}: {dist_type}")
        else:
            raise ValueError(
                f"Distribution must be either a string or dictionary in {context}, "
                f"got {type(distribution)}"
            )
    except Exception as e:
        raise ValueError(f"Invalid distribution in {context}: {str(e)}")
    
def _validate_params(required_params: List[str], config: Dict[str, Any], context: str):
    """Validate that all required parameters are present"""
    missing_params = [param for param in required_params if param not in config]
    if missing_params:
        raise ValueError(
            f"Distribution in {context} missing required parameters: {', '.join(missing_params)}"
        )

def _validate_simulation_parameters(params: Dict[str, Any]):
    """Validate simulation parameters"""
    required_params = ['start_date', 'end_date']
    missing_params = [param for param in required_params if param not in params]
    
    if missing_params:
        raise ValueError(f"Missing required simulation parameters: {', '.join(missing_params)}")
        
    try:
        start_date = datetime.strptime(params['start_date'], "%Y-%m-%d %H:%M:%S")
        end_date = datetime.strptime(params['end_date'], "%Y-%m-%d %H:%M:%S")
        
        if end_date <= start_date:
            raise ValueError("End date must be after start date")
    except ValueError as e:
        raise ValueError(f"Invalid date format in simulation parameters: {str(e)}")
        
    if 'work_schedule' in params:
        _validate_work_schedule(params['work_schedule'])

def _validate_work_schedule(schedule: Dict[str, Any]):
    """Validate work schedule configuration"""
    required_fields = ['hours_per_day', 'start_hour', 'end_hour', 'work_days']
    missing_fields = [field for field in required_fields if field not in schedule]
    
    if missing_fields:
        raise ValueError(f"Work schedule missing required fields: {', '.join(missing_fields)}")
        
    if not (0 <= schedule['start_hour'] < 24 and 0 < schedule['end_hour'] <= 24):
        raise ValueError("Invalid work hours specified")
        
    if schedule['end_hour'] <= schedule['start_hour']:
        raise ValueError("End hour must be after start hour")
        
    if schedule['hours_per_day'] > (schedule['end_hour'] - schedule['start_hour']):
        raise ValueError("Hours per day cannot exceed work day length")
        
    if not schedule['work_days'] or not all(1 <= d <= 7 for d in schedule['work_days']):
        raise ValueError("Invalid work days specified")

def log_config_details(config: Dict[str, Any]):
    """Log important configuration details"""
    # Log entities and their configurations
    entity_names = ', '.join(e['name'] for e in config['entities'])
    logger.info(f"Entities defined: {entity_names}")
    
    # Log resource and process entity counts
    resource_entities = [e for e in config['entities'] if e['type'] == TableType.RESOURCE]
    process_entities = [e for e in config['entities'] if e['type'] == TableType.PROCESS_ENTITY]
    logger.info(f"Found {len(resource_entities)} resource entities and {len(process_entities)} process entities")
    
    # Log initial population counts
    for entity, pop_config in config['initial_population'].items():
        logger.info(f"Initial population for {entity}: {pop_config['count']}")
    
    # Log event configurations
    if 'events' in config:
        event_types = {}
        for event in config['events']:
            event_type = event['type']
            event_types[event_type] = event_types.get(event_type, 0) + 1
        
        for event_type, count in event_types.items():
            logger.info(f"Found {count} events of type {event_type}")
    
    # Log simulation period
    start_date = config['simulation_parameters']['start_date']
    end_date = config['simulation_parameters']['end_date']
    logger.info(f"Simulation period: {start_date} to {end_date}")