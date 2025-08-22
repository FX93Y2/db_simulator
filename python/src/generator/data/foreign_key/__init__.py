"""
Foreign key handling for database generation.

This module provides foreign key resolution and relationship
management during database population.
"""

from .resolver import ForeignKeyResolver

__all__ = ['ForeignKeyResolver']