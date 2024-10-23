import logging
import datetime
import random
from typing import Dict, Any, List, Tuple
from datetime import timedelta
from ..utils.distributions import get_distribution
from ..data_generator.entity_generator import EntityGenerator
from ..utils.time_utils import (
    calculate_work_end_time,
    calculate_working_hours,
    validate_work_schedule
)

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
    """Handle process events with distributed work hours"""
    try:
        process_config = next(
            (p for p in engine.config['process_definitions'] if p['name'] == event.name),
            None
        )
        
        if not process_config:
            raise ValueError(f"No configuration found for process: {event.name}")

        # Generate randomized total hours if configured
        base_hours = float(process_config.get('total_hours', 120))
        if process_config.get('randomize_hours'):
            # Default variation of ±20% if not specified
            variation = process_config.get('hours_variation', 0.2)
            min_hours = base_hours * (1 - variation)
            max_hours = base_hours * (1 + variation)
            total_hours = random.uniform(min_hours, max_hours)
        else:
            total_hours = base_hours

        # Get work schedule
        work_schedule = process_config.get('work_schedule', {})
        hours_per_day = work_schedule.get('hours_per_day', 8)
        start_hour = work_schedule.get('start_hour', 9)
        end_hour = work_schedule.get('end_hour', 17)
        work_days = work_schedule.get('work_days', [1, 2, 3, 4, 5])

        # Calculate start and end times
        start_time = _align_to_work_hours(
            engine.current_time,
            start_hour,
            end_hour,
            work_days
        )

        end_time = calculate_work_end_time(
            start_time,
            total_hours,
            hours_per_day,
            start_hour,
            end_hour,
            work_days
        )

        # Handle resource allocation
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
                    start_time + delay,
                    event.params
                )
                return None

            # Distribute hours among team members based on role
            distributed_hours = _distribute_hours(total_hours, resources, process_config)

            # Record timing and resources
            event.record_process_timing(start_time, end_time)
            event.allocate_resources(resources)

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
                            'hours_worked': distributed_hours[(table_name, resource_id)]
                        }
                        engine.db_manager.insert(mapping_table, mapping_data)

            # Update process status
            if 'updates' in process_config:
                update_data = {}
                for update in process_config['updates']:
                    if isinstance(update, dict):
                        if 'field' in update and 'value' in update:
                            value = end_time if update['value'] == 'completion_time' else update['value']
                            update_data[update['field']] = value

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

        logger.info(
            f"Started process {event.name} for {event.entity_type} {event.entity_id}. "
            f"Total Duration: {total_hours:.2f} hours"
        )

        return event.entity_id
    except Exception as e:
        logger.error(f"Process failed: {str(e)}")
        raise

def _distribute_hours(
    total_hours: float,
    resources: Dict[str, List[Tuple[str, int]]],
    process_config: Dict
) -> Dict[Tuple[str, int], float]:
    """Distribute total hours among team members based on role"""
    distributed_hours = {}
    
    # Get role weights from config or use defaults
    role_weights = {
        'Tech Lead': 0.2,    # 20% of work
        'Developer': 0.35,   # 35% of work per developer
        'Tester': 0.3        # 30% of work
    }
    
    if 'role_weights' in process_config:
        role_weights.update(process_config['role_weights'])
    
    # Calculate base hours per role
    hours_per_role = {}
    for resource_type, resource_list in resources.items():
        if resource_type not in role_weights:
            # Divide remaining hours equally if no weight specified
            weight = 1.0 / len(resource_list)
        else:
            weight = role_weights[resource_type]
        
        base_hours = total_hours * weight
        if len(resource_list) > 1:
            # Divide role hours among multiple resources of same type
            base_hours = base_hours / len(resource_list)
        
        hours_per_role[resource_type] = base_hours

    # Add randomization to individual contributions (±10%)
    for resource_type, resource_list in resources.items():
        base_hours = hours_per_role[resource_type]
        for table_name, resource_id in resource_list:
            # Add small random variation to individual contributions
            variation = random.uniform(-0.1, 0.1)
            hours = base_hours * (1 + variation)
            distributed_hours[(table_name, resource_id)] = hours

    # Normalize to ensure total equals original total_hours
    current_total = sum(distributed_hours.values())
    scale_factor = total_hours / current_total
    for key in distributed_hours:
        distributed_hours[key] *= scale_factor

    return distributed_hours

def _align_to_work_hours(
    current_time: datetime,
    start_hour: int,
    end_hour: int,
    work_days: List[int]
) -> datetime:
    """Align time to next valid work hour"""
    time = current_time

    # Skip non-working days
    while time.weekday() + 1 not in work_days:
        time = time.replace(hour=start_hour, minute=0, second=0) + timedelta(days=1)

    # Align to work hours
    if time.hour < start_hour:
        time = time.replace(hour=start_hour, minute=0, second=0)
    elif time.hour >= end_hour:
        time = (time + timedelta(days=1)).replace(hour=start_hour, minute=0, second=0)
        # Check next day
        while time.weekday() + 1 not in work_days:
            time = time + timedelta(days=1)

    return time

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