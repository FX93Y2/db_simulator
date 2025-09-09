"""
Faker.js-based data generation using PyMiniRacer V8 engine.

This module provides access to the full Faker.js library through
a JavaScript V8 engine, enabling access to 500+ data generation methods
for commercial and business database simulation.
"""

from .generator import generate_fake_data, test_faker_js_integration

__all__ = ['generate_fake_data', 'test_faker_js_integration']