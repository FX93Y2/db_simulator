"""
Formula-based termination conditions for simulations.

This module provides a flexible formula language for specifying
termination conditions using functions like TIME(), ENTITIES(), and EVENTS()
with logical operators AND, OR, and parentheses.
"""

import re
import logging
from typing import Tuple, Optional, List, Union
from dataclasses import dataclass
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


@dataclass
class TerminationCondition(ABC):
    """Abstract base class for termination conditions."""
    
    @abstractmethod
    def evaluate(self, simulator) -> Tuple[bool, str]:
        """
        Evaluate if this condition is met.
        
        Args:
            simulator: Reference to the simulation instance
            
        Returns:
            Tuple of (condition_met, description)
        """
        pass


@dataclass
class TimeCondition(TerminationCondition):
    """Termination condition based on simulation time."""
    value: float  # Time in base units
    
    def evaluate(self, simulator) -> Tuple[bool, str]:
        from ...utils.time_units import TimeUnitConverter
        current_time = TimeUnitConverter.from_minutes(simulator.env.now, simulator.config.base_time_unit)
        if current_time >= self.value:
            return True, f"max_time_reached ({current_time:.2f} {simulator.config.base_time_unit})"
        return False, ""


@dataclass
class EntitiesCondition(TerminationCondition):
    """Termination condition based on entity count."""
    table_name: Optional[str]  # None or "*" means all tables
    value: int
    
    def evaluate(self, simulator) -> Tuple[bool, str]:
        if self.table_name and self.table_name != '*':
            # Count entities in specific table
            entity_count = simulator._count_entities_in_table(self.table_name)
            condition_desc = f"{self.table_name} entities"
        else:
            # Count all entities
            entity_count = simulator.entities_processed
            condition_desc = "total entities"
        
        if entity_count >= self.value:
            return True, f"max_entities_reached ({entity_count} {condition_desc})"
        return False, ""


@dataclass
class EventsCondition(TerminationCondition):
    """Termination condition based on event count."""
    table_name: Optional[str]  # None means all events
    value: int
    
    def evaluate(self, simulator) -> Tuple[bool, str]:
        if self.table_name:
            # For now, we only support total events
            # Future enhancement: count events in specific table
            event_count = simulator.processed_events
            condition_desc = f"{self.table_name} events"
        else:
            event_count = simulator.processed_events
            condition_desc = "total events"
        
        if event_count >= self.value:
            return True, f"max_events_reached ({event_count} {condition_desc})"
        return False, ""


@dataclass
class AndCondition(TerminationCondition):
    """Logical AND of two conditions."""
    left: TerminationCondition
    right: TerminationCondition
    
    def evaluate(self, simulator) -> Tuple[bool, str]:
        left_met, left_desc = self.left.evaluate(simulator)
        right_met, right_desc = self.right.evaluate(simulator)
        
        if left_met and right_met:
            return True, f"{left_desc} AND {right_desc}"
        return False, ""


@dataclass
class OrCondition(TerminationCondition):
    """Logical OR of two conditions."""
    left: TerminationCondition
    right: TerminationCondition
    
    def evaluate(self, simulator) -> Tuple[bool, str]:
        left_met, left_desc = self.left.evaluate(simulator)
        if left_met:
            return True, left_desc
        
        right_met, right_desc = self.right.evaluate(simulator)
        if right_met:
            return True, right_desc
        
        return False, ""


