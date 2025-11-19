"""
Factory for creating and managing step processors.

This module provides a factory pattern implementation for managing
different step processor types in the simulation engine.
"""

import logging
from typing import Dict, List, Optional

from .base import StepProcessor
from .event.processor import EventStepProcessor
from .decide.processor import DecideStepProcessor
from .release.processor import ReleaseStepProcessor
from .assign.processor import AssignStepProcessor
from .create.processor import CreateStepProcessor
from .trigger.processor import TriggerStepProcessor

logger = logging.getLogger(__name__)


class StepProcessorFactory:
    """
    Factory class for creating and managing step processors.
    
    This factory maintains instances of all step processors and routes
    step processing requests to the appropriate processor based on step type.
    """
    
    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config, entity_attribute_manager=None, simulator=None, queue_manager=None, db_config=None):
        """
        Initialize the step processor factory.

        Args:
            env: SimPy environment
            engine: SQLAlchemy engine
            resource_manager: Resource manager instance
            entity_manager: Entity manager instance
            event_tracker: Event tracker instance
            config: Simulation configuration
            entity_attribute_manager: Entity attribute manager instance (optional)
            simulator: Simulator instance (optional)
            queue_manager: Queue manager instance (optional)
            db_config: Database configuration instance (optional, required for trigger processor)
        """
        self.env = env
        self.engine = engine
        self.resource_manager = resource_manager
        self.entity_manager = entity_manager
        self.event_tracker = event_tracker
        self.config = config
        self.entity_attribute_manager = entity_attribute_manager
        self.simulator = simulator
        self.queue_manager = queue_manager
        self.db_config = db_config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

        # Initialize all processors with simulator and queue_manager references
        self.processors: List[StepProcessor] = [
            EventStepProcessor(env, engine, resource_manager, entity_manager, event_tracker, config, simulator, queue_manager),
            DecideStepProcessor(env, engine, resource_manager, entity_manager, event_tracker, config, simulator),
            ReleaseStepProcessor(env, engine, resource_manager, entity_manager, event_tracker, config, simulator),
            AssignStepProcessor(env, engine, resource_manager, entity_manager, event_tracker, config, simulator),
            CreateStepProcessor(env, engine, resource_manager, entity_manager, event_tracker, config, simulator),
            TriggerStepProcessor(env, engine, resource_manager, entity_manager, event_tracker, config, simulator)
        ]
        
        # Configure processors that need entity attribute manager
        self._configure_attribute_dependent_processors()

        # Configure processors that need database config
        self._configure_db_config_dependent_processors()

        # Create lookup cache for faster processor retrieval
        self._processor_cache: Dict[str, StepProcessor] = {}
        self._build_processor_cache()

        self.logger.info(f"Initialized step processor factory with {len(self.processors)} processors")
    
    def _configure_attribute_dependent_processors(self):
        """Configure processors that depend on entity attribute manager."""
        if self.entity_attribute_manager is None:
            return
        
        # Import here to avoid circular imports
        from .assign.handlers.factory import AssignmentHandlerFactory
        
        # Create assignment handler factory
        assignment_handler_factory = AssignmentHandlerFactory(self.entity_attribute_manager, self.engine)
        
        # Configure processors
        for processor in self.processors:
            if isinstance(processor, DecideStepProcessor):
                processor.set_entity_attribute_manager(self.entity_attribute_manager)
            elif isinstance(processor, AssignStepProcessor):
                processor.set_assignment_handler_factory(assignment_handler_factory)
        
        self.logger.info("Configured attribute-dependent processors")

    def _configure_db_config_dependent_processors(self):
        """Configure processors that depend on database config."""
        if self.db_config is None:
            return

        # Configure trigger processor with database config
        for processor in self.processors:
            if isinstance(processor, TriggerStepProcessor):
                processor.set_db_config(self.db_config)

        self.logger.info("Configured database config-dependent processors")

    def _build_processor_cache(self):
        """Build cache mapping step types to processors."""
        self._processor_cache.clear()
        
        for processor in self.processors:
            # Get supported step types for this processor
            supported_types = self._get_supported_types(processor)
            for step_type in supported_types:
                if step_type in self._processor_cache:
                    self.logger.warning(f"Multiple processors support step type '{step_type}'")
                self._processor_cache[step_type] = processor
        
        self.logger.debug(f"Built processor cache: {list(self._processor_cache.keys())}")
    
    def _get_supported_types(self, processor: StepProcessor) -> List[str]:
        """
        Get list of step types supported by a processor.

        Args:
            processor: Processor to check

        Returns:
            List of supported step types
        """
        # Standard step types to check
        standard_types = ["event", "decide", "release", "assign", "create", "trigger"]
        supported = []

        for step_type in standard_types:
            if processor.can_handle(step_type):
                supported.append(step_type)

        return supported
    
    def get_processor(self, step_type: str) -> Optional[StepProcessor]:
        """
        Get the processor for a specific step type.
        
        Args:
            step_type: Type of step to process
            
        Returns:
            Appropriate step processor or None if not found
        """
        if step_type in self._processor_cache:
            return self._processor_cache[step_type]
        
        # Fallback: search through processors if not in cache
        for processor in self.processors:
            if processor.can_handle(step_type):
                self._processor_cache[step_type] = processor  # Cache for next time
                return processor
        
        self.logger.error(f"No processor found for step type: {step_type}")
        return None
    
    def process_step(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                    entity_table: str, event_table: str, flow_event_tracker=None):
        """
        Process a step using the appropriate processor.
        
        Args:
            entity_id: Entity ID
            step: Step configuration
            flow: Event flow configuration
            entity_table: Name of entity table
            event_table: Name of event table
            flow_event_tracker: Flow-specific EventTracker (optional, uses default if not provided)
            
        Returns:
            Generator from the step processor
        """
        processor = self.get_processor(step.step_type)
        if processor is None:
            raise ValueError(f"No processor available for step type: {step.step_type}")
        
        # Use flow-specific EventTracker if provided, otherwise use default
        event_tracker = flow_event_tracker or processor.event_tracker
        
        self.logger.debug(f"Processing {step.step_type} step '{step.step_id}' for entity {entity_id} using EventTracker for flow {flow.flow_id}")
        return processor.process(entity_id, step, flow, entity_table, event_table, event_tracker)
    
    def add_processor(self, processor: StepProcessor):
        """
        Add a new step processor to the factory.
        
        This method allows for dynamic addition of custom step processors.
        
        Args:
            processor: Step processor to add
        """
        if not isinstance(processor, StepProcessor):
            raise TypeError("Processor must inherit from StepProcessor")
        
        self.processors.append(processor)
        self._build_processor_cache()  # Rebuild cache
        
        supported_types = self._get_supported_types(processor)
        self.logger.info(f"Added processor {processor.__class__.__name__} supporting: {supported_types}")
    
    def remove_processor(self, processor_class: type):
        """
        Remove a processor of the specified class.
        
        Args:
            processor_class: Class of processor to remove
        """
        initial_count = len(self.processors)
        self.processors = [p for p in self.processors if not isinstance(p, processor_class)]
        removed_count = initial_count - len(self.processors)
        
        if removed_count > 0:
            self._build_processor_cache()  # Rebuild cache
            self.logger.info(f"Removed {removed_count} processors of type {processor_class.__name__}")
        else:
            self.logger.warning(f"No processors of type {processor_class.__name__} found to remove")
    
    def get_supported_step_types(self) -> List[str]:
        """
        Get list of all supported step types.
        
        Returns:
            List of step types supported by any processor
        """
        return list(self._processor_cache.keys())
    
    def get_processor_info(self) -> Dict[str, str]:
        """
        Get information about registered processors.
        
        Returns:
            Dictionary mapping step types to processor class names
        """
        return {
            step_type: processor.__class__.__name__
            for step_type, processor in self._processor_cache.items()
        }
    
    def validate_step(self, step: 'Step') -> bool:
        """
        Validate that a step can be processed by this factory.
        
        Args:
            step: Step to validate
            
        Returns:
            True if step can be processed, False otherwise
        """
        processor = self.get_processor(step.step_type)
        if processor is None:
            return False
        
        return processor.validate_step(step)
    
    def get_statistics(self) -> Dict[str, any]:
        """
        Get factory statistics and processor information.
        
        Returns:
            Dictionary with factory statistics
        """
        return {
            "total_processors": len(self.processors),
            "supported_step_types": self.get_supported_step_types(),
            "processor_mapping": self.get_processor_info(),
            "cache_size": len(self._processor_cache)
        }