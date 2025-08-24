"""
Termination condition system for simulations.

This module provides formula-based termination conditions that allow
complex logical combinations of stopping criteria.
"""

from .formula import (
    TerminationFormulaParser,
    TerminationFormulaEvaluator,
    TerminationCondition,
    TimeCondition,
    EntitiesCondition,
    EventsCondition,
    AndCondition,
    OrCondition
)

__all__ = [
    'TerminationFormulaParser',
    'TerminationFormulaEvaluator',
    'TerminationCondition',
    'TimeCondition',
    'EntitiesCondition', 
    'EventsCondition',
    'AndCondition',
    'OrCondition'
]