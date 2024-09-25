from ..data_generator.entity_generator import create_entity

def handle_create(engine, event):
    entity_data = create_entity(engine.config, event.entity_type)
    entity_id = engine.db_manager.insert(event.entity_type, entity_data)
    if event.entity_type not in engine.entities:
        engine.entities[event.entity_type] = {}
    engine.entities[event.entity_type][entity_id] = entity_data
    print(f"Time {engine.current_time}: Created {event.entity_type} with ID {entity_id}")

def handle_assign(engine, event):
    entity = engine.db_manager.get(event.entity_type, event.entity_id)
    assign_to = event.params['assign_to']
    relationship = event.params['relationship']
    entity[relationship] = assign_to
    engine.db_manager.update(event.entity_type, event.entity_id, {relationship: assign_to})
    if event.entity_type in engine.entities and event.entity_id in engine.entities[event.entity_type]:
        engine.entities[event.entity_type][event.entity_id][relationship] = assign_to
    print(f"Time {engine.current_time}: Assigned {assign_to} to {event.entity_type} {event.entity_id}")

def handle_update(engine, event):
    entity = engine.db_manager.get(event.entity_type, event.entity_id)
    for key, value in event.params['set'].items():
        entity[key] = value
    engine.db_manager.update(event.entity_type, event.entity_id, event.params['set'])
    if event.entity_type in engine.entities and event.entity_id in engine.entities[event.entity_type]:
        engine.entities[event.entity_type][event.entity_id].update(event.params['set'])
    print(f"Time {engine.current_time}: Updated {event.entity_type} {event.entity_id}")

event_handlers = {
    "Create": handle_create,
    "Assign": handle_assign,
    "Update": handle_update
}