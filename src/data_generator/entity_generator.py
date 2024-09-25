from .value_generator import generate_attribute_value

def generate_initial_entities(config):
    entities = {}
    for entity_config in config['entities']:
        entity_type = entity_config['name']
        entities[entity_type] = {}
        count = config['initial_population'][entity_type]['count']
        for i in range(count):
            entities[entity_type][i] = create_entity(config, entity_type)
    return entities

def create_entity(config, entity_type):
    entity_config = next(e for e in config['entities'] if e['name'] == entity_type)
    entity = {attr['name']: generate_attribute_value(attr) for attr in entity_config['attributes']}
    return entity