"""
Distribution system for DB Simulator.

This module provides comprehensive distribution support for both database generation
and discrete event simulation, including:
- Formula-based distribution specification (e.g., "UNIF(3, 10)", "NORM(5, 1)")
- All standard continuous and discrete distributions

Main exports:
- generate_from_distribution: Generate random values from distributions
- parse_distribution_formula: Parse formula strings to configuration dicts
- DistributionRegistry: Registry of all supported distributions

Example usage:
    # Formula-based syntax
    values = generate_from_distribution("UNIF(3, 10)", size=100)
    values = generate_from_distribution("DISC(0.7, 'A', 0.3, 'B')", size=10)
"""

from .core import generate_from_distribution, round_if_needed
from .formula_parser import parse_distribution_formula
from .registry import DistributionRegistry

__all__ = [
    'generate_from_distribution',
    'parse_distribution_formula', 
    'DistributionRegistry',
    'round_if_needed'
]