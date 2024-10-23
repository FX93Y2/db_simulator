from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

def enhance_config(config: Dict) -> Dict:
    """Enhance configuration with additional features if needed"""
    enhanced_config = config.copy()
    
    # Only enhance if process tracking is needed
    if has_process_tracking(config):
        enhanced_config = enhance_with_mappings(enhanced_config)
    
    return enhanced_config

def has_process_tracking(config: Dict) -> bool:
    """Check if configuration requires process tracking"""
    # Check for process definitions
    if 'process_definitions' not in config:
        return False
        
    for relationship in config.get('relationships', []):
        if relationship.get('type') == 'many_to_many' and relationship.get('track_process'):
            return True
            
    return False

def enhance_with_mappings(config: Dict) -> Dict:
    """Add mapping tables for process tracking"""
    new_config = config.copy()
    new_entities = list(config['entities'])
    new_relationships = list(config.get('relationships', []))
    
    # Find relationships that need mapping tables
    processed_relationships = []
    for relationship in config.get('relationships', []):
        if relationship.get('type') == 'many_to_many' and relationship.get('track_process'):
            # Get process tracking information
            process_tracking = []
            for process in config.get('process_definitions', []):
                for tracking in process.get('resource_tracking', []):
                    if tracking['relationship_with'] == relationship['to']:
                        process_tracking.extend(tracking['track'])

            # Generate mapping table configuration
            mapping_table = create_mapping_table_config(
                relationship['from'],
                relationship['to'],
                process_tracking
            )
            new_entities.append(mapping_table)
            
            # Add new relationships for the mapping table
            mapping_relationships = create_mapping_relationships(
                relationship['from'],
                relationship['to'],
                mapping_table['name']
            )
            new_relationships.extend(mapping_relationships)
            
            processed_relationships.append(relationship)
    
    for rel in processed_relationships:
        new_relationships.remove(rel)
    
    new_config['entities'] = new_entities
    new_config['relationships'] = new_relationships
    return new_config

def create_mapping_table_config(from_entity: str, to_entity: str, process_tracking: List[str]) -> Dict:
    """Create configuration for a mapping table"""
    table_name = f"{from_entity}_{to_entity}_Process"
    
    attributes = [
        {
            'name': 'id',
            'type': 'int',
            'primary_key': True
        },
        {
            'name': f'{from_entity.lower()}_id',
            'type': 'int',
            'foreign_key': f'{from_entity}.id'
        },
        {
            'name': f'{to_entity.lower()}_id',
            'type': 'int',
            'foreign_key': f'{to_entity}.id'
        }
    ]
    
    # Add process tracking attributes
    process_attributes = {
        'start_time': {'type': 'datetime'},
        'end_time': {'type': 'datetime'},
        'hours_worked': {'type': 'float'},
        'process_name': {'type': 'string'}
    }
    
    for track_field in process_tracking:
        if track_field in process_attributes:
            attributes.append({
                'name': track_field,
                'type': process_attributes[track_field]['type']
            })
    
    return {
        'name': table_name,
        'attributes': attributes,
        'auto_generated': True
    }

def create_mapping_relationships(from_entity: str, to_entity: str, mapping_table: str) -> List[Dict]:
    """Create relationships for the mapping table"""
    return [
        {
            'from': mapping_table,
            'to': from_entity,
            'type': 'many_to_one'  
        },
        {
            'from': mapping_table,
            'to': to_entity,
            'type': 'many_to_one'  
        }
    ]