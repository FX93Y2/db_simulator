"""
Formula resolver for post-simulation data generation.

Manages the resolution of formula-based attributes after simulation completion,
ensuring proper dependency ordering and context handling.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, Session

from ....config_parser import Attribute
from .evaluator import FormulaEvaluator

logger = logging.getLogger(__name__)


class FormulaResolver:
    """Resolves formula-based attributes after simulation completion."""
    
    def __init__(self, engine):
        """
        Initialize the formula resolver.
        
        Args:
            engine: SQLAlchemy engine for database access
        """
        self.engine = engine
        self.Session = sessionmaker(bind=engine)
    
    def resolve_all(self, pending_formulas: Dict[str, List[Attribute]]) -> bool:
        """
        Resolve all pending formula attributes.
        
        Args:
            pending_formulas: Dictionary mapping table names to lists of formula attributes
            
        Returns:
            True if all formulas resolved successfully, False otherwise
        """
        logger.info(f"FORMULA RESOLUTION: Starting resolution for {len(pending_formulas)} tables")
        logger.debug(f"FORMULA RESOLUTION: Tables with formulas: {list(pending_formulas.keys())}")
        
        try:
            with self.Session() as session:
                evaluator = FormulaEvaluator(session)
                
                # Process each table with formula attributes
                for table_name, formula_attrs in pending_formulas.items():
                    logger.info(f"FORMULA RESOLUTION: Processing table '{table_name}' with {len(formula_attrs)} formula attributes")
                    
                    for attr in formula_attrs:
                        logger.debug(f"FORMULA RESOLUTION: Attribute '{attr.name}' with expression: {attr.generator.expression}")
                    
                    success = self._resolve_table_formulas(
                        session, evaluator, table_name, formula_attrs
                    )
                    
                    if not success:
                        logger.error(f"FORMULA RESOLUTION: Failed to resolve formulas for table {table_name}")
                        return False
                    else:
                        logger.info(f"FORMULA RESOLUTION: Successfully resolved formulas for table {table_name}")
                
                # Commit all changes
                session.commit()
                logger.info("FORMULA RESOLUTION: All formula attributes resolved and committed successfully")
                return True
                
        except Exception as e:
            logger.error(f"Error resolving formulas: {e}")
            return False
    
    def _resolve_table_formulas(self, session: Session, evaluator: FormulaEvaluator, 
                               table_name: str, formula_attrs: List[Attribute]) -> bool:
        """
        Resolve formula attributes for a specific table.
        
        Args:
            session: Database session
            evaluator: Formula evaluator instance
            table_name: Name of the table to process
            formula_attrs: List of formula attributes to resolve
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get all rows from the table
            rows = self._get_table_rows(session, table_name)
            
            if not rows:
                logger.warning(f"FORMULA RESOLUTION: No rows found in table {table_name}")
                return True
            
            logger.info(f"FORMULA RESOLUTION: Processing {len(rows)} rows in table {table_name}")
            
            # Process each row
            for i, row in enumerate(rows):
                row_context = self._build_row_context(row)
                logger.debug(f"FORMULA RESOLUTION: Row {i+1}/{len(rows)} - ID: {row.get('id')}, Context: {row_context}")
                
                # Resolve each formula attribute for this row
                for attr in formula_attrs:
                    if not attr.generator or attr.generator.type != 'formula':
                        continue
                    
                    if not attr.generator.expression:
                        logger.warning(f"FORMULA RESOLUTION: Attribute {attr.name} has no expression")
                        continue
                    
                    logger.debug(f"FORMULA RESOLUTION: Evaluating '{attr.name}' for row ID {row.get('id')}")
                    logger.debug(f"FORMULA RESOLUTION: Expression: {attr.generator.expression}")
                    
                    # Evaluate the formula
                    value = self._evaluate_formula_for_row(
                        evaluator, attr, row_context, row
                    )
                    
                    logger.debug(f"FORMULA RESOLUTION: Result for '{attr.name}': {value}")
                    
                    if value is not None:
                        # Update the row with the calculated value
                        success = self._update_row_attribute(session, table_name, row, attr.name, value)
                        if success:
                            logger.debug(f"FORMULA RESOLUTION: Successfully updated {attr.name} = {value} for row ID {row.get('id')}")
                        else:
                            logger.error(f"FORMULA RESOLUTION: Failed to update {attr.name} for row ID {row.get('id')}")
                    else:
                        logger.debug(f"FORMULA RESOLUTION: NULL result for '{attr.name}' on row ID {row.get('id')} - skipping update")
            
            return True
            
        except Exception as e:
            logger.error(f"Error resolving formulas for table {table_name}: {e}")
            return False
    
    def _get_table_rows(self, session: Session, table_name: str) -> List[Dict[str, Any]]:
        """
        Get all rows from a table as dictionaries.
        
        Args:
            session: Database session
            table_name: Name of the table
            
        Returns:
            List of row dictionaries
        """
        try:
            # Get table column names
            inspector = inspect(session.get_bind())
            columns = inspector.get_columns(table_name)
            column_names = [col['name'] for col in columns]
            
            # Query all rows
            query = text(f"SELECT * FROM {table_name}")
            result = session.execute(query)
            
            # Convert to list of dictionaries
            rows = []
            for row in result:
                row_dict = dict(zip(column_names, row))
                rows.append(row_dict)
            
            return rows
            
        except Exception as e:
            logger.error(f"Error getting rows from table {table_name}: {e}")
            return []
    
    def _build_row_context(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build context dictionary for formula evaluation.
        
        Args:
            row: Row data dictionary
            
        Returns:
            Context dictionary for variable substitution
        """
        context = {}
        
        # Add all row columns as variables
        for column, value in row.items():
            context[column] = value
        
        return context
    
    def _evaluate_formula_for_row(self, evaluator: FormulaEvaluator, attr: Attribute, 
                                 context: Dict[str, Any], row: Dict[str, Any]) -> Any:
        """
        Evaluate a formula attribute for a specific row.
        
        Args:
            evaluator: Formula evaluator
            attr: Attribute with formula
            context: Row context for variables
            row: Current row data
            
        Returns:
            Calculated value or None if evaluation failed
        """
        try:
            expression = attr.generator.expression
            logger.debug(f"Evaluating formula for {attr.name}: {expression}")
            
            # Handle special cases for date calculations
            if self._is_date_expression(expression):
                return self._evaluate_date_formula(evaluator, expression, context, row)
            else:
                return evaluator.evaluate(expression, context)
                
        except Exception as e:
            logger.error(f"Error evaluating formula for {attr.name}: {e}")
            return None
    
    def _is_date_expression(self, expression: str) -> bool:
        """
        Check if expression involves date calculations.
        
        Args:
            expression: Formula expression
            
        Returns:
            True if expression involves dates
        """
        date_keywords = ['created_at', 'updated_at', 'timestamp', 'DAYS', 'HOURS', 'MINUTES']
        return any(keyword in expression for keyword in date_keywords)
    
    def _evaluate_date_formula(self, evaluator: FormulaEvaluator, expression: str, 
                              context: Dict[str, Any], row: Dict[str, Any]) -> Optional[datetime]:
        """
        Evaluate a formula that results in a date/datetime value.
        
        Args:
            evaluator: Formula evaluator
            expression: Date formula expression
            context: Row context
            row: Current row data
            
        Returns:
            Calculated datetime or None
        """
        try:
            # Check if expression is relative to another date field
            if 'MIN(' in expression and ('created_at' in expression or 'timestamp' in expression):
                # Get the base date from the MIN query
                base_result = evaluator.evaluate(expression.split(' - ')[0], context)
                
                if base_result and isinstance(base_result, (datetime, str)):
                    if isinstance(base_result, str):
                        base_date = datetime.fromisoformat(base_result.replace('Z', '+00:00'))
                    else:
                        base_date = base_result
                    
                    # Apply date arithmetic if present
                    if ' - ' in expression:
                        date_part = expression.split(' - ', 1)[1]
                        return evaluator.evaluate_with_date_arithmetic(base_date, f"- {date_part}", context)
                    else:
                        return base_date
            
            # For other date expressions, evaluate normally
            result = evaluator.evaluate(expression, context)
            
            # Convert string dates to datetime if needed
            if isinstance(result, str):
                try:
                    return datetime.fromisoformat(result.replace('Z', '+00:00'))
                except:
                    return result
            
            return result
            
        except Exception as e:
            logger.error(f"Error evaluating date formula: {e}")
            return None
    
    def _update_row_attribute(self, session: Session, table_name: str, 
                             row: Dict[str, Any], attr_name: str, value: Any) -> bool:
        """
        Update a specific attribute for a row.
        
        Args:
            session: Database session
            table_name: Name of the table
            row: Row data (must contain primary key)
            attr_name: Name of attribute to update
            value: New value
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Find primary key column
            primary_key = self._get_primary_key(session, table_name)
            if not primary_key:
                logger.error(f"No primary key found for table {table_name}")
                return False
            
            primary_key_value = row[primary_key]
            
            # Update the attribute
            update_query = text(f"UPDATE {table_name} SET {attr_name} = :value WHERE {primary_key} = :pk_value")
            session.execute(update_query, {"value": value, "pk_value": primary_key_value})
            
            logger.debug(f"Updated {table_name}.{attr_name} = {value} for {primary_key} = {primary_key_value}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating row attribute: {e}")
            return False
    
    def _get_primary_key(self, session: Session, table_name: str) -> Optional[str]:
        """
        Get the primary key column name for a table.
        
        Args:
            session: Database session
            table_name: Name of the table
            
        Returns:
            Primary key column name or None
        """
        try:
            inspector = inspect(session.get_bind())
            primary_keys = inspector.get_pk_constraint(table_name)
            
            if primary_keys and primary_keys['constrained_columns']:
                return primary_keys['constrained_columns'][0]
            
            # Fallback: look for 'id' column
            columns = inspector.get_columns(table_name)
            for col in columns:
                if col['name'].lower() == 'id':
                    return col['name']
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting primary key for {table_name}: {e}")
            return None