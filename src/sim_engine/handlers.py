import logging
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
from ..utils.distributions import get_distribution
from ..utils.time_utils import (
    calculate_work_end_time,
    calculate_working_hours,
    validate_work_schedule
)

logger = logging.getLogger(__name__)

class TableType:
    RESOURCE = 'resource'
    PROCESS_ENTITY = 'process_entity'
    MAPPING = 'mapping'

class ProcessStatus:
    """Status constants for process entities"""
    NOT_STARTED = 'Not Started'
    IN_PROGRESS = 'In Progress'
    COMPLETED = 'Completed'

class ResourceStatus:
    """Status constants for resources"""
    AVAILABLE = 'Available'
    BUSY = 'Busy'

def handle_process(engine, event):
    """Handle process events with table type awareness"""
    try:
        # Validate that entity is a process entity
        entity_config = next(
            (e for e in engine.config['entities'] 
             if e['name'] == event.entity_type),
            None
        )
        
        if not entity_config or entity_config.get('type') != TableType.PROCESS_ENTITY:
            raise ValueError(
                f"Entity {event.entity_type} is not a process entity. "
                f"Process events can only be applied to process entities."
            )

        # Find process configuration
        process_config = next(
            (e for e in engine.config['events'] 
             if e['name'] == event.name and e['type'] == 'Process'),
            None
        )
        
        if not process_config:
            raise ValueError(f"No process configuration found for: {event.name}")

        # Get work schedule from simulation parameters
        work_schedule = engine.config['simulation_parameters']['work_schedule']
        hours_per_day = work_schedule.get('hours_per_day', 8)
        start_hour = work_schedule.get('start_hour', 9)
        end_hour = work_schedule.get('end_hour', 17)
        work_days = work_schedule.get('work_days', [1, 2, 3, 4, 5])

        # Calculate process duration
        duration_config = process_config['process_config']['duration']
        distribution = get_distribution(duration_config)
        total_hours = distribution()

        # Calculate process timing
        start_time = _align_to_work_hours(
            event.time,
            engine.resource_manager.work_schedule['start_hour'],
            engine.resource_manager.work_schedule['end_hour'],
            engine.resource_manager.work_schedule['work_days']
        )

        end_time = calculate_work_end_time(
            start_time,
            total_hours,
            hours_per_day,
            start_hour,
            end_hour,
            work_days
        )
        
        logger.debug(
            f"Processing event: {event.name} for {event.entity_type} {event.entity_id} "
            f"at time {start_time}"
        )
        # Find required resources
        required_resources = process_config['process_config']['required_resources']
        logger.debug(f"Looking for resources: {required_resources}")
        logger.debug(f"Available resources: {engine.resource_manager.get_available_resource_types()}")
        
        resources = engine.resource_manager.find_available_resources(
            required_resources,
            start_time
        )
        
        if not resources:
            logger.info(
                f"Resource allocation failed for {event.name}. "
                f"Required: {required_resources}. "
                f"Available types: {engine.resource_manager.get_available_resource_types()}"
            )
            # Reschedule if resources not available
            delay = timedelta(hours=1)
            new_time = start_time + delay
            if new_time < engine.end_time:
                engine.schedule_event(
                    event.name,
                    event.entity_type,
                    event.entity_id,
                    new_time,
                    event.params
                )
            return None

        distributed_hours = _distribute_hours(total_hours, resources)
        process_id = f"{event.name}_{event.entity_id}_{start_time.isoformat()}"
        engine.resource_manager.seize_resources(process_id, resources, start_time)

        # Create mapping table entries
        _create_mapping_entries(
            engine,
            event.entity_type,
            event.entity_id,
            resources,
            event.name,
            start_time,
            end_time,
            distributed_hours
        )

        # Update process entity status
        update_data = {'status': ProcessStatus.IN_PROGRESS}
        engine.db_manager.update(event.entity_type, event.entity_id, update_data)
        engine.schedule_event(
            f"Complete_{event.name}",
            event.entity_type,
            event.entity_id,
            end_time,
            {'process_id': process_id}
        )

        logger.info(
            f"Started process {event.name} for {event.entity_type} {event.entity_id}. "
            f"Duration: {total_hours:.2f} hours"
        )

        return event.entity_id

    except Exception as e:
        logger.error(f"Process handling failed: {str(e)}")
        raise

def handle_process_completion(engine, event):
    """Handle process completion events"""
    try:
        # Validate entity type
        entity_config = next(
            (e for e in engine.config['entities'] 
             if e['name'] == event.entity_type),
            None
        )
        
        if not entity_config or entity_config.get('type') != TableType.PROCESS_ENTITY:
            raise ValueError(f"Invalid entity type for process completion: {event.entity_type}")

        # Get process ID from event params
        process_id = event.params.get('process_id')
        if not process_id:
            raise ValueError("No process_id provided for completion event")

        # Release resources
        engine.resource_manager.release_resources(process_id, event.time)

        # Update process entity status
        update_data = {
            'status': ProcessStatus.COMPLETED,
            'end_date': event.time
        }
        engine.db_manager.update(event.entity_type, event.entity_id, update_data)

        logger.info(
            f"Completed process {event.name.replace('Complete_', '')} for "
            f"{event.entity_type} {event.entity_id}"
        )
        
        return event.entity_id

    except Exception as e:
        logger.error(f"Process completion failed: {str(e)}")
        raise

def _create_mapping_entries(
    engine,
    entity_type: str,
    entity_id: int,
    resources: Dict[str, List[Tuple[str, int]]],
    process_name: str,
    start_time: datetime,
    end_time: datetime,
    distributed_hours: Dict[Tuple[str, int], float]
):
    """Create process tracking entries in mapping tables"""
    for resource_type, resource_list in resources.items():
        for table_name, resource_id in resource_list:
            mapping_table = f"{entity_type}_{table_name}_Process"
            
            mapping_data = {
                f"{entity_type.lower()}_id": entity_id,
                f"{table_name.lower()}_id": resource_id,
                'process_name': process_name,
                'start_time': start_time,
                'end_time': end_time,
                'hours_worked': distributed_hours.get((table_name, resource_id), 0.0)
            }
            
            engine.db_manager.insert(mapping_table, mapping_data)

def _distribute_hours(
    total_hours: float,
    resources: Dict[str, List[Tuple[str, int]]]
) -> Dict[Tuple[str, int], float]:
    """Distribute total hours among resources"""
    distributed_hours = {}
    total_resources = sum(len(resource_list) for resource_list in resources.values())
    base_hours = total_hours / total_resources

    # Distribute hours with small random variations
    for resource_type, resource_list in resources.items():
        for table_name, resource_id in resource_list:
            variation = random.uniform(-0.1, 0.1)  # ±10% variation
            hours = base_hours * (1 + variation)
            distributed_hours[(table_name, resource_id)] = hours

    # Normalize to ensure total matches original
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

# Update event handlers dictionary
event_handlers = {
    "Process": handle_process,
    "Complete": handle_process_completion
}