class TerminationFormulaParser:
    """
    Parser for termination condition formulas.
    
    Supports grammar:
        expression := term (OR term)*
        term := factor (AND factor)*
        factor := condition | '(' expression ')'
        condition := TIME '(' number ')'
                   | ENTITIES '(' (identifier | '*') ',' number ')'
                   | EVENTS '(' [identifier ','] number ')'
    """
    
    def __init__(self):
        self.tokens = []
        self.position = 0
        
    def parse(self, formula: str) -> TerminationCondition:
        """
        Parse formula string into condition tree.
        
        Args:
            formula: Formula string like "TIME(720) OR ENTITIES(Order, 1000)"
            
        Returns:
            Root condition node
            
        Raises:
            ValueError: If formula syntax is invalid
        """
        # Tokenize the formula
        self.tokens = self._tokenize(formula)
        self.position = 0
        
        if not self.tokens:
            raise ValueError("Empty termination formula")
        
        try:
            condition = self._parse_expression()
            
            # Ensure we consumed all tokens
            if self.position < len(self.tokens):
                raise ValueError(f"Unexpected token at position {self.position}: {self.tokens[self.position]}")
            
            return condition
            
        except IndexError:
            raise ValueError("Incomplete termination formula")
    
    def _tokenize(self, formula: str) -> List[str]:
        """Tokenize formula into components."""
        # Remove excess whitespace but preserve original case
        formula = re.sub(r'\s+', ' ', formula.strip())
        
        # Token patterns - order matters! More specific patterns first
        # Note: Using re.IGNORECASE flag instead of inline (?i) to avoid regex compilation issues
        token_patterns = [
            r'\(',                      # Left parenthesis
            r'\)',                      # Right parenthesis
            r',',                       # Comma
            r'\bAND\b',                 # AND operator (word boundary to avoid matching parts of identifiers)
            r'\bOR\b',                  # OR operator (word boundary to avoid matching parts of identifiers)
            r'\bTIME\b',                # TIME function (word boundary)
            r'\bENTITIES\b',            # ENTITIES function (word boundary)
            r'\bEVENTS\b',              # EVENTS function (word boundary)
            r'\*',                      # Asterisk (for all entities)
            r'[A-Za-z_][A-Za-z0-9_]*',  # Identifiers (table names, preserve case)
            r'\d+\.?\d*',               # Numbers (int or float)
        ]

        pattern = '|'.join(f'({p})' for p in token_patterns)
        compiled_pattern = re.compile(pattern, re.IGNORECASE)
        tokens = []

        for match in compiled_pattern.finditer(formula):
            token = match.group().strip()
            if token:
                # Normalize keywords to uppercase while preserving case for identifiers
                token_upper = token.upper()
                if token_upper in ['AND', 'OR', 'TIME', 'ENTITIES', 'EVENTS']:
                    tokens.append(token_upper)
                else:
                    # Keep original case for table names, numbers, operators
                    tokens.append(token)
        
        return tokens
    
    def _current_token(self) -> str:
        """Get current token without advancing."""
        if self.position >= len(self.tokens):
            return ""
        return self.tokens[self.position]
    
    def _consume_token(self, expected: Optional[str] = None) -> str:
        """Consume and return current token, optionally checking expected value."""
        if self.position >= len(self.tokens):
            if expected:
                raise ValueError(f"Expected '{expected}' but reached end of formula")
            return ""
        
        token = self.tokens[self.position]
        self.position += 1
        
        if expected and token != expected:
            raise ValueError(f"Expected '{expected}' but got '{token}'")
        
        return token
    
    def _parse_expression(self) -> TerminationCondition:
        """Parse: term (OR term)*"""
        left = self._parse_term()
        
        while self._current_token() == 'OR':
            self._consume_token('OR')
            right = self._parse_term()
            left = OrCondition(left, right)
        
        return left
    
    def _parse_term(self) -> TerminationCondition:
        """Parse: factor (AND factor)*"""
        left = self._parse_factor()
        
        while self._current_token() == 'AND':
            self._consume_token('AND')
            right = self._parse_factor()
            left = AndCondition(left, right)
        
        return left
    
    def _parse_factor(self) -> TerminationCondition:
        """Parse: condition | '(' expression ')'"""
        if self._current_token() == '(':
            self._consume_token('(')
            condition = self._parse_expression()
            self._consume_token(')')
            return condition
        else:
            return self._parse_condition()
    
    def _parse_condition(self) -> TerminationCondition:
        """Parse individual condition functions."""
        token = self._current_token()
        
        if token == 'TIME':
            return self._parse_time_condition()
        elif token == 'ENTITIES':
            return self._parse_entities_condition()
        elif token == 'EVENTS':
            return self._parse_events_condition()
        else:
            raise ValueError(f"Unknown condition function: {token}")
    
    def _parse_time_condition(self) -> TimeCondition:
        """Parse: TIME '(' number ')'"""
        self._consume_token('TIME')
        self._consume_token('(')
        
        value_str = self._consume_token()
        try:
            value = float(value_str)
        except ValueError:
            raise ValueError(f"Invalid time value: {value_str}")
        
        self._consume_token(')')
        return TimeCondition(value)
    
    def _parse_entities_condition(self) -> EntitiesCondition:
        """Parse: ENTITIES '(' (identifier | '*') ',' number ')'"""
        self._consume_token('ENTITIES')
        self._consume_token('(')
        
        table_name = self._consume_token()
        if table_name == '*':
            table_name = None  # None means all tables
        
        self._consume_token(',')
        
        value_str = self._consume_token()
        try:
            value = int(float(value_str))  # Allow float input but convert to int
        except ValueError:
            raise ValueError(f"Invalid entity count: {value_str}")
        
        self._consume_token(')')
        return EntitiesCondition(table_name, value)
    
    def _parse_events_condition(self) -> EventsCondition:
        """Parse: EVENTS '(' [identifier ','] number ')'"""
        self._consume_token('EVENTS')
        self._consume_token('(')
        
        # Check if this is EVENTS(number) or EVENTS(table, number)
        first_token = self._consume_token()
        
        if self._current_token() == ',':
            # EVENTS(table, number) format
            table_name = first_token
            self._consume_token(',')
            value_str = self._consume_token()
        else:
            # EVENTS(number) format
            table_name = None
            value_str = first_token
        
        try:
            value = int(float(value_str))
        except ValueError:
            raise ValueError(f"Invalid event count: {value_str}")
        
        self._consume_token(')')
        return EventsCondition(table_name, value)


class TerminationFormulaEvaluator:
    """
    Evaluator for termination condition trees.
    
    This is a simple wrapper around the condition tree evaluation,
    provided for consistency with the parser interface.
    """
    
    def evaluate(self, condition: TerminationCondition, simulator) -> Tuple[bool, str]:
        """
        Evaluate termination condition against simulation state.
        
        Args:
            condition: Parsed condition tree
            simulator: Simulation instance
            
        Returns:
            Tuple of (should_terminate, reason_description)
        """
        try:
            return condition.evaluate(simulator)
        except Exception as e:
            logger.error(f"Error evaluating termination condition: {e}")
            return False, ""