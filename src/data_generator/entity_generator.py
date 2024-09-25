from .value_generator import generate_attribute_value

from faker import Faker
import random

fake = Faker()

def generate_initial_entities(config):
    entities = {}
    for entity in config['entities']:
        entity_name = entity['name']
        entities[entity_name] = {}
        
        if entity_name in config['initial_population']:
            count = config['initial_population'][entity_name]['count']
            for _ in range(count):
                entity_data = {}
                for attr in entity['attributes']:
                    if attr['name'] != 'id':  # Skip ID as it's auto-generated
                        if 'generator' in attr:
                            if attr['generator']['type'] == 'faker':
                                entity_data[attr['name']] = getattr(fake, attr['generator']['method'])()
                            elif attr['generator']['type'] == 'uniform':
                                entity_data[attr['name']] = random.uniform(attr['generator']['min'], attr['generator']['max'])
                        elif 'choices' in attr:
                            if 'distribution' in config['initial_population'][entity_name]['attributes'].get(attr['name'], {}):
                                weights = config['initial_population'][entity_name]['attributes'][attr['name']]['weights']
                                entity_data[attr['name']] = random.choices(attr['choices'], weights=weights)[0]
                            else:
                                entity_data[attr['name']] = random.choice(attr['choices'])
                entities[entity_name][len(entities[entity_name])] = entity_data
    return entities

def create_entity(config, entity_type):
    entity_config = next(e for e in config['entities'] if e['name'] == entity_type)
    entity = {attr['name']: generate_attribute_value(attr) for attr in entity_config['attributes']}
    return entity