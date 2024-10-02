from .value_generator import generate_attribute_value
import logging

logger = logging.getLogger(__name__)

def generate_initial_entities(config):
    entities = {}
    # First, identify entities with no dependencies
    independent_entities = [entity['name'] for entity in config['entities'] if not any('foreign_key' in attr for attr in entity['attributes'])]
    
    # Generate independent entities first
    for entity_name in independent_entities:
        entity_config = next(e for e in config['entities'] if e['name'] == entity_name)
        count = config['initial_population'][entity_name]['count']
        entities[entity_name] = {
            i: create_entity(entity_config, config)
            for i in range(1, count + 1)  # Start IDs from 1
        }
    
    # Then generate dependent entities
    dependent_entities = [entity['name'] for entity in config['entities'] if entity['name'] not in independent_entities]
    for entity_name in dependent_entities:
        entity_config = next(e for e in config['entities'] if e['name'] == entity_name)
        count = config['initial_population'][entity_name]['count']
        entities[entity_name] = {
            i: create_entity(entity_config, config, entities)
            for i in range(1, count + 1)  # Start IDs from 1
        }
    
    return entities

def create_entity(entity_config, global_config, existing_entities=None):
    entity = {}
    for attr in entity_config['attributes']:
        if attr['name'] == 'id':
            continue  # Skip
        if 'foreign_key' in attr:
            if existing_entities:
                ref_entity, _ = attr['foreign_key'].split('.')
                valid_ids = list(existing_entities[ref_entity].keys())
                if not valid_ids:
                    logger.warning(f"No valid IDs found for foreign key {attr['name']} referencing {ref_entity}")
                    entity[attr['name']] = None
                else:
                    entity[attr['name']] = generate_attribute_value(
                        attr_config={
                            'name': attr['name'],
                            'type': 'choice',
                            'choices': valid_ids
                        },
                        entity_config=entity_config,
                        global_config=global_config
                    )
            else:
                entity[attr['name']] = None  # Will be assigned later
        else:
            entity[attr['name']] = generate_attribute_value(attr, entity_config, global_config)
    return entity