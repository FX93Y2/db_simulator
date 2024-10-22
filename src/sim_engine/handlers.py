import logging
import random
from ..data_generator.entity_generator import EntityGenerator
from ..utils.distributions import get_distribution

logger = logging.getLogger(__name__)

def handle_create(engine, event):
    """Handle creation of new entities"""
    try:
        # Create entity generator instance with current config
        entity_generator = EntityGenerator(engine.config)
        
        # Get entity config
        entity_config = next(
            e for e in engine.config['entities'] 
            if e['name'] == event.entity_type
        )
        
        # Create single entity using the generator
        entity_data = entity_generator._create_single_entity(
            entity_config,
            engine.current_time,
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
    """Handle assignment events"""
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

        # Verify the target exists
        assigned_to_type = next(
            rel['to'] for rel in engine.config['relationships'] 
            if rel['from'] == entity_type
        )
        
        if assign_to not in engine.entities[assigned_to_type]:
            raise ValueError(f"Target {assigned_to_type} with ID {assign_to} does not exist")

        # Update the entity
        update_success = engine.db_manager.update(
            entity_type,
            event.entity_id,
            {relationship: assign_to}
        )
        
        if update_success:
            entity_data[relationship] = assign_to
            engine.entities[entity_type][event.entity_id] = entity_data
            logger.info(
                f"Time {engine.current_time}: "
                f"Assigned {relationship} {assign_to} to {entity_type} {event.entity_id}"
            )
        else:
            raise Exception(f"Failed to update {entity_type} {event.entity_id}")

        return event.entity_id
    except Exception as e:
        logger.error(f"Assignment failed: {str(e)}")
        raise

def handle_update(engine, event):
    """Handle update events"""
    try:
        entity = engine.db_manager.get(event.entity_type, event.entity_id)
        if not entity:
            raise ValueError(f"No {event.entity_type} found with ID {event.entity_id}")

        update_data = event.params.get('set', {})
        if not update_data:
            logger.warning("No update data provided")
            return

        update_success = engine.db_manager.update(
            event.entity_type,
            event.entity_id,
            update_data
        )
        
        if update_success:
            if event.entity_type in engine.entities and event.entity_id in engine.entities[event.entity_type]:
                engine.entities[event.entity_type][event.entity_id].update(update_data)
            logger.info(f"Updated {event.entity_type} {event.entity_id}")
        else:
            raise Exception(f"Failed to update {event.entity_type} {event.entity_id}")

        return event.entity_id
    except Exception as e:
        logger.error(f"Update failed: {str(e)}")
        raise

event_handlers = {
    "Create": handle_create,
    "Assign": handle_assign,
    "Update": handle_update
}