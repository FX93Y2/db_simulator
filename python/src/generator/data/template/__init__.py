"""
Template-based data generation module.

This module provides template string processing with variable substitution,
support for random selection from lists, and template validation utilities.
"""

from .generator import generate_from_template, validate_template, extract_template_variables

__all__ = ['generate_from_template', 'validate_template', 'extract_template_variables']