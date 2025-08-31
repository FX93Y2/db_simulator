"""
SQL helper utilities for entity property access and expression evaluation.

This module provides utilities for parsing and evaluating expressions that contain
Entity.property syntax, enabling dynamic access to both in-memory attributes and
database column values during simulation execution.
"""

import logging
import re
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy import text

if TYPE_CHECKING:
    from ..simulation.managers.entity_attribute_manager import EntityAttributeManager

logger = logging.getLogger(__name__)


class SQLExpressionEvaluator:
    """
    Evaluates expressions containing Entity.property syntax.
    
    Supports:
    - Entity.id - Primary key access
    - Entity.<column_name> - Database column access
    - Entity.<attribute_name> - In-memory attribute access
    - Boolean expressions for decide conditions
    - SQL variable substitution for assign operations
    """
    
    def __init__(self, engine, entity_attribute_manager: 'EntityAttributeManager'):
        """
        Initialize the expression evaluator.
        
        Args:
            engine: SQLAlchemy engine for database operations
            entity_attribute_manager: Manager for in-memory entity attributes
        """
        self.engine = engine
        self.entity_attribute_manager = entity_attribute_manager
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # Regex pattern to match Entity.property references
        self.entity_property_pattern = re.compile(r'\bEntity\.(\w+)\b')
    
    def evaluate_boolean_expression(self, entity_id: int, entity_table: str, expression: str) -> bool:
        """
        Evaluate a boolean expression containing Entity properties.
        
        Args:
            entity_id: ID of the entity
            entity_table: Name of the entity table
            expression: Boolean expression to evaluate (e.g., "Entity.status == 'pending'")
            
        Returns:
            Boolean result of the expression
        """
        try:
            # Replace Entity.property references with actual values
            resolved_expression = self._resolve_entity_properties(entity_id, entity_table, expression)
            
            if resolved_expression is None:
                self.logger.error(f"Failed to resolve entity properties in expression: {expression}")
                return False
            
            self.logger.debug(f"Entity {entity_id}: Resolved '{expression}' -> '{resolved_expression}'")
            
            # For Step 3, we'll support simple boolean expressions
            # In future steps, this could be extended to use eval() safely or a proper expression parser
            return self._evaluate_simple_boolean_expression(resolved_expression)
            
        except Exception as e:
            self.logger.error(f"Error evaluating boolean expression for entity {entity_id}: {e}")
            return False
    
    def substitute_sql_variables(self, entity_id: int, entity_table: str, sql_statement: str) -> Optional[str]:
        """
        Substitute Entity.property references in SQL statements with actual values.
        
        Args:
            entity_id: ID of the entity
            entity_table: Name of the entity table
            sql_statement: SQL statement containing Entity.property references
            
        Returns:
            SQL statement with variables substituted, or None if substitution failed
        """
        try:
            # Replace Entity.property references with actual values
            resolved_sql = self._resolve_entity_properties(entity_id, entity_table, sql_statement, for_sql=True)
            
            if resolved_sql is None:
                self.logger.error(f"Failed to resolve entity properties in SQL: {sql_statement}")
                return None
            
            self.logger.debug(f"Entity {entity_id}: SQL resolved '{sql_statement}' -> '{resolved_sql}'")
            return resolved_sql
            
        except Exception as e:
            self.logger.error(f"Error substituting SQL variables for entity {entity_id}: {e}")
            return None
    
    def _resolve_entity_properties(self, entity_id: int, entity_table: str, expression: str, for_sql: bool = False) -> Optional[str]:
        """
        Replace Entity.property references in an expression with actual values.
        
        Args:
            entity_id: ID of the entity
            entity_table: Name of the entity table
            expression: Expression containing Entity.property references
            for_sql: Whether this is for SQL substitution (affects value formatting)
            
        Returns:
            Expression with Entity properties resolved to actual values
        """
        # Find all Entity.property references
        entity_properties = self.entity_property_pattern.findall(expression)
        
        if not entity_properties:
            # No Entity properties to resolve
            return expression
        
        resolved_expression = expression
        entity_values = {}
        
        # Get entity values (both from database and in-memory attributes)
        try:
            entity_values = self._get_entity_values(entity_id, entity_table, entity_properties)
        except Exception as e:
            self.logger.error(f"Failed to get entity values for entity {entity_id}: {e}")
            return None
        
        # Replace each Entity.property with its resolved value
        for property_name in entity_properties:
            if property_name not in entity_values:
                self.logger.error(f"Entity {entity_id}: Property '{property_name}' not found")
                return None
            
            value = entity_values[property_name]
            pattern = f"Entity.{property_name}"
            
            if for_sql:
                # For SQL, format value appropriately (strings need quotes, numbers don't)
                if isinstance(value, str):
                    replacement = f"'{value}'"
                else:
                    replacement = str(value)
            else:
                # For boolean expressions, format as Python literal
                if isinstance(value, str):
                    replacement = f"'{value}'"
                else:
                    replacement = str(value)
            
            resolved_expression = resolved_expression.replace(pattern, replacement)
        
        return resolved_expression
    
    def _get_entity_values(self, entity_id: int, entity_table: str, property_names: list) -> Dict[str, Any]:
        """
        Retrieve entity property values from both database and in-memory attributes.
        
        Args:
            entity_id: ID of the entity
            entity_table: Name of the entity table
            property_names: List of property names to retrieve
            
        Returns:
            Dictionary of property_name -> value pairs
        """
        values = {}
        
        # First, check in-memory attributes (from entity_attribute_manager)
        for property_name in property_names:
            if self.entity_attribute_manager.has_attribute(entity_id, property_name):
                values[property_name] = self.entity_attribute_manager.get_attribute(entity_id, property_name)
                self.logger.debug(f"Entity {entity_id}: Found in-memory attribute {property_name} = {values[property_name]}")
        
        # Then, get any missing properties from the database
        missing_properties = [prop for prop in property_names if prop not in values]
        
        if missing_properties:
            db_values = self._get_entity_database_values(entity_id, entity_table, missing_properties)
            values.update(db_values)
        
        return values
    
    def _get_entity_database_values(self, entity_id: int, entity_table: str, property_names: list) -> Dict[str, Any]:
        """
        Retrieve entity property values from the database.
        
        Args:
            entity_id: ID of the entity
            entity_table: Name of the entity table  
            property_names: List of property names to retrieve
            
        Returns:
            Dictionary of property_name -> value pairs from database
        """
        values = {}
        
        if not property_names:
            return values
        
        try:
            with self.engine.connect() as connection:
                # Handle special case for 'id' property
                columns_to_query = []
                for prop_name in property_names:
                    if prop_name == 'id':
                        columns_to_query.append('id')
                    else:
                        columns_to_query.append(f'"{prop_name}"')
                
                columns_clause = ', '.join(columns_to_query)
                query = text(f'SELECT {columns_clause} FROM "{entity_table}" WHERE "id" = :entity_id')
                
                result = connection.execute(query, {"entity_id": entity_id})
                row = result.fetchone()
                
                if row:
                    for i, prop_name in enumerate(property_names):
                        values[prop_name] = row[i]
                        self.logger.debug(f"Entity {entity_id}: Found database column {prop_name} = {values[prop_name]}")
                else:
                    self.logger.warning(f"Entity {entity_id} not found in table {entity_table}")
                    
        except Exception as e:
            self.logger.error(f"Error querying database values for entity {entity_id}: {e}")
            # Don't raise exception, return partial results
        
        return values
    
    def _evaluate_simple_boolean_expression(self, expression: str) -> bool:
        """
        Evaluate a simple boolean expression.
        
        For Step 3, we'll support basic comparisons. This can be extended later
        for more complex expressions.
        
        Args:
            expression: Resolved boolean expression (e.g., "'pending' == 'pending'")
            
        Returns:
            Boolean result
        """
        try:
            # For safety, we'll only support simple comparison operators
            # This avoids using eval() which could be dangerous
            
            if ' == ' in expression:
                left, right = expression.split(' == ', 1)
                return self._parse_value(left.strip()) == self._parse_value(right.strip())
            elif ' != ' in expression:
                left, right = expression.split(' != ', 1)
                return self._parse_value(left.strip()) != self._parse_value(right.strip())
            elif ' > ' in expression:
                left, right = expression.split(' > ', 1)
                return self._parse_numeric_value(left.strip()) > self._parse_numeric_value(right.strip())
            elif ' < ' in expression:
                left, right = expression.split(' < ', 1)
                return self._parse_numeric_value(left.strip()) < self._parse_numeric_value(right.strip())
            elif ' >= ' in expression:
                left, right = expression.split(' >= ', 1)
                return self._parse_numeric_value(left.strip()) >= self._parse_numeric_value(right.strip())
            elif ' <= ' in expression:
                left, right = expression.split(' <= ', 1)
                return self._parse_numeric_value(left.strip()) <= self._parse_numeric_value(right.strip())
            elif expression.lower() in ('true', 'false'):
                return expression.lower() == 'true'
            else:
                self.logger.error(f"Unsupported boolean expression format: {expression}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error evaluating simple boolean expression '{expression}': {e}")
            return False
    
    def _parse_value(self, value_str: str) -> Any:
        """Parse a string value to its appropriate Python type."""
        value_str = value_str.strip()
        
        # Handle quoted strings
        if (value_str.startswith("'") and value_str.endswith("'")) or \
           (value_str.startswith('"') and value_str.endswith('"')):
            return value_str[1:-1]  # Remove quotes
        
        # Handle numbers
        try:
            if '.' in value_str:
                return float(value_str)
            else:
                return int(value_str)
        except ValueError:
            pass
        
        # Handle booleans
        if value_str.lower() == 'true':
            return True
        elif value_str.lower() == 'false':
            return False
        
        # Return as string if nothing else matches
        return value_str
    
    def _parse_numeric_value(self, value_str: str) -> float:
        """Parse a string value as a numeric value for comparison."""
        value = self._parse_value(value_str)
        if isinstance(value, (int, float)):
            return float(value)
        elif isinstance(value, str):
            # Try to parse string as number (handles cases like "'15'" from SQL results)
            try:
                return float(value)
            except ValueError:
                raise ValueError(f"Cannot convert '{value_str}' to numeric value")
        else:
            raise ValueError(f"Cannot convert '{value_str}' to numeric value")