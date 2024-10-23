import logging
import datetime
from typing import Dict, Any, Optional
from datetime import timedelta
from ..utils.distributions import get_distribution
from ..data_generator.entity_generator import EntityGenerator

logger = logging.getLogger(__name__)

def handle_create(engine, event):
    """Handle creation of new entities"""
    try:
        entity_config = next(
            e for e in engine.config['entities'] 
            if e['name'] == event.entity_type
        )
        
        # Create an entity using EntityGenerator
        generator = EntityGenerator(engine.config)
        entity_data = generator._create_single_entity(
            entity_config,
            event.time,
            engine.entities
        )
        
        entity_id = engine.db_manager.insert(event.entity_type, entity_data)
        
        if event.entity_type not in engine.entities:
            engine.entities[event.entity_type] = {}
            
        engine.entities[event.entity_type][entity_id] = entity_data
        logger.info(f"Created {event.entity_type} with ID {entity_id}")
        
        return entity_id
    except Exception as e:
        logger.error(f"Failed to create entity: {str(e)}")
        raise

def handle_assign(engine, event):
    """Handle assignment events with support for many-to-many relationships and multiple assignments"""
    try:
        entity_type = event.entity_type
        params = event.params or {}
        
        # Find relationship configuration
        relationship = None
        for rel in engine.config.get('relationships', []):
            if rel['from'] == entity_type or rel['to'] == entity_type:
                relationship = rel
                break
                
        if not relationship:
            raise ValueError(f"No relationship found for entity type: {entity_type}")
        
        # Handle both directions of the relationship
        if relationship['from'] == entity_type:
            from_entity_type = entity_type
            to_entity_type = relationship['to']
        else:
            from_entity_type = relationship['to']
            to_entity_type = entity_type
            
        # Get the entity to be assigned
        entity_data = engine.entities[entity_type].get(event.entity_id)
        if not entity_data:
            raise ValueError(f"No {entity_type} found with ID {event.entity_id}")

        # Get number of assignments to make
        num_assignments = params.get('multiple', 1)
        
        # Track successful assignments
        assigned_ids = set()
        assignment_attempts = 0
        max_attempts = num_assignments * 5  # Allow multiple attempts per required assignment

        while len(assigned_ids) < num_assignments and assignment_attempts < max_attempts:
            assignment_attempts += 1
            
            # Handle distribution-based assignment
            assign_to = params.get('assign_to')
            if not assign_to:
                raise ValueError(f"No assign_to parameter specified in event: {event}")

            target_id = None
            if isinstance(assign_to, dict) and 'distribution' in assign_to:
                from ..data_generator.value_generator import value_generator
                
                # Create attribute config for ID generation
                id_attr = {
                    'name': 'id',
                    'type': 'integer',
                    'generator': assign_to
                }
                
                # Generate ID and validate
                target_id = value_generator._generate_id_value(
                    id_attr,
                    {'name': to_entity_type},
                    engine.config
                )
                
                # Skip if ID already assigned or invalid
                if (target_id not in engine.entities[to_entity_type] or 
                    target_id in assigned_ids):
                    continue
                    
                assigned_ids.add(target_id)
            else:
                target_id = assign_to
                assigned_ids.add(target_id)

            # For many-to-many relationships, create mapping table entry
            if relationship['type'] == 'many_to_many':
                mapping_table_name = f"{from_entity_type}_{to_entity_type}_Process"
                
                # Ensure correct order of IDs in mapping table
                mapping_data = {
                    f'{from_entity_type.lower()}_id': (
                        event.entity_id if entity_type == from_entity_type else target_id
                    ),
                    f'{to_entity_type.lower()}_id': (
                        target_id if entity_type == from_entity_type else event.entity_id
                    )
                }
                
                # Add the mapping record
                mapping_id = engine.db_manager.insert(mapping_table_name, mapping_data)
                
                # Update the in-memory entities
                if mapping_table_name not in engine.entities:
                    engine.entities[mapping_table_name] = {}
                engine.entities[mapping_table_name][mapping_id] = mapping_data
                
                logger.info(
                    f"Created {mapping_table_name} entry: {from_entity_type} "
                    f"{mapping_data[f'{from_entity_type.lower()}_id']} -> "
                    f"{to_entity_type} {mapping_data[f'{to_entity_type.lower()}_id']}"
                )

        if len(assigned_ids) < num_assignments:
            logger.warning(
                f"Could only make {len(assigned_ids)} assignments out of "
                f"{num_assignments} requested for {entity_type} {event.entity_id}"
            )
            # Reschedule event if needed
            if len(assigned_ids) == 0:
                engine.schedule_event(
                    event.name,
                    entity_type,
                    event.entity_id,
                    event.time + timedelta(minutes=30),
                    event.params
                )
                return None

        return event.entity_id
    except Exception as e:
        logger.error(f"Assignment failed: {str(e)}")
        raise
    
def _process_updates(update_config: Dict[str, Any], event_time: datetime) -> Dict[str, Any]:
    """Process update configuration and return update data"""
    update_data = {}
    
    # Handle old format (field/value pairs)
    if 'field' in update_config and 'value' in update_config:
        value = (
            event_time if update_config['value'] == 'completion_time'
            else update_config['value']
        )
        update_data[update_config['field']] = value
    
    # Handle new format (when/fields structure)
    elif 'when' in update_config and 'fields' in update_config:
        for field, value in update_config['fields'].items():
            update_data[field] = (
                event_time if value == 'completion_time'
                else value
            )
            
    return update_data
