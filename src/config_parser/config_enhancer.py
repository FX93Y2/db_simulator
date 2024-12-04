from typing import Any, Dict, List
from ..common.constants import TableType, EntityStatus, ResourceStatus
# Remove the local TableType class
import logging
from copy import deepcopy

logger = logging.getLogger(__name__)

__all__ = [
    'enhance_config',
    'needs_process_tracking',
    'enhance_with_process_tracking',
    'TableType',
    'EntityStatus',
    'ResourceStatus'
]


def enhance_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Enhance configuration with additional tables and relationships"""
    enhanced_config = deepcopy(config)
    
    # First identify and validate entity types
    entity_types = _categorize_entities(enhanced_config)
    
    # Validate resource definitions if present
    if 'resource_definitions' in enhanced_config:
        _validate_resource_definitions(enhanced_config, enhanced_config['resource_definitions'])
        
    # Validate process entities
    _validate_process_entities(enhanced_config, entity_types['process_entities'])
    
    # Validate process configurations against resource types
    _validate_process_resource_requirements(enhanced_config, entity_types)
    
    # Create process tracking tables
    enhanced_config = _create_process_tracking_tables(
        enhanced_config,
        entity_types['process_entities'],
        entity_types['resource_entities']
    )
    
    # Enhance work schedules
    enhanced_config = consolidate_work_schedule(enhanced_config)
    
    # Final validation
    _validate_table_types(enhanced_config)
    validate_enhanced_config(enhanced_config)
    
    logger.info("Configuration enhancement completed successfully")
    return enhanced_config

def _categorize_entities(config: Dict[str, Any]) -> Dict[str, List[str]]:
    """Categorize entities by their types"""
    entity_types = {
        'resource_entities': [],
        'process_entities': [],
        'regular_entities': []
    }
    
    for entity in config['entities']:
        entity_type = entity.get('type')
        if entity_type == TableType.RESOURCE:
            entity_types['resource_entities'].append(entity['name'])
        elif entity_type == TableType.PROCESS_ENTITY:
            entity_types['process_entities'].append(entity['name'])
        elif entity_type == TableType.ENTITY:
            entity_types['regular_entities'].append(entity['name'])
        else:
            raise ValueError(f"Invalid entity type for {entity['name']}: {entity_type}")
            
    return entity_types

def _create_process_tracking_tables(
    config: Dict[str, Any],
    process_entities: List[str],
    resource_entities: List[str]
) -> Dict[str, Any]:
    """Create process tracking tables for process entities and resources"""
    enhanced_config = deepcopy(config)
    
    for process_entity in process_entities:
        for resource_entity in resource_entities:
            enhanced_config = enhance_with_process_tracking(
                enhanced_config,
                process_entity,
                resource_entity
            )
            
    return enhanced_config

def _validate_table_types(config: Dict[str, Any]):
    """Validate table types and their configurations"""
    valid_types = [TableType.RESOURCE, TableType.PROCESS_ENTITY, TableType.ENTITY]
    
    for entity in config['entities']:
        # Skip validation for auto-generated tables
        if entity.get('auto_generated', False):
            continue
            
        if 'type' not in entity:
            raise ValueError(f"Missing type for entity {entity['name']}")
            
        table_type = entity['type']
        if table_type not in valid_types:
            raise ValueError(
                f"Invalid table type '{table_type}' for {entity['name']}. "
                f"Must be one of: {', '.join(t for t in valid_types)}"
            )

def needs_process_tracking(config: Dict) -> bool:
    """Check if configuration requires process tracking"""
    if 'events' not in config:
        return False
        
    return any(
        event.get('type') == 'Process'
        for event in config['events']
    )

def enhance_with_process_tracking(
    config: Dict[str, Any],
    process_entity: str,
    resource_entity: str
) -> Dict[str, Any]:
    """Add process tracking tables and relationships"""
    new_config = deepcopy(config)
    
    # Validate entities exist
    if not _entity_exists(new_config, process_entity):
        raise ValueError(f"Process entity not found: {process_entity}")
    if not _entity_exists(new_config, resource_entity):
        raise ValueError(f"Resource entity not found: {resource_entity}")
        
    # Create tracking table if it doesn't exist
    mapping_table = create_process_tracking_table(process_entity, resource_entity)
    if not _entity_exists(new_config, mapping_table['name']):
        new_config['entities'].append(mapping_table)
        
        # Add relationships for the mapping table
        new_relationships = create_process_tracking_relationships(
            process_entity,
            resource_entity,
            mapping_table['name']
        )
        
        if 'relationships' not in new_config:
            new_config['relationships'] = []
        new_config['relationships'].extend(new_relationships)
    
    return new_config

def _entity_exists(config: Dict[str, Any], entity_name: str) -> bool:
    """Check if an entity exists in the configuration"""
    return any(e['name'] == entity_name for e in config['entities'])

def create_process_tracking_table(process_entity: str, resource_entity: str) -> Dict[str, Any]:
    """Create process tracking table configuration"""
    return {
        'name': f"{process_entity}_{resource_entity}_Process",
        'auto_generated': True,  # Mark as auto-generated
        'attributes': [
            {
                'name': 'id',
                'type': 'int',
                'primary_key': True
            },
            {
                'name': f'{process_entity.lower()}_id',
                'type': 'int',
                'foreign_key': f'{process_entity}.id'
            },
            {
                'name': f'{resource_entity.lower()}_id',
                'type': 'int',
                'foreign_key': f'{resource_entity}.id'
            },
            {
                'name': 'process_name',
                'type': 'string'
            },
            {
                'name': 'start_time',
                'type': 'datetime'
            },
            {
                'name': 'end_time',
                'type': 'datetime'
            },
            {
                'name': 'hours_worked',
                'type': 'float',
                'precision': 2
            }
        ]
    }

def create_process_tracking_relationships(
    process_entity: str,
    resource_entity: str,
    mapping_table: str
) -> List[Dict]:
    """Create relationships for process tracking table"""
    return [
        {
            'from': mapping_table,
            'to': process_entity,
            'type': 'many_to_one'
        },
        {
            'from': mapping_table,
            'to': resource_entity,
            'type': 'many_to_one'
        }
    ]

def consolidate_work_schedule(config: Dict) -> Dict:
    """Consolidate work schedule configuration"""
    new_config = deepcopy(config)
    
    # Get default work schedule from simulation parameters
    default_schedule = config.get('simulation_parameters', {}).get('work_schedule', {
        'hours_per_day': 8,
        'start_hour': 9,
        'end_hour': 17,
        'work_days': [1, 2, 3, 4, 5]
    })
    
    # Apply to all process configurations
    if 'events' in new_config:
        for event in new_config['events']:
            if event.get('type') == 'Process' and 'process_config' in event:
                if 'work_schedule' not in event['process_config']:
                    event['process_config']['work_schedule'] = default_schedule
    
    return new_config

def _get_table_type(entity_config: Dict[str, Any]) -> str:
    """Determine the type of a table configuration"""
    if entity_config.get('auto_generated', False):
        return 'auto_generated'
    return entity_config.get('type', 'unknown')

def validate_enhanced_config(config: Dict):
    """Validate the enhanced configuration"""
    # Collect valid resource types from entity config
    valid_resource_types = set()
    resource_entities = []
    process_entities = []
    auto_generated_tables = []
    
    for entity in config['entities']:
        table_type = _get_table_type(entity)
        
        if table_type == 'auto_generated':
            auto_generated_tables.append(entity['name'])
        elif table_type == TableType.RESOURCE:
            resource_entities.append(entity['name'])
            # Look for role/type attribute with distribution and choices
            for attr in entity['attributes']:
                if (attr.get('generator', {}).get('type') == 'distribution' and 
                    'choices' in attr.get('generator', {})):
                    valid_resource_types.update(attr['generator']['choices'])
        elif table_type == TableType.PROCESS_ENTITY:
            process_entities.append(entity['name'])
    
    # Check process events
    for event in config.get('events', []):
        if event.get('type') == 'Process':
            entity = event.get('entity', {})
            # Handle both string and dict entity specifications
            entity_name = (
                entity['entity_table'] 
                if isinstance(entity, dict) 
                else entity
            )
            
            if entity_name not in process_entities:
                raise ValueError(
                    f"Process event references non-process entity: {entity_name}. "
                    f"Entity must be of type '{TableType.PROCESS_ENTITY}'"
                )
            
            if 'process_config' in event and 'required_resources' in event['process_config']:
                for resource in event['process_config']['required_resources']:
                    resource_type = resource.get('type')
                    if resource_type not in valid_resource_types:
                        raise ValueError(
                            f"Invalid resource type in process config: {resource_type}. "
                            f"Valid types are: {', '.join(sorted(valid_resource_types))}"
                        )
    
    # Check for required mapping tables
    for process_entity in process_entities:
        for resource_entity in resource_entities:
            expected_table = f"{process_entity}_{resource_entity}_Process"
            if not any(e['name'] == expected_table for e in config['entities']):
                raise ValueError(f"Missing required process tracking table: {expected_table}")

def _validate_resource_definitions(config: Dict[str, Any], definitions: List[Dict[str, Any]]):
    """Validate resource definitions"""
    logger.info(f"Validating {len(definitions)} resource definitions")
    
    for definition in definitions:
        table_name = definition.get('table')
        type_field = definition.get('type_field')
        logger.debug(f"Validating resource definition for table {table_name} with type field {type_field}")
        
        required_fields = ['table', 'type_field']
        missing_fields = [field for field in required_fields if field not in definition]
        
        if missing_fields:
            raise ValueError(
                f"Resource definition missing required fields: {', '.join(missing_fields)}"
            )
        
        # Find the table configuration
        table_config = next(
            (e for e in config['entities'] if e['name'] == table_name),
            None
        )
        
        if not table_config:
            raise ValueError(f"Resource table {table_name} not found in configuration")
            
        if table_config.get('type') != TableType.RESOURCE:
            raise ValueError(
                f"Table {table_name} must be of type {TableType.RESOURCE}"
            )
            
        # Validate type field exists and has proper configuration
        type_attr = next(
            (attr for attr in table_config['attributes'] if attr['name'] == type_field),
            None
        )
        
        if not type_attr:
            raise ValueError(
                f"Type field {type_field} not found in table {table_name}"
            )
            
        if 'generator' not in type_attr:
            raise ValueError(
                f"Type field {type_field} in table {table_name} must have a generator"
            )
            
        generator = type_attr['generator']
        if generator.get('type') != 'distribution' or 'choices' not in generator:
            raise ValueError(
                f"Type field {type_field} in table {table_name} must have a "
                f"distribution generator with choices"
            )
            
        logger.debug(
            f"Resource definition validated for {table_name}. "
            f"Valid resource types: {generator.get('choices', [])}"
        )

def _validate_process_resource_requirements(
    config: Dict[str, Any],
    entity_types: Dict[str, List[str]]
):
    """Validate process resource requirements against resource definitions"""
    logger.info("Validating process resource requirements")
    
    # Get valid resource types from resource entities
    valid_resource_types = {}
    for entity_name in entity_types['resource_entities']:
        entity_config = next(
            (e for e in config['entities'] if e['name'] == entity_name),
            None
        )
        if not entity_config:
            continue
            
        # Find the type/role field from resource definitions
        resource_def = next(
            (rd for rd in config.get('resource_definitions', [])
             if rd['table'] == entity_name),
            None
        )
        
        if not resource_def:
            logger.warning(f"No resource definition found for {entity_name}")
            continue
            
        type_field = resource_def['type_field']
        type_attr = next(
            (attr for attr in entity_config['attributes']
             if attr['name'] == type_field),
            None
        )
        
        if type_attr and 'generator' in type_attr:
            if type_attr['generator'].get('type') == 'distribution':
                valid_resource_types[entity_name] = set(
                    type_attr['generator'].get('choices', [])
                )
                logger.debug(
                    f"Valid resource types for {entity_name}: "
                    f"{sorted(valid_resource_types[entity_name])}"
                )
    
    # Validate process configurations
    process_events = [e for e in config.get('events', []) if e.get('type') == 'Process']
    logger.info(f"Validating {len(process_events)} process events")
    
    for event in process_events:
        logger.debug(f"Validating process event: {event['name']}")
        
        if 'process_config' not in event:
            logger.warning(f"No process configuration found for event {event['name']}")
            continue
            
        process_config = event['process_config']
        if 'required_resources' not in process_config:
            logger.warning(f"No required resources specified for process {event['name']}")
            continue
            
        for resource_req in process_config['required_resources']:
            resource_table = resource_req.get('resource_table')
            resource_type = resource_req.get('type')
            
            if resource_table not in valid_resource_types:
                raise ValueError(
                    f"Invalid resource table {resource_table} in process {event['name']}"
                )
                
            if resource_type not in valid_resource_types[resource_table]:
                raise ValueError(
                    f"Invalid resource type {resource_type} for table {resource_table} "
                    f"in process {event['name']}. Valid types are: "
                    f"{sorted(valid_resource_types[resource_table])}"
                )
                
            logger.debug(
                f"Validated resource requirement: {resource_type} from {resource_table} "
                f"for process {event['name']}"
            )

def _validate_process_entities(config: Dict[str, Any], process_entities: List[str]):
    """Validate process entity configurations"""
    logger.info(f"Validating {len(process_entities)} process entities")
    
    for entity_name in process_entities:
        logger.debug(f"Validating process entity: {entity_name}")
        
        entity_config = next(
            (e for e in config['entities'] if e['name'] == entity_name),
            None
        )
        
        if not entity_config:
            raise ValueError(f"Process entity {entity_name} not found in configuration")
            
        # Validate required attributes
        required_attrs = ['status', 'type']
        missing_attrs = [
            attr for attr in required_attrs
            if not any(a['name'] == attr for a in entity_config['attributes'])
        ]
        
        if missing_attrs:
            raise ValueError(
                f"Process entity {entity_name} missing required attributes: "
                f"{', '.join(missing_attrs)}"
            )
            
        # Validate type attribute configuration
        type_attr = next(
            (attr for attr in entity_config['attributes'] if attr['name'] == 'type'),
            None
        )
        
        if type_attr and 'generator' in type_attr:
            generator = type_attr['generator']
            if generator.get('type') == 'distribution':
                if 'choices' not in generator:
                    raise ValueError(
                        f"Type attribute in {entity_name} must have choices defined"
                    )
                logger.debug(
                    f"Process entity {entity_name} has valid types: "
                    f"{generator.get('choices', [])}"
                )