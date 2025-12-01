"""
Foreign key handling for data generation.

This module provides foreign key resolution and relationship
management during phase 1 data population.
"""

from .resolver import ForeignKeyResolver

__all__ = ['ForeignKeyResolver']