"""
Assignment handler factory for Arena-style Assign module.

This factory manages and routes assignment operations to the appropriate handlers.
"""

import logging
from typing import List, Optional, TYPE_CHECKING

from .base import BaseAssignmentHandler
from .attribute import AttributeAssignmentHandler

if TYPE_CHECKING:
    from ......config_parser.sim_parser import AssignmentOperation
    from ....managers.entity_attribute_manager import EntityAttributeManager

logger = logging.getLogger(__name__)


class AssignmentHandlerFactory:
    """
    Factory for managing and routing assignment operations to appropriate handlers.
    
    This factory maintains a registry of assignment handlers and routes
    assignment operations based on assignment type.
    """
    
    def __init__(self, entity_attribute_manager: 'EntityAttributeManager'):
        """
        Initialize the assignment handler factory.
        
        Args:
            entity_attribute_manager: Manager for entity attributes
        """
        self.entity_attribute_manager = entity_attribute_manager
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # Initialize handlers
        self.handlers: List[BaseAssignmentHandler] = [
            AttributeAssignmentHandler(entity_attribute_manager)
            # Future handlers will be added here:
            # VariableAssignmentHandler(),
            # VariableArrayAssignmentHandler()
        ]
        
        # Build handler lookup cache
        self._handler_cache = {}
        self._build_handler_cache()
        
        self.logger.info(f"Initialized assignment handler factory with {len(self.handlers)} handlers")
    
    def _build_handler_cache(self):
        """Build cache mapping assignment types to handlers."""
        self._handler_cache.clear()
        
        for handler in self.handlers:
            # Check standard assignment types
            standard_types = ["attribute", "variable", "variable_array"]
            for assignment_type in standard_types:
                if handler.can_handle(assignment_type):
                    if assignment_type in self._handler_cache:
                        self.logger.warning(f"Multiple handlers support assignment type '{assignment_type}'")
                    self._handler_cache[assignment_type] = handler
        
        self.logger.debug(f"Built handler cache: {list(self._handler_cache.keys())}")
    
    def get_handler(self, assignment_type: str) -> Optional[BaseAssignmentHandler]:
        """
        Get the handler for a specific assignment type.
        
        Args:
            assignment_type: Type of assignment ("attribute", "variable", etc.)
            
        Returns:
            Appropriate assignment handler or None if not found
        """
        assignment_type = assignment_type.lower()
        
        if assignment_type in self._handler_cache:
            return self._handler_cache[assignment_type]
        
        # Fallback: search through handlers if not in cache
        for handler in self.handlers:
            if handler.can_handle(assignment_type):
                self._handler_cache[assignment_type] = handler  # Cache for next time
                return handler
        
        self.logger.error(f"No handler found for assignment type: {assignment_type}")
        return None
    
    def execute_assignment(self, entity_id: int, assignment: 'AssignmentOperation') -> bool:
        """
        Execute an assignment operation using the appropriate handler.
        
        Args:
            entity_id: ID of the entity to assign to
            assignment: Assignment operation configuration
            
        Returns:
            True if assignment was successful, False otherwise
        """
        handler = self.get_handler(assignment.assignment_type)
        if handler is None:
            self.logger.error(f"No handler available for assignment type: {assignment.assignment_type}")
            return False
        
        self.logger.debug(f"Executing {assignment.assignment_type} assignment for entity {entity_id}")
        return handler.execute_assignment(entity_id, assignment)
    
    def validate_assignment(self, assignment: 'AssignmentOperation') -> bool:
        """
        Validate an assignment operation using the appropriate handler.
        
        Args:
            assignment: Assignment operation to validate
            
        Returns:
            True if assignment is valid, False otherwise
        """
        handler = self.get_handler(assignment.assignment_type)
        if handler is None:
            return False
        
        return handler.validate_assignment(assignment)
    
    def get_supported_assignment_types(self) -> List[str]:
        """
        Get list of all supported assignment types.
        
        Returns:
            List of assignment types supported by any handler
        """
        return list(self._handler_cache.keys())
    
    def add_handler(self, handler: BaseAssignmentHandler):
        """
        Add a new assignment handler to the factory.
        
        This method allows for dynamic addition of custom assignment handlers.
        
        Args:
            handler: Assignment handler to add
        """
        if not isinstance(handler, BaseAssignmentHandler):
            raise TypeError("Handler must inherit from BaseAssignmentHandler")
        
        self.handlers.append(handler)
        self._build_handler_cache()  # Rebuild cache
        
        # Log supported assignment types for this handler
        supported_types = []
        for assignment_type in ["attribute", "variable", "variable_array"]:
            if handler.can_handle(assignment_type):
                supported_types.append(assignment_type)
        
        self.logger.info(f"Added handler {handler.__class__.__name__} supporting: {supported_types}")
    
    def get_handler_info(self) -> dict:
        """
        Get information about registered handlers.
        
        Returns:
            Dictionary mapping assignment types to handler class names
        """
        return {
            assignment_type: handler.__class__.__name__
            for assignment_type, handler in self._handler_cache.items()
        }
    
    def get_statistics(self) -> dict:
        """
        Get factory statistics and handler information.
        
        Returns:
            Dictionary with factory statistics
        """
        return {
            "total_handlers": len(self.handlers),
            "supported_assignment_types": self.get_supported_assignment_types(),
            "handler_mapping": self.get_handler_info(),
            "cache_size": len(self._handler_cache)
        }