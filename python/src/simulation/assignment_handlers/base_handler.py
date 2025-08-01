"""
Base assignment handler for Arena-style Assign module.

This module defines the abstract interface that all assignment handlers must implement.
"""

from abc import ABC, abstractmethod
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ...config_parser.sim_parser import AssignmentOperation

logger = logging.getLogger(__name__)


class BaseAssignmentHandler(ABC):
    """
    Abstract base class for all assignment handlers.
    
    Each assignment type (attribute, variable, variable_array) should have 
    its own handler that inherits from this class.
    """
    
    def __init__(self, entity_attribute_manager=None):
        """
        Initialize the assignment handler.
        
        Args:
            entity_attribute_manager: Manager for entity attributes (used by AttributeHandler)
        """
        self.entity_attribute_manager = entity_attribute_manager
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    def can_handle(self, assignment_type: str) -> bool:
        """
        Check if this handler can handle the given assignment type.
        
        Args:
            assignment_type: Type of assignment to check ("attribute", "variable", etc.)
            
        Returns:
            True if this handler can handle the assignment type
        """
        pass
    
    @abstractmethod
    def execute_assignment(self, entity_id: int, assignment: 'AssignmentOperation') -> bool:
        """
        Execute an assignment operation for an entity.
        
        Args:
            entity_id: ID of the entity to assign to
            assignment: Assignment operation configuration
            
        Returns:
            True if assignment was successful, False otherwise
        """
        pass
    
    @abstractmethod
    def validate_assignment(self, assignment: 'AssignmentOperation') -> bool:
        """
        Validate that an assignment operation is properly configured.
        
        Args:
            assignment: Assignment operation to validate
            
        Returns:
            True if assignment is valid, False otherwise
        """
        pass
    
    def log_assignment(self, entity_id: int, assignment: 'AssignmentOperation', success: bool):
        """Log assignment execution."""
        if success:
            self.logger.debug(f"Executed {assignment.assignment_type} assignment for entity {entity_id}")
        else:
            self.logger.error(f"Failed {assignment.assignment_type} assignment for entity {entity_id}")