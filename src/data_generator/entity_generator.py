from .value_generator import generate_attribute_value
import logging
from datetime import datetime, timedelta
import random
from ..utils.distributions import get_distribution

logger = logging.getLogger(__name__)

def generate_initial_entities(config):
    entities = {}
    start_time = datetime.strptime(config['simulation_parameters']['start_date'], "%Y-%m-%d %H:%M:%S")
    end_time = datetime.strptime(config['simulation_parameters']['end_date'], "%Y-%m-%d %H:%M:%S")
    
    # First, generate independent entities
    independent_entities = [entity['name'] for entity in config['entities'] if not any('foreign_key' in attr for attr in entity['attributes'])]
    for entity_name in independent_entities:
        entity_config = next(e for e in config['entities'] if e['name'] == entity_name)
        entities[entity_name] = create_entities(entity_config, config, start_time, end_time)
    
    # Then generate dependent entities
    dependent_entities = [entity['name'] for entity in config['entities'] if entity['name'] not in independent_entities]
    for entity_name in dependent_entities:
        entity_config = next(e for e in config['entities'] if e['name'] == entity_name)
        entities[entity_name] = create_entities(entity_config, config, start_time, end_time, entities)
    
    return entities

def create_entities(entity_config, global_config, start_time, end_time, existing_entities=None):
    entities = {}
    count = global_config['initial_population'][entity_config['name']]['count']
    distribution_config = global_config['initial_population'][entity_config['name']].get(
        'creation_time_distribution',
        {'type': 'uniform'}
    )
    
    time_distribution = get_time_distribution(distribution_config, start_time, end_time)
    
    creation_times = sorted([time_distribution() for _ in range(count)])
    
    for i, creation_time in enumerate(creation_times, start=1):
        entity = create_entity(entity_config, global_config, creation_time, existing_entities)
        entities[i] = entity
    
    return entities

def create_entity(entity_config, global_config, creation_time, existing_entities=None):
    entity = {}
    dependent_attributes = []
    # Only add CreatedAt if it's explicitly defined in the entity config
    if any(attr['name'] == 'CreatedAt' for attr in entity_config['attributes']):
        entity['CreatedAt'] = creation_time
    
    for attr in entity_config['attributes']:
        if attr['name'] == 'id':
            continue  # Skip
        if attr['name'] == 'CreatedAt':
            entity[attr['name']] = creation_time
        elif 'foreign_key' in attr:
            if existing_entities:
                ref_entity, _ = attr['foreign_key'].split('.')
                valid_ids = [id for id, e in existing_entities[ref_entity].items() 
                             if 'CreatedAt' not in e or e['CreatedAt'] <= creation_time]
                if not valid_ids:
                    logger.warning(f"No valid IDs found for foreign key {attr['name']} referencing {ref_entity} at time {creation_time}")
                    entity[attr['name']] = None
                else:
                    entity[attr['name']] = random.choice(valid_ids)
            else:
                entity[attr['name']] = None  # Will be assigned later
        elif 'generator' in attr and attr['generator']['type'] == 'dependent':
            dependent_attributes.append(attr)
        else:
            entity[attr['name']] = generate_attribute_value(attr, entity_config, global_config, entity)

    # Second pass: generate dependent attributes
    for attr in dependent_attributes:
        entity[attr['name']] = generate_attribute_value(attr, entity_config, global_config, entity)

    return entity

def get_time_distribution(distribution_config, start_time, end_time):
    """Add more distributions type here"""
    distribution_type = distribution_config['type']
    if distribution_type == 'uniform':
        return lambda: start_time + timedelta(seconds=random.uniform(0, (end_time - start_time).total_seconds()))
    elif distribution_type == 'poisson':
        lambda_param = (end_time - start_time).total_seconds() / 86400
        return lambda: start_time + timedelta(days=random.expovariate(1/lambda_param))
    else:
        raise ValueError(f"Unsupported time distribution type: {distribution_type}")