def handle_process(engine, event):
    """Handle process events with resource management"""
    try:
        process_config = next(
            (p for p in engine.config['process_definitions'] if p['name'] == event.name),
            None
        )
        
        if not process_config:
            raise ValueError(f"No configuration found for process: {event.name}")

        entity_data = engine.entities[event.entity_type].get(event.entity_id)
        if not entity_data:
            raise ValueError(f"No {event.entity_type} found with ID {event.entity_id}")

        # Check if using work schedule
        using_work_schedule = (
            'work_schedule' in process_config and 
            engine.resource_manager is not None
        )

        # Get start time based on configuration
        if using_work_schedule:
            entity_arrival_time = entity_data.get('CreatedAt')
            if not entity_arrival_time:
                raise ValueError(
                    f"Entity {event.entity_type} {event.entity_id} has no CreatedAt timestamp"
                )
            earliest_start_time = max(engine.current_time, entity_arrival_time)
        else:
            earliest_start_time = engine.current_time

        # Initialize duration tracking
        duration_hours = None
        start_time = None
        end_time = None

        # Handle resource allocation if needed
        if 'required_resources' in process_config:
            resources = engine.resource_manager.find_available_resources(
                process_config['required_resources']
            )
            
            if not resources:
                delay = timedelta(hours=1)
                engine.schedule_event(
                    event.name,
                    event.entity_type,
                    event.entity_id,
                    earliest_start_time + delay,
                    event.params
                )
                return None

            # Calculate timing with work schedule
            if using_work_schedule:
                duration_hours = float(process_config['total_hours'])
                start_time, end_time = engine.resource_manager.calculate_work_hours(
                    earliest_start_time,
                    duration_hours
                )
            else:
                duration_dist = process_config['duration']
                distribution = get_distribution(duration_dist)
                duration_hours = float(distribution())
                start_time = earliest_start_time
                end_time = start_time + timedelta(hours=duration_hours)

            # Record timing and resources
            event.record_process_timing(start_time, end_time)
            event.allocate_resources(resources)

            # Allocate resources
            process_id = f"{event.name}_{event.entity_id}_{start_time.isoformat()}"
            engine.resource_manager.seize_resources(process_id, resources)

            # Create process mapping records
            if process_config.get('resource_tracking'):
                mapping_table = (
                    f"{process_config['target_entity']}_"
                    f"{process_config['resource_tracking'][0]['relationship_with']}_Process"
                )
                
                for resource_type, resource_list in resources.items():
                    for table_name, resource_id in resource_list:
                        mapping_data = {
                            f"{process_config['target_entity'].lower()}_id": event.entity_id,
                            f"{table_name.lower()}_id": resource_id,
                            'process_name': event.name,
                            'start_time': start_time,
                            'end_time': end_time,
                            'hours_worked': (end_time - start_time).total_seconds() / 3600
                        }
                        engine.db_manager.insert(mapping_table, mapping_data)

            # Update process status if configured
            if 'updates' in process_config:
                update_data = {}
                for update in process_config['updates']:
                    update_data.update(_process_updates(update, end_time))

                if update_data:
                    engine.db_manager.update(
                        process_config['target_entity'],
                        event.entity_id,
                        update_data
                    )

            # Schedule completion event
            engine.schedule_event(
                f"Complete_{event.name}",
                event.entity_type,
                event.entity_id,
                end_time,
                {'process_id': process_id}
            )

        else:
            # Simple process without resource requirements
            duration_hours = 1.0  # Default duration
            start_time = earliest_start_time
            end_time = start_time + timedelta(hours=duration_hours)

        logger.info(
            f"Started process {event.name} for {event.entity_type} {event.entity_id}. "
            f"Duration: {duration_hours:.2f} hours"
        )

        return event.entity_id
    except Exception as e:
        logger.error(f"Process failed: {str(e)}")
        raise

def handle_process_completion(engine, event):
    """Handle process completion events"""
    try:
        process_config = next(
            (p for p in engine.config['process_definitions'] if p['name'] == event.name.replace('Complete_', '')),
            None
        )
        
        if not process_config:
            raise ValueError(f"No configuration found for process: {event.name}")

        # Release resources
        process_id = event.params.get('process_id')
        if not process_id:
            raise ValueError("No process_id provided for completion event")
            
        engine.resource_manager.release_resources(process_id)

        # Update completion status
        if 'updates' in process_config:
            # Process all updates and get completion values
            update_data = {}
            for update in process_config['updates']:
                # Use the existing _process_updates helper
                update_data.update(_process_updates(update, event.time))

            if update_data:
                engine.db_manager.update(
                    process_config['target_entity'],
                    event.entity_id,
                    update_data
                )

        logger.info(
            f"Completed {event.name.replace('Complete_', '')} for "
            f"{event.entity_type} {event.entity_id}"
        )
        
        return event.entity_id
    except Exception as e:
        logger.error(f"Completion failed: {str(e)}")
        raise

# Update event handlers dictionary
event_handlers = {
    "Create": handle_create,
    "Assign": handle_assign,
    "Process": handle_process,
    "Complete": handle_process_completion
}