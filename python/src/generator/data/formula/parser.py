"""
Formula expression parser.

Parses formula expressions like:
- MIN(SELECT created_at FROM Ticket WHERE submitter_id = @id)
- MAX(Ticket[submitter_id == @id].created_at) - DAYS(30)
"""

import re
import logging
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ParsedExpression:
    """Represents a parsed formula expression."""
    expression_type: str  # 'sql', 'table_reference', 'arithmetic'
    raw_expression: str
    table_references: List[str]
    column_references: List[str]
    functions: List[str]
    variables: List[str]  # @id, @name, etc.
    sql_query: Optional[str] = None


class FormulaParser:
    """Parses formula expressions into structured representations."""
    
    def __init__(self):
        """Initialize the formula parser."""
        # Regex patterns for different expression types
        self.sql_pattern = re.compile(r'(SELECT|MIN|MAX|AVG|COUNT|SUM)\s*\(\s*SELECT', re.IGNORECASE)
        self.aggregate_pattern = re.compile(r'(MIN|MAX|AVG|COUNT|SUM)\s*\(\s*([^)]+)\s*\)', re.IGNORECASE)
        self.table_ref_pattern = re.compile(r'([A-Za-z_][A-Za-z0-9_]*)\[([^\]]+)\]\.([A-Za-z_][A-Za-z0-9_]*)', re.IGNORECASE)
        self.variable_pattern = re.compile(r'@([A-Za-z_][A-Za-z0-9_]*)')
        self.date_function_pattern = re.compile(r'(DAYS|HOURS|MINUTES)\s*\(\s*([^)]+)\s*\)', re.IGNORECASE)
        self.random_pattern = re.compile(r'RANDOM\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', re.IGNORECASE)
    
    def parse(self, expression: str) -> ParsedExpression:
        """
        Parse a formula expression into its components.
        
        Args:
            expression: The formula expression to parse
            
        Returns:
            ParsedExpression object with parsed components
        """
        logger.debug(f"Parsing formula expression: {expression}")
        
        # Clean the expression
        expression = expression.strip()
        
        # Extract components
        table_references = self._extract_table_references(expression)
        column_references = self._extract_column_references(expression)
        functions = self._extract_functions(expression)
        variables = self._extract_variables(expression)
        
        # Determine expression type and convert to SQL if needed
        if self.sql_pattern.search(expression):
            expression_type = 'sql'
            sql_query = expression
        elif self.table_ref_pattern.search(expression):
            expression_type = 'table_reference'
            sql_query = self._convert_table_reference_to_sql(expression)
        else:
            expression_type = 'arithmetic'
            sql_query = None
        
        return ParsedExpression(
            expression_type=expression_type,
            raw_expression=expression,
            table_references=table_references,
            column_references=column_references,
            functions=functions,
            variables=variables,
            sql_query=sql_query
        )
    
    def _extract_table_references(self, expression: str) -> List[str]:
        """Extract table names referenced in the expression."""
        tables = set()
        
        # Extract from table[condition].column syntax
        matches = self.table_ref_pattern.findall(expression)
        for table, condition, column in matches:
            tables.add(table)
        
        # Extract from SQL-style references
        sql_table_pattern = re.compile(r'FROM\s+([A-Za-z_][A-Za-z0-9_]*)', re.IGNORECASE)
        sql_matches = sql_table_pattern.findall(expression)
        tables.update(sql_matches)
        
        return list(tables)
    
    def _extract_column_references(self, expression: str) -> List[str]:
        """Extract column names referenced in the expression."""
        columns = set()
        
        # Extract from table[condition].column syntax
        matches = self.table_ref_pattern.findall(expression)
        for table, condition, column in matches:
            columns.add(column)
        
        # Extract from variables like @column_name
        var_matches = self.variable_pattern.findall(expression)
        columns.update(var_matches)
        
        return list(columns)
    
    def _extract_functions(self, expression: str) -> List[str]:
        """Extract function names used in the expression."""
        functions = set()
        
        # Extract aggregate functions
        agg_matches = self.aggregate_pattern.findall(expression)
        for func, _ in agg_matches:
            functions.add(func.upper())
        
        # Extract date functions
        date_matches = self.date_function_pattern.findall(expression)
        for func, _ in date_matches:
            functions.add(func.upper())
        
        # Extract RANDOM function
        if self.random_pattern.search(expression):
            functions.add('RANDOM')
        
        return list(functions)
    
    def _extract_variables(self, expression: str) -> List[str]:
        """Extract variable references like @id, @name."""
        matches = self.variable_pattern.findall(expression)
        return matches
    
    def _convert_table_reference_to_sql(self, expression: str) -> str:
        """
        Convert table reference syntax to SQL.
        """
        # Find table reference patterns
        def replace_table_ref(match):
            table = match.group(1)
            condition = match.group(2)
            column = match.group(3)
            
            # Convert condition syntax (== to =, etc.)
            condition = condition.replace('==', '=')
            
            return f"SELECT {column} FROM {table} WHERE {condition}"
        
        # Replace aggregate functions with table references
        def replace_aggregate(match):
            func = match.group(1).upper()
            content = match.group(2)
            
            # Check if content contains table reference
            if '[' in content and ']' in content:
                # Convert table reference to subquery
                converted = replace_table_ref(self.table_ref_pattern.search(content))
                return f"{func}({converted})"
            else:
                return match.group(0)  # Return original if no table reference
        
        # Apply replacements
        result = self.aggregate_pattern.sub(replace_aggregate, expression)
        return result
    
    def validate_expression(self, expression: str) -> bool:
        """
        Validate that the expression is syntactically correct.
        
        Args:
            expression: The formula expression to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            parsed = self.parse(expression)
            
            # Basic validation checks
            if parsed.expression_type == 'table_reference':
                # Must have at least one table reference
                if not parsed.table_references:
                    return False
            
            # Check for balanced parentheses
            if expression.count('(') != expression.count(')'):
                return False
            
            # Check for balanced brackets
            if expression.count('[') != expression.count(']'):
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Expression validation failed: {e}")
            return False