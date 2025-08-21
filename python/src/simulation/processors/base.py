"""
Abstract base class for step processors.

This module defines the common interface that all step processors must implement.
"""

from abc import ABC, abstractmethod
from typing import Any, Generator, Optional
import logging

logger = logging.getLogger(__name__)


class StepProcessor(ABC):
    """
    Abstract base class for all step processors.
    
    Each step type (event, decide, release) should have its own processor
    that inherits from this class and implements the required methods.
    """
    
    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config):
        """
        Initialize the step processor.
        
        Args:
            env: SimPy environment
            engine: SQLAlchemy engine
            resource_manager: Resource manager instance
            entity_manager: Entity manager instance
            event_tracker: Event tracker instance
            config: Simulation configuration
        """
        self.env = env
        self.engine = engine
        self.resource_manager = resource_manager
        self.entity_manager = entity_manager
        self.event_tracker = event_tracker
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                entity_table: str, event_table: str, event_tracker=None) -> Generator[Any, None, Optional[str]]:
        """
        Process a step for an entity.
        
        Args:
            entity_id: ID of the entity being processed
            step: Step configuration object
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
            
        Yields:
            SimPy events during processing
            
        Returns:
            Next step ID if applicable, None if flow ends
        """
        pass
    
    @abstractmethod
    def can_handle(self, step_type: str) -> bool:
        """
        Check if this processor can handle the given step type.
        
        Args:
            step_type: Type of step to check
            
        Returns:
            True if this processor can handle the step type
        """
        pass
    
    def validate_step(self, step: 'Step') -> bool:
        """
        Validate that the step configuration is valid for this processor.
        
        Args:
            step: Step configuration to validate
            
        Returns:
            True if step is valid, False otherwise
        """
        # Default implementation - subclasses can override
        return step is not None and step.step_type is not None
    
    def log_step_start(self, entity_id: int, step: 'Step'):
        """Log the start of step processing."""
        self.logger.debug(f"Starting {step.step_type} step '{step.step_id}' for entity {entity_id}")
    
    def log_step_end(self, entity_id: int, step: 'Step', next_step_id: Optional[str] = None):
        """Log the end of step processing."""
        if next_step_id:
            self.logger.debug(f"Completed {step.step_type} step '{step.step_id}' for entity {entity_id}, next: {next_step_id}")
        else:
            self.logger.debug(f"Completed {step.step_type} step '{step.step_id}' for entity {entity_id}, flow ended")