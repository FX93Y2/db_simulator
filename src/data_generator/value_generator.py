from faker import Faker
from typing import Any, Dict, Optional
import random
import logging
import string
import numpy as np
from datetime import datetime, timedelta
from ..utils.distributions import get_distribution
logger = logging.getLogger(__name__)
fake = Faker()

__all__ = ['ValueGenerator']

class ValueGenerator:
    """Handle generation of attribute values based on configuration"""
    
    def __init__(self):
        self.fake = Faker()

    def generate_attribute_value(
        self,
        attr: Dict[str, Any],
        entity_config: Dict[str, Any],
        global_config: Dict[str, Any],
        entity: Optional[Dict[str, Any]] = None
    ) -> Any:
        """Generate a value for an attribute based on its configuration"""
        try:
            sim_start = datetime.strptime(
                global_config['simulation_parameters']['start_date'],
                "%Y-%m-%d %H:%M:%S"
            )
            sim_end = datetime.strptime(
                global_config['simulation_parameters']['end_date'],
                "%Y-%m-%d %H:%M:%S"
            )
            # Handle special cases first
            if attr.get('primary_key', False) or attr['name'] == 'id':
                return self._generate_id_value(attr, entity_config, global_config)
            
            # Special handling for date fields
            if attr['name'] == 'CreatedAt':
                if 'generator' in attr:
                    if attr['generator']['type'] == 'distribution':
                        # If it's a time-based distribution, ensure it's within simulation bounds
                        value = self._generate_from_distribution(
                            attr['generator'],
                            sim_start=sim_start,
                            sim_end=sim_end
                        )
                    elif attr['generator']['type'] == 'same_as':
                        if not entity:
                            raise ValueError("Entity required for same_as generator")
                        value = entity[attr['generator']['field']]
                else:
                    # Default to uniform distribution within simulation bounds
                    value = sim_start + timedelta(
                        seconds=random.uniform(
                            0,
                            (sim_end - sim_start).total_seconds()
                        )
                    )
                return value.replace(hour=0, minute=0, second=0, microsecond=0)
                
            if 'generator' in attr:
                generator_type = attr['generator'].get('type')
                
                if generator_type == 'same_as':
                    if not entity:
                        raise ValueError("Entity required for same_as generator")
                    return entity[attr['generator']['field']]
                    
                if generator_type == 'faker':
                    return self._generate_faker_value(attr['generator'])
                    
                if generator_type == 'choice':
                    return self._generate_choice_value(attr['generator'], entity_config, global_config)
                
                if generator_type == 'template':
                    return self._generate_from_template(attr['generator'], entity.get('id') if entity else None)
                    
                if generator_type == 'distribution':
                    return self._generate_from_distribution(attr['generator'])
                    
                raise ValueError(f"Unknown generator type: {generator_type}")
            
            # Default value generation based on type
            return self._generate_default_value(attr['type'])
            
        except Exception as e:
            logger.error(f"Failed to generate value for {attr.get('name', 'unknown')}: {str(e)}")
            raise
        
    def _generate_id_value(
        self,
        attr: Dict[str, Any],
        entity_config: Dict[str, Any],
        global_config: Dict[str, Any]
    ) -> int:
        """Generate an ID value based on configuration"""
        # If it's a distribution-based ID generation
        if 'generator' in attr and attr['generator'].get('distribution'):
            config = attr['generator'].copy()
            min_val = max(1, int(config.get('min', 1)))
            max_val = int(config.get('max', 1000))
            
            # Generate a valid integer ID
            return random.randint(min_val, max_val)
            
        # Handle foreign key references
        if 'foreign_key' in attr:
            referenced_entity = attr['foreign_key'].split('.')[0]
            if referenced_entity in global_config.get('initial_population', {}):
                count = global_config['initial_population'][referenced_entity]['count']
                return random.randint(1, count)
                
        # Default ID generation
        if attr.get('type') in ['int', 'integer']:
            return random.randint(1, 1000)
            
        raise ValueError(f"Unable to generate ID for attribute: {attr}")

    def _generate_dependent_value(
        self,
        attr: Dict[str, Any],
        entity: Optional[Dict[str, Any]]
    ) -> Any:
        """Generate a value that depends on another attribute"""
        if not entity:
            raise ValueError("Entity is required for dependent value generation")

        dependency = attr['generator']['dependency']
        conditions = attr['generator']['conditions']
        
        dependent_value = entity.get(dependency)
        if dependent_value is None:
            raise ValueError(f"Dependent value '{dependency}' not found in entity")
        
        if dependent_value not in conditions:
            raise ValueError(f"No condition defined for {dependency} value: {dependent_value}")
        
        condition = conditions[dependent_value]
        distribution = get_distribution(condition)
        return distribution()

    def _generate_from_generator(
        self,
        generator_config: Dict[str, Any],
        entity_config: Dict[str, Any],
        global_config: Dict[str, Any]
    ) -> Any:
        """Generate a value using a specified generator"""
        generator_type = generator_config['type']
        
        if generator_type == 'faker':
            return self._generate_faker_value(generator_config)
        elif generator_type == 'choice':
            return random.choice(generator_config['choices'])
        elif generator_type in ['uniform', 'normal', 'exponential', 'poisson']:
            distribution = get_distribution(generator_config)
            return distribution()
        else:
            raise ValueError(f"Unknown generator type: {generator_type}")
            
    def _generate_from_distribution(
        self,
        generator_config: Dict[str, Any],
        sim_start: Optional[datetime] = None,
        sim_end: Optional[datetime] = None
    ) -> Any:
        """Generate a value from a distribution configuration"""
        try:
            if 'distribution' in generator_config and isinstance(generator_config['distribution'], str):
                dist_str = generator_config['distribution']
                
                if dist_str.startswith('UNIF(') and sim_start and sim_end:
                    date_str = dist_str[5:-1] 
                    if ',' in date_str:
                        start_str, end_str = date_str.split(',')
                        try:
                            start = datetime.strptime(start_str.strip(), "%Y-%m-%d %H:%M:%S")
                            end = datetime.strptime(end_str.strip(), "%Y-%m-%d %H:%M:%S")
                            start = max(start, sim_start)
                            end = min(end, sim_end)
                        except ValueError:
                            start, end = sim_start, sim_end
                    else:
                        start, end = sim_start, sim_end
                    
                    # Generate random datetime between bounds
                    time_delta = (end - start).total_seconds()
                    random_seconds = random.uniform(0, time_delta)
                    return start + timedelta(seconds=random_seconds)

            # Discrete
            if 'choices' in generator_config:
                choices = generator_config['choices']
                distribution_str = generator_config['distribution']
                
                if distribution_str.startswith('DISC('):
                    probs_str = distribution_str[5:-1]
                    probabilities = [float(p.strip()) for p in probs_str.split(',')]
                    
                    if len(probabilities) != len(choices):
                        raise ValueError(
                            f"Number of probabilities ({len(probabilities)}) "
                            f"must match number of choices ({len(choices)})"
                        )
                        
                    return random.choices(choices, weights=probabilities, k=1)[0]

            # Handle other distributions
            distribution = get_distribution(generator_config['distribution'])
            return distribution()
                
        except Exception as e:
            logger.error(
                f"Error generating distribution value: {str(e)}. "
                f"Config: {generator_config}"
            )
            raise

    def _generate_faker_value(self, generator_config: Dict[str, Any]) -> Any:
        """Generate a value using Faker"""
        method = generator_config['method']
        
        if method == 'sentence':
            nb_words = generator_config.get('nb_words', 6)
            return self.fake.sentence(nb_words=nb_words)
        elif hasattr(self.fake, method):
            return getattr(self.fake, method)()
        else:
            raise ValueError(f"Unknown Faker method: {method}")
        
    def _generate_from_template(self, generator_config: Dict[str, Any], entity_id: Optional[int]) -> str:
        """Generate a value from a template string"""
        try:
            if entity_id is None:
                raise ValueError("Entity ID required for template generator")
                
            template = generator_config.get('template')
            if not template:
                raise ValueError("Template string required for template generator")
                
            return template.format(id=entity_id)
            
        except KeyError as e:
            raise ValueError(f"Missing required field in template config: {e}")
        except Exception as e:
            logger.error(f"Error generating template value: {str(e)}. Config: {generator_config}")
            raise

    def _generate_choice_value(
        self,
        generator_config: Dict[str, Any],
        entity_config: Dict[str, Any],
        global_config: Dict[str, Any]
    ) -> Any:
        """Generate a value from a list of choices"""
        if 'choices' not in generator_config:
            raise ValueError("Choice generator must specify 'choices' list")
            
        choices = generator_config['choices']
        
        # Check for weights in the generator config
        if 'weights' in generator_config:
            weights = generator_config['weights']
            if len(weights) != len(choices):
                raise ValueError("Number of weights must match number of choices")
            return random.choices(choices, weights=weights, k=1)[0]
        
        # Check for distribution in entity's initial population config
        entity_name = entity_config['name']
        if entity_name in global_config.get('initial_population', {}):
            entity_pop = global_config['initial_population'][entity_name]
            if isinstance(entity_pop, dict) and 'attributes' in entity_pop:
                for attr_config in entity_pop['attributes']:
                    # Make sure attr_config is a dictionary before using get()
                    if isinstance(attr_config, dict):
                        attr_name = attr_config.get('name')
                        generator_name = generator_config.get('name')
                        if attr_name and attr_name == generator_name:
                            if 'distribution' in attr_config and 'weights' in attr_config['distribution']:
                                weights = attr_config['distribution']['weights']
                                if len(weights) == len(choices):
                                    return random.choices(choices, weights=weights, k=1)[0]
        
        # Default to uniform distribution if no weights specified
        return random.choice(choices)

    def _generate_default_value(self, attr_type: str) -> Any:
        """Generate a default value based on attribute type"""
        if attr_type == 'string':
            return ''.join(random.choices(
                string.ascii_letters + string.digits,
                k=10
            ))
        elif attr_type in ['int', 'integer']:
            return random.randint(0, 1000)
        elif attr_type == 'float':
            return random.uniform(0, 1000)
        elif attr_type == 'boolean':
            return random.choice([True, False])
        elif attr_type == 'datetime':
            # Generate date without time component
            base_date = datetime.now() - timedelta(days=random.randint(0, 365))
            return base_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            raise ValueError(f"Unknown attribute type: {attr_type}")