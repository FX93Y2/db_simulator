"""
Attribute assignment handler for Arena-style Assign module.

This handler manages attribute assignments to entities during simulation.
"""

import logging
from typing import Union, TYPE_CHECKING

from .base_handler import BaseAssignmentHandler

if TYPE_CHECKING:
    from ...config_parser.sim_parser import AssignmentOperation
    from ..entity_attribute_manager import EntityAttributeManager

logger = logging.getLogger(__name__)


class AttributeAssignmentHandler(BaseAssignmentHandler):
    """
    Handler for attribute assignment operations.
    
    Manages setting custom attributes on entities with string or numeric values.
    """
    
    def __init__(self, entity_attribute_manager: 'EntityAttributeManager'):
        """
        Initialize the attribute assignment handler.
        
        Args:
            entity_attribute_manager: Manager for entity attributes
        """
        super().__init__(entity_attribute_manager)
        if entity_attribute_manager is None:
            raise ValueError("AttributeAssignmentHandler requires EntityAttributeManager")
    
    def can_handle(self, assignment_type: str) -> bool:
        """Check if this handler can handle attribute assignments."""
        return assignment_type.lower() == "attribute"
    
    def validate_assignment(self, assignment: 'AssignmentOperation') -> bool:
        """
        Validate that an attribute assignment is properly configured.
        
        Args:
            assignment: Assignment operation to validate
            
        Returns:
            True if assignment is valid, False otherwise
        """
        if assignment.assignment_type.lower() != "attribute":
            self.logger.error(f"Invalid assignment type for AttributeHandler: {assignment.assignment_type}")
            return False
        
        if not assignment.attribute_name:
            self.logger.error("Attribute assignment missing attribute_name")
            return False
        
        if assignment.value is None:
            self.logger.error(f"Attribute assignment '{assignment.attribute_name}' missing value")
            return False
        
        # Validate value type (string, int, or float only)
        if not isinstance(assignment.value, (str, int, float)):
            self.logger.error(f"Invalid value type for attribute '{assignment.attribute_name}': {type(assignment.value)}. Only str, int, float supported.")
            return False
        
        return True
    
    def execute_assignment(self, entity_id: int, assignment: 'AssignmentOperation') -> bool:
        """
        Execute an attribute assignment for an entity.
        
        Args:
            entity_id: ID of the entity to assign to
            assignment: Assignment operation configuration
            
        Returns:
            True if assignment was successful, False otherwise
        """
        if not self.validate_assignment(assignment):
            return False
        
        try:
            success = self.entity_attribute_manager.set_attribute(
                entity_id=entity_id,
                attribute_name=assignment.attribute_name,
                value=assignment.value
            )
            
            if success:
                self.logger.info(f"Assigned attribute '{assignment.attribute_name}' = {assignment.value} to entity {entity_id}")
            else:
                self.logger.error(f"Failed to assign attribute '{assignment.attribute_name}' to entity {entity_id}")
            
            self.log_assignment(entity_id, assignment, success)
            return success
            
        except Exception as e:
            self.logger.error(f"Error executing attribute assignment for entity {entity_id}: {str(e)}", exc_info=True)
            self.log_assignment(entity_id, assignment, False)
            return False
    
    def get_supported_value_types(self) -> list:
        """
        Get list of supported value types for attribute assignments.
        
        Returns:
            List of supported Python types
        """
        return [str, int, float]
    
    def format_value_for_logging(self, value: Union[str, int, float]) -> str:
        """
        Format a value for logging purposes.
        
        Args:
            value: Value to format
            
        Returns:
            Formatted string representation
        """
        if isinstance(value, str):
            return f'"{value}"'
        else:
            return str(value)