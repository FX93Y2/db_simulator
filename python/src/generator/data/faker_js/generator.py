"""
Faker.js data generation for synthetic database records.

This module provides the main interface for generating fake data
using Faker.js via PyMiniRacer V8 engine integration.
"""

import logging
from typing import Any, Optional, List
from .engine import get_faker_engine

logger = logging.getLogger(__name__)


def generate_fake_data(method: str, size: Optional[int] = None) -> Any:
    """
    Generate fake data using Faker.js via PyMiniRacer.
    
    This function provides access to the full Faker.js library including:
    - person.fullName(), person.firstName(), person.lastName()
    - internet.email(), internet.userName(), internet.url()
    - company.name(), company.catchPhrase()
    - book.title(), book.author(), book.genre()
    - music.album(), music.artist(), music.songName()
    - location.city(), location.country()
    - And 500+ more methods
    
    Args:
        method: Faker.js method path (e.g., "book.title", "person.fullName")
        size: Optional size for generating arrays of data
        
    Returns:
        Generated fake data (single value or list if size specified)
        
    Examples:
        >>> generate_fake_data("book.title")
        'The Great Gatsby'
        
        >>> generate_fake_data("person.fullName", size=3)
        ['John Doe', 'Jane Smith', 'Bob Johnson']
        
        >>> generate_fake_data("internet.email")
        'john.doe@example.com'
        
        >>> generate_fake_data("company.name")
        'Acme Corporation'
    """
    try:
        engine = get_faker_engine()
        
        if size is not None and size > 0:
            # Generate multiple values
            results = []
            for _ in range(size):
                result = engine.generate(method)
                results.append(result)
            return results
        else:
            # Generate single value
            return engine.generate(method)
            
    except Exception as e:
        error_msg = f"Unsupported Faker Method: {method}"
        logger.error(f"Failed to generate fake data for {method}: {e}")
        return error_msg


def test_faker_js_integration() -> dict:
    """
    Test the Faker.js integration with common business/commercial methods.
    
    Returns:
        Dictionary with test results for various data types
    """
    test_methods = [
        # Basic person/internet data
        "person.fullName",
        "person.firstName",
        "person.lastName",
        "internet.email",
        "internet.userName",
        
        # Business/commercial data
        "company.name",
        "company.catchPhrase",
        "commerce.product",
        "commerce.price",
        
        # Media/entertainment
        "book.title",
        "book.author",
        "book.genre",
        "music.album",
        "music.artist",
        "music.songName",
        
        # Location data
        "location.city",
        "location.country",
        "location.streetAddress",
        
        # Finance data
        "finance.accountNumber",
        "finance.amount",
        "finance.currencyCode",
        
        # Food/business data
        "food.dish",
        "food.ingredient",
        
        # Transportation
        "airline.airline",
        "vehicle.vehicle",
        "vehicle.model",
    ]
    
    results = {}
    supported_count = 0
    
    for method in test_methods:
        try:
            result = generate_fake_data(method)
            results[method] = {
                "status": "supported" if not str(result).startswith("Unsupported") else "unsupported",
                "value": result
            }
            
            if results[method]["status"] == "supported":
                supported_count += 1
                
        except Exception as e:
            results[method] = {
                "status": "error",
                "error": str(e)
            }
    
    return {
        "total_tested": len(test_methods),
        "supported_count": supported_count,
        "support_percentage": (supported_count / len(test_methods)) * 100,
        "engine_status": get_faker_engine().test_connection(),
        "results": results
    }