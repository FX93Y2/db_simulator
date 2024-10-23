import logging
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
    """Handle assignment events with support for distribution-based assignments"""
    try:
        entity_type = event.entity_type
        params = event.params or {}
        
        relationship = params.get('relationship')
        assign_to = params.get('assign_to')
        
        if not relationship or assign_to is None:
            raise ValueError(f"Missing required parameters for assign event: {event}")

        # Get the entity to be assigned
        entity_data = engine.entities[entity_type].get(event.entity_id)
        if not entity_data:
            raise ValueError(f"No {entity_type} found with ID {event.entity_id}")

        # Get target entity type from relationships
        assigned_to_type = next(
            rel['to'] for rel in engine.config['relationships'] 
            if rel['from'] == entity_type
        )

        print(f"\nAvailable {assigned_to_type} IDs: {list(engine.entities[assigned_to_type].keys())}")

        # Handle distribution-based assignment
        target_id = assign_to
        if isinstance(assign_to, dict) and 'distribution' in assign_to:
            from ..data_generator.value_generator import value_generator
            
            # Create attribute config for ID generation
            id_attr = {
                'name': 'id',
                'type': 'integer',
                'generator': assign_to
            }
            
            # Try to generate a valid ID
            for attempt in range(5):
                target_id = value_generator._generate_id_value(
                    id_attr,
                    {'name': assigned_to_type},
                    engine.config
                )
                print(f"Generated target_id: {target_id} (attempt {attempt + 1})")
                
                if target_id in engine.entities[assigned_to_type]:
                    break
                    
                if attempt == 4:  # Last attempt
                    print(f"Failed to generate valid ID after 5 attempts")
                    engine.schedule_event(
                        event.name,
                        entity_type,
                        event.entity_id,
                        event.time + timedelta(minutes=30),
                        event.params
                    )
                    return None

        # Update the entity
        update_success = engine.db_manager.update(
            entity_type,
            event.entity_id,
            {relationship: target_id}
        )
        
        if update_success:
            entity_data[relationship] = target_id
            engine.entities[entity_type][event.entity_id] = entity_data
            print(f"Successfully assigned {relationship} {target_id} to {entity_type} {event.entity_id}")
            logger.info(
                f"Time {engine.current_time}: "
                f"Assigned {relationship} {target_id} to {entity_type} {event.entity_id}"
            )
        else:
            raise Exception(f"Failed to update {entity_type} {event.entity_id}")

        return event.entity_id
    except Exception as e:
        logger.error(f"Assignment failed: {str(e)}")
        raise

def handle_process(engine, event):
    """Handle process events with resource management"""
    try:
        # Get process configuration
        process_config = next(
            (p for p in engine.config['process_definitions'] if p['name'] == event.name),
            None
        )
        
        if not process_config:
            raise ValueError(f"No configuration found for process: {event.name}")

        # Get entity's arrival time
        entity_data = engine.entities[event.entity_type].get(event.entity_id)
        if not entity_data:
            raise ValueError(f"No {event.entity_type} found with ID {event.entity_id}")
        
        entity_arrival_time = entity_data.get('CreatedAt')
        if not entity_arrival_time:
            raise ValueError(f"Entity {event.entity_type} {event.entity_id} has no CreatedAt timestamp")

        # Ensure we don't start processing before entity arrives
        earliest_start_time = max(engine.current_time, entity_arrival_time)

        # Find available resources
        resources = engine.resource_manager.find_available_resources(
            process_config['required_resources']
        )
        
        if not resources:
            # Reschedule the event if resources are not available
            logger.info(f"Resources not available for process {event.name}. Rescheduling...")
            delay = timedelta(hours=1)  # Try again in 1 hour
            engine.schedule_event(
                event.name,
                event.entity_type,
                event.entity_id,
                earliest_start_time + delay,
                event.params
            )
            return None

        # Calculate process duration
        duration_dist = process_config['duration']
        distribution = get_distribution(duration_dist)
        duration_hours = distribution()

        # Calculate process timing considering work hours, starting from entity arrival
        start_time, end_time = engine.resource_manager.calculate_work_hours(
            earliest_start_time,
            duration_hours
        )

        # Record timing in event
        event.record_process_timing(start_time, end_time)
        event.allocate_resources(resources)

        # Allocate resources
        process_id = f"{event.name}_{event.entity_id}_{start_time.isoformat()}"
        engine.resource_manager.allocate_resources(process_id, resources)

        # Update target entity status
        update_data = {}
        for update in process_config['updates']:
            if update['value'] == 'completion_time':
                update_data[update['field']] = end_time
            else:
                update_data[update['field']] = update['value']

        engine.db_manager.update(
            process_config['target_entity'],
            event.entity_id,
            update_data
        )

        # Generate process mapping records
        mapping_table = f"{process_config['target_entity']}_{process_config['resource_tracking'][0]['relationship_with']}_Process"
        
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

        # Schedule resource release
        engine.schedule_event(
            f"Release_{event.name}",
            event.entity_type,
            event.entity_id,
            end_time,
            {'process_id': process_id}
        )

        logger.info(
            f"Started process {event.name} for {event.entity_type} {event.entity_id}. "
            f"Duration: {duration_hours:.2f} hours"
        )

        return event.entity_id
    except Exception as e:
        logger.error(f"Process failed: {str(e)}")
        raise

def handle_release(engine, event):
    """Handle resource release events"""
    try:
        process_id = event.params.get('process_id')
        if not process_id:
            raise ValueError("No process_id provided for release event")
            
        engine.resource_manager.release_resources(process_id)
        logger.info(f"Released resources for process {process_id}")
        
        return event.entity_id
    except Exception as e:
        logger.error(f"Release failed: {str(e)}")
        raise

event_handlers = {
    "Create": handle_create,
    "Assign": handle_assign,
    "Process": handle_process,
    "Release": handle_release
}