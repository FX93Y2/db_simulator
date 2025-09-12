"""
Data generation components for database entities.

This module provides various data generation strategies including:
- Attribute value generation with support for Faker, templates, and distributions
- Template processing with variable substitution and validation
- Type processing for database values  
- Table data population

Generator modules:
- template: Template string processing with variables and random selection
- faker_js: Faker.js integration for rich data generation
- formula: Post-simulation formula-based data generation
- foreign_key: Foreign key resolution and relationship handling
"""

from .populator import DataPopulator
from .attribute_generator import generate_attribute_value
from .type_processor import process_value_for_type
from .template import generate_from_template, validate_template, extract_template_variables

__all__ = [
    'DataPopulator',
    'generate_attribute_value',
    'generate_from_template', 
    'validate_template',
    'extract_template_variables',
    'process_value_for_type'
]