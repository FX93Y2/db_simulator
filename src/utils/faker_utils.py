"""
Faker utility functions for generating synthetic data
"""

from faker import Faker
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)
faker = Faker()

def generate_fake_data(method: str, size: Optional[int] = None) -> Any:
    """
    Generate fake data using Faker
    
    Args:
        method: Faker method to use
        size: Size of data to generate (for arrays)
        
    Returns:
        Generated fake data
    """
    # Custom methods not directly available in Faker
    custom_methods = {
        'project_name': lambda: f"{faker.company()} {faker.bs().split()[0]} Project"
    }
    
    if method in custom_methods:
        if size is not None:
            return [custom_methods[method]() for _ in range(size)]
        return custom_methods[method]()
    
    if hasattr(faker, method):
        faker_method = getattr(faker, method)
        if size is not None:
            return [faker_method() for _ in range(size)]
        return faker_method()
    else:
        logger.warning(f"Unsupported Faker method: {method}, using default")
        return "default_value"