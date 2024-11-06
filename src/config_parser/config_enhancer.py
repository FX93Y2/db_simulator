from typing import Dict, List
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


class TableType:
    RESOURCE = 'resource'
    PROCESS_ENTITY = 'process_entity'

class EntityStatus:
    NOT_STARTED = 'Not Started'
    IN_PROGRESS = 'In Progress'
    COMPLETED = 'Completed'

class ResourceStatus:
    AVAILABLE = 'Available'
    BUSY = 'Busy'

def enhance_config(config: Dict) -> Dict:
    """Enhance configuration with additional features and standardization"""
    enhanced_config = deepcopy(config)
    _validate_table_types(enhanced_config)
    
    if needs_process_tracking(enhanced_config):
        enhanced_config = enhance_with_process_tracking(enhanced_config)
    
    enhanced_config = consolidate_work_schedule(enhanced_config)

    if 'initial_population' in enhanced_config:
        for entity_config in enhanced_config['initial_population'].values():
            entity_config.pop('creation_time_distribution', None)
            entity_config.pop('attributes', None)

    validate_enhanced_config(enhanced_config)
    
    return enhanced_config

def _validate_table_types(config: Dict):
    """Validate that all entities have valid table types"""
    for entity in config.get('entities', []):
        if 'type' not in entity:
            raise ValueError(f"Entity {entity.get('name', 'unknown')} missing required 'type' field")
            
        if entity['type'] not in [TableType.RESOURCE, TableType.PROCESS_ENTITY]:
            raise ValueError(
                f"Invalid table type '{entity.get('type')}' for {entity.get('name')}. "
                f"Must be either '{TableType.RESOURCE}' or '{TableType.PROCESS_ENTITY}'"
            )

def needs_process_tracking(config: Dict) -> bool:
    """Check if configuration requires process tracking"""
    if 'events' not in config:
        return False
        
    return any(
        event.get('type') == 'Process'
        for event in config['events']
    )

def enhance_with_process_tracking(config: Dict) -> Dict:
    """Add process tracking tables and relationships"""
    new_config = deepcopy(config)
    new_entities = list(config['entities'])
    new_relationships = list(config.get('relationships', []))
    
    # Find process entities and resources
    process_entities = {
        entity['name'] for entity in config['entities']
        if entity['type'] == TableType.PROCESS_ENTITY
    }
    
    resource_entities = {
        entity['name'] for entity in config['entities']
        if entity['type'] == TableType.RESOURCE
    }
    
    # Create process tracking tables for each process entity-resource combination
    for process_entity in process_entities:
        for resource_entity in resource_entities:
            mapping_table = create_process_tracking_table(process_entity, resource_entity)
            if not any(e['name'] == mapping_table['name'] for e in new_entities):
                new_entities.append(mapping_table)
                
                # Add relationships for the mapping table
                new_relationships.extend(
                    create_process_tracking_relationships(
                        process_entity,
                        resource_entity,
                        mapping_table['name']
                    )
                )
    
    new_config['entities'] = new_entities
    new_config['relationships'] = new_relationships
    return new_config

def create_process_tracking_table(process_entity: str, resource_entity: str) -> Dict:
    """Create configuration for process tracking table"""
    table_name = f"{process_entity}_{resource_entity}_Process"
    
    return {
        'name': table_name,
        'auto_generated': True,
        'type': 'mapping',  # Special type for mapping tables
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
                'type': 'float'
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

def validate_enhanced_config(config: Dict):
    """Validate the enhanced configuration"""
    # Collect valid resource types from entity config
    valid_resource_types = set()
    resource_entities = []
    process_entities = []
    
    for entity in config['entities']:
        if entity.get('type') == TableType.RESOURCE:
            resource_entities.append(entity['name'])
            # Look for role/type attribute with distribution and choices
            for attr in entity['attributes']:
                if (attr.get('generator', {}).get('type') == 'distribution' and 
                    'choices' in attr.get('generator', {})):
                    valid_resource_types.update(attr['generator']['choices'])
        elif entity.get('type') == TableType.PROCESS_ENTITY:
            process_entities.append(entity['name'])
    
    # Check process events
    for event in config['events']:
        if event.get('type') == 'Process':
            entity = event.get('entity')
            if entity not in process_entities:
                raise ValueError(
                    f"Process event references non-process entity: {entity}. "
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