"""
SQL assignment handler for Arena-style Assign module.

This handler manages SQL-based assignments including:
- UPDATE statements for modifying database records
- SELECT statements for calculating values and storing them as entity attributes
"""

import logging
from typing import Any, TYPE_CHECKING
from sqlalchemy import text

from .base import BaseAssignmentHandler
from ....utils.sql_helpers import SQLExpressionEvaluator

if TYPE_CHECKING:
    from .....config_parser.sim_parser import AssignmentOperation

logger = logging.getLogger(__name__)


class SQLAssignmentHandler(BaseAssignmentHandler):
    """
    Handler for SQL-based assignment operations.
    
    Supports:
    - UPDATE statements: Direct database modifications
    - SELECT statements: Calculate values and assign to entity attributes
    """
    
    def __init__(self, entity_attribute_manager=None, engine=None):
        """
        Initialize the SQL assignment handler.
        
        Args:
            entity_attribute_manager: Manager for entity attributes
            engine: SQLAlchemy engine for database operations
        """
        super().__init__(entity_attribute_manager)
        self.engine = engine
        # Initialize SQL expression evaluator if we have both dependencies
        self.sql_expression_evaluator = None
        if engine and entity_attribute_manager:
            # Get db_config from entity_attribute_manager's entity_manager
            db_config = None
            if hasattr(entity_attribute_manager, 'entity_manager') and hasattr(entity_attribute_manager.entity_manager, 'db_config'):
                db_config = entity_attribute_manager.entity_manager.db_config
            # Create SQL expression evaluator for Entity.property support
            self.sql_expression_evaluator = SQLExpressionEvaluator(engine, entity_attribute_manager, db_config)
        
    def can_handle(self, assignment_type: str) -> bool:
        """
        Check if this handler can handle the given assignment type.
        
        Args:
            assignment_type: Type of assignment to check
            
        Returns:
            True if assignment type is "sql"
        """
        return assignment_type.lower() == "sql"
    
    def supports_entity_table(self) -> bool:
        """
        Check if this handler supports entity_table parameter.
        
        Returns:
            True since SQL handler needs entity table for Entity.property resolution
        """
        return True
    
    def execute_assignment(self, entity_id: int, assignment: 'AssignmentOperation', entity_table: str = None) -> bool:
        """
        Execute a SQL assignment operation with Entity.property support.
        
        Args:
            entity_id: ID of the entity to assign to
            assignment: SQL assignment operation configuration
            entity_table: Entity table name for Entity.property resolution
            
        Returns:
            True if assignment was successful, False otherwise
        """
        if not self.validate_assignment(assignment):
            self.log_assignment(entity_id, assignment, False)
            return False
        
        try:
            sql_statement = assignment.expression.strip()
            
            # Step 3: Check if we need to substitute Entity.property references
            if 'Entity.' in sql_statement and self.sql_expression_evaluator and entity_table:
                self.logger.debug(f"Entity {entity_id}: SQL has Entity properties, attempting substitution")
                resolved_sql = self.sql_expression_evaluator.substitute_sql_variables(
                    entity_id, entity_table, sql_statement
                )
                if resolved_sql is None:
                    self.logger.error(f"Entity {entity_id}: Failed to resolve Entity properties in SQL")
                    self.log_assignment(entity_id, assignment, False)
                    return False
                sql_statement = resolved_sql
                self.logger.debug(f"Entity {entity_id}: Using resolved SQL: {sql_statement}")
            
            # Determine if this is a SELECT or UPDATE/INSERT/DELETE
            if sql_statement.upper().startswith('SELECT'):
                return self._execute_select(entity_id, assignment, sql_statement, entity_table)
            else:
                return self._execute_update(entity_id, assignment, sql_statement, entity_table)
                
        except Exception as e:
            self.logger.error(f"SQL assignment failed for entity {entity_id}: {e}")
            self.log_assignment(entity_id, assignment, False)
            return False
    
    def _execute_select(self, entity_id: int, assignment: 'AssignmentOperation', sql_statement: str, entity_table: str = None) -> bool:
        """
        Execute a SELECT statement and store result as entity attribute.
        
        Args:
            entity_id: Entity ID
            assignment: Assignment configuration
            sql_statement: SELECT SQL statement
            
        Returns:
            True if successful
        """
        if not assignment.attribute_name:
            self.logger.error(f"SELECT assignment requires attribute_name for entity {entity_id}")
            return False
        
        if not self.entity_attribute_manager:
            self.logger.error(f"No entity attribute manager available for SELECT assignment, entity {entity_id}")
            return False
        
        try:
            with self.engine.connect() as connection:
                # Start a transaction to ensure we see any previous changes
                trans = connection.begin()
                try:
                    self.logger.info(f"Entity {entity_id}: Executing SELECT: {sql_statement}")
                    result = connection.execute(text(sql_statement))
                    # Get the first row, first column value
                    value = result.scalar()
                    
                    self.logger.info(f"Entity {entity_id}: SQL SELECT returned value: {value} (type: {type(value)})")
                    
                    if value is not None:
                        # Convert value to appropriate Python type
                        converted_value = self._convert_sql_result_type(value)
                        self.logger.debug(f"Entity {entity_id}: Converted SQL result {value} ({type(value)}) -> {converted_value} ({type(converted_value)})")
                        
                        # Set the attribute via the entity attribute manager
                        success = self.entity_attribute_manager.set_attribute(entity_id, assignment.attribute_name, converted_value)
                        self.logger.info(f"Entity {entity_id}: set_attribute({assignment.attribute_name}, {converted_value}) returned: {success}")
                        
                        # Commit the transaction
                        trans.commit()
                        self.log_assignment(entity_id, assignment, True)
                        return True
                    else:
                        self.logger.warning(f"Entity {entity_id}: SQL SELECT returned NULL/None result")
                        trans.rollback()
                        self.log_assignment(entity_id, assignment, False)
                        return False
                        
                except Exception as e:
                    trans.rollback()
                    raise e
                    
        except Exception as e:
            self.logger.error(f"Entity {entity_id}: Error in SELECT execution: {e}")
            self.log_assignment(entity_id, assignment, False)
            return False
    
    def _execute_update(self, entity_id: int, assignment: 'AssignmentOperation', sql_statement: str, entity_table: str = None) -> bool:
        """
        Execute an UPDATE/INSERT/DELETE statement.
        
        Args:
            entity_id: Entity ID
            assignment: Assignment configuration
            sql_statement: SQL statement
            
        Returns:
            True if successful
        """
        try:
            with self.engine.connect() as connection:
                trans = connection.begin()
                try:
                    self.logger.info(f"Entity {entity_id}: Executing UPDATE: {sql_statement}")
                    result = connection.execute(text(sql_statement))
                    trans.commit()
                    
                    rows_affected = result.rowcount
                    self.logger.info(f"Entity {entity_id}: SQL UPDATE affected {rows_affected} rows")
                    self.log_assignment(entity_id, assignment, True)
                    return True
                    
                except Exception as e:
                    trans.rollback()
                    raise e
                    
        except Exception as e:
            self.logger.error(f"Entity {entity_id}: Error in UPDATE execution: {e}")
            self.log_assignment(entity_id, assignment, False)
            return False
    
    def validate_assignment(self, assignment: 'AssignmentOperation') -> bool:
        """
        Validate that a SQL assignment operation is properly configured.
        
        Args:
            assignment: Assignment operation to validate
            
        Returns:
            True if assignment is valid, False otherwise
        """
        if assignment.assignment_type.lower() != "sql":
            self.logger.error(f"Invalid assignment type for SQL handler: {assignment.assignment_type}")
            return False
        
        if not assignment.expression or not assignment.expression.strip():
            self.logger.error("SQL assignment requires non-empty expression field")
            return False
        
        if not self.engine:
            self.logger.error("SQL handler requires database engine")
            return False
        
        # For SELECT statements, require attribute_name
        sql_statement = assignment.expression.strip()
        if sql_statement.upper().startswith('SELECT') and not assignment.attribute_name:
            self.logger.error("SELECT assignments require attribute_name field")
            return False
        
        return True
    
    def _convert_sql_result_type(self, value):
        """
        Convert SQL result to appropriate Python type.
        
        SQLite returns strings for most values, but we want proper types
        for numeric comparisons and other operations.
        
        Args:
            value: Raw value from SQL query result
            
        Returns:
            Value converted to appropriate Python type
        """
        if value is None:
            return None
        
        # If already a proper type, return as-is
        if isinstance(value, (int, float, bool)):
            return value
            
        # Try to convert strings to numbers if they represent numbers
        if isinstance(value, str):
            # Try integer first
            try:
                # Check if it's a whole number
                float_val = float(value)
                if float_val.is_integer():
                    return int(float_val)
                else:
                    return float_val
            except ValueError:
                # If it can't be converted to number, keep as string
                return value
        
        # Return as-is for other types
        return value