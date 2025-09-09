"""
PyMiniRacer V8 engine wrapper for Faker.js integration.

This module provides a singleton V8 JavaScript engine that loads
and executes Faker.js methods for data generation.
"""

import os
import logging
from typing import Any, Optional
from py_mini_racer import MiniRacer

logger = logging.getLogger(__name__)


class FakerJSEngine:
    """
    V8 JavaScript engine wrapper for Faker.js execution.
    
    This class loads the Faker.js bundle into a V8 context and provides
    methods to generate fake data using JavaScript evaluation.
    """
    
    def __init__(self):
        """Initialize the V8 engine and load Faker.js bundle."""
        try:
            self.ctx = MiniRacer()
            
            # Load the Faker.js bundle
            bundle_path = os.path.join(
                os.path.dirname(__file__),
                'bundle.js'
            )
            
            if not os.path.exists(bundle_path):
                raise FileNotFoundError(
                    f"Faker.js bundle not found at {bundle_path}. "
                    "Please run 'node electron/build-faker-bundle.js' to generate it."
                )
            
            with open(bundle_path, 'r', encoding='utf-8') as f:
                bundle_content = f.read()
            
            # Load the bundle into V8 context
            self.ctx.eval(bundle_content)
            
            # Verify that faker and generateFake are available
            test_result = self.ctx.eval("typeof generateFake")
            if test_result != "function":
                raise RuntimeError("generateFake function not found in bundle")
            
            logger.info("Faker.js engine initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Faker.js engine: {e}")
            raise
    
    def generate(self, method: str) -> Any:
        """
        Generate fake data using a Faker.js method.
        
        Args:
            method: Dotted-path method string (e.g., "person.fullName", "book.title")
            
        Returns:
            Generated fake data or error message string
            
        Examples:
            >>> engine = FakerJSEngine()
            >>> engine.generate("person.fullName")
            'John Doe'
            >>> engine.generate("book.title")
            'The Great Gatsby'
            >>> engine.generate("internet.email")
            'john.doe@example.com'
        """
        try:
            # Use the generateFake helper function from the bundle
            result = self.ctx.eval(f"generateFake('{method}')")
            
            # Check if result is an error message
            if isinstance(result, str) and result.startswith("Unsupported Faker Method:"):
                logger.warning(f"Unsupported Faker method: {method}")
                return f"Unsupported Faker Method: {method}"
            
            return result
            
        except Exception as e:
            error_msg = f"Unsupported Faker Method: {method}"
            logger.error(f"Error generating fake data for {method}: {e}")
            return error_msg
    
    def test_connection(self) -> dict:
        """
        Test the Faker.js engine connection and available methods.
        
        Returns:
            Dictionary with test results
        """
        try:
            # Test basic faker methods
            tests = {
                "person.fullName": self.generate("person.fullName"),
                "internet.email": self.generate("internet.email"),
                "book.title": self.generate("book.title"),
                "company.name": self.generate("company.name"),
                "music.genre": self.generate("music.genre"),
            }
            
            # Check if all tests produced valid results
            all_valid = all(
                not isinstance(v, str) or not v.startswith("Unsupported")
                for v in tests.values()
            )
            
            return {
                "status": "connected" if all_valid else "partial",
                "tests": tests,
                "engine": "PyMiniRacer V8"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "engine": "PyMiniRacer V8"
            }


# Singleton instance
_faker_engine: Optional[FakerJSEngine] = None


def get_faker_engine() -> FakerJSEngine:
    """
    Get or create the singleton Faker.js engine instance.
    
    Returns:
        The singleton FakerJSEngine instance
    """
    global _faker_engine
    if _faker_engine is None:
        _faker_engine = FakerJSEngine()
    return _faker_engine