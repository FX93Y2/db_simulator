import random
from typing import Any, Dict
from .faker_utils import generate_fake_data

def generate_attribute_value(attr_config: Dict[str, Any], row_index: int) -> Any:
    """
    Description: Generate value for an attribute based on its generator configuration.

    Args:
        attr_config (Dict[str, Any]): Attribute configuration dictionary, expected 
                                       to contain 'name' and 'generator' keys. 
                                       'generator' is another dict with 'type' 
                                       and other keys based on the type.
        row_index (int): Index of the current row being generated (0-based).

    Returns:
        Any: The generated value.
    """
    generator_config = attr_config.get('generator')
    attr_name = attr_config.get('name', 'unknown_attr')

    if not generator_config:
        return f"Default_{attr_name}_{row_index}"

    generator_type = generator_config.get('type')

    # Faker generator
    if generator_type == 'faker':
        method = generator_config.get('method')
        if method:
            return generate_fake_data(method)
        else:
            return f"Faker_{attr_name}_{row_index}" # Fallback if method missing

    # Template generator
    elif generator_type == 'template':
        template = generator_config.get('template') or "{id}"
        # Use row_index + 1 for 1-based ID in template context
        context = {'id': row_index + 1} 
        try:
            return template.format(**context)
        except KeyError as e:
            logger.warning(f"KeyError in template for {attr_name}: {e}. Context: {context}")
            return f"Template_Error_{attr_name}_{row_index}"

    # Distribution generator
    elif generator_type == 'distribution':
        distribution = generator_config.get('distribution')
        if not distribution:
            return f"Dist_{attr_name}_{row_index}"

        dist_type = distribution.get('type')

        if dist_type == 'choice':
            values = distribution.get('values', [])
            weights = distribution.get('weights')

            if not values:
                return f"Choice_{attr_name}_{row_index}" # Fallback if values missing

            try:
                # Ensure weights length matches values length if provided
                if weights and len(weights) != len(values):
                     logger.warning(f"Weights length mismatch for {attr_name}. Using equal weights.")
                     weights = None
                return random.choices(values, weights=weights, k=1)[0]
            except Exception as e:
                logger.error(f"Error during 'choice' generation for {attr_name}: {e}")
                return f"Choice_Error_{attr_name}_{row_index}"
        return f"Dist_{dist_type or 'Unknown'}_{attr_name}_{row_index}"
    
    # Handle simulation_event type specifically if needed, otherwise it falls through
    elif generator_type == 'simulation_event':
         values = generator_config.get('values', [])
         if values:
              return None
         return f"SimEvent_{attr_name}_{row_index}"
    
    # Handle foreign_key generator type
    elif generator_type == 'foreign_key':
        # For foreign keys, we need to return None or a placeholder
        # The actual foreign key resolution should happen in the database generator
        # or in the simulator's _create_entity method
        return None  # Let the calling code handle the foreign key resolution

    # Default fallback for unknown generator types
    return f"Value_{generator_type or 'Unknown'}_{attr_name}_{row_index}"

# Add logger definition if warnings/errors are desired
import logging
logger = logging.getLogger(__name__)

# Placeholder for faker_utils
# try:
#     from .faker_utils import generate_fake_data
# except ImportError:
#     logger.warning("faker_utils not found, faker generator will not work correctly.")
#     def generate_fake_data(method):
#         return f"Fake_{method}"

