import random
from ..data_generator.entity_generator import create_entity
from ..utils.distributions import get_distribution

def handle_create(engine, event):
    entity_data = create_entity(engine.config, event.entity_type, engine.entities)
    entity_id = engine.db_manager.insert(event.entity_type, entity_data)
    if event.entity_type not in engine.entities:
        engine.entities[event.entity_type] = {}
    engine.entities[event.entity_type][entity_id] = entity_data
    print(f"Time {engine.current_time}: Created {event.entity_type} with ID {entity_id}")
    return entity_id

def handle_assign(engine, event):
    entity_type = event.entity_type
    params = event.params or {}
    
    relationship = params.get('relationship')
    if not relationship:
        print(f"Missing relationship parameter for assign event: {event}")
        return

    # Get all entities of the specified type that haven't been assigned yet
    unassigned_entities = [
        (entity_id, entity_data)
        for entity_id, entity_data in engine.entities[entity_type].items()
        if entity_data.get(relationship) is None
    ]

    if not unassigned_entities:
        print(f"No unassigned {entity_type} entities left")
        return

    # Randomly select an unassigned entity, this should be made customizable later
    entity_id, entity_data = random.choice(unassigned_entities)

    assigned_to_type = next(rel['to'] for rel in engine.config['relationships'] if rel['from'] == entity_type)
    valid_assign_to_ids = list(engine.entities[assigned_to_type].keys())

    if not valid_assign_to_ids:
        print(f"No valid {assigned_to_type} entities to assign to")
        return

    # Randomly select a valid ID to assign to
    assign_to = random.choice(valid_assign_to_ids)

    # Update the entity in memory and database
    update_success = engine.db_manager.update(entity_type, entity_id, {relationship: assign_to})
    if update_success:
        entity_data[relationship] = assign_to
        engine.entities[entity_type][entity_id] = entity_data
        print(f"Time {engine.current_time}: Assigned {relationship} {assign_to} to {entity_type} {entity_id}")
    else:
        print(f"Time {engine.current_time}: Failed to assign {relationship} {assign_to} to {entity_type} {entity_id}")

    return entity_id

def handle_update(engine, event):
    entity = engine.db_manager.get(event.entity_type, event.entity_id)
    if entity is None:
        print(f"No {event.entity_type} found with ID {event.entity_id} for update")
        return
    update_data = event.params.get('set', {})
    update_success = engine.db_manager.update(event.entity_type, event.entity_id, update_data)
    if update_success:
        if event.entity_type in engine.entities and event.entity_id in engine.entities[event.entity_type]:
            engine.entities[event.entity_type][event.entity_id].update(update_data)
        print(f"Time {engine.current_time}: Updated {event.entity_type} {event.entity_id}")
    else:
        print(f"Time {engine.current_time}: Failed to update {event.entity_type} {event.entity_id}")

event_handlers = {
    "Create": handle_create,
    "Assign": handle_assign,
    "Update": handle_update
}