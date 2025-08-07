"""
Release step processor for handling entity completion and resource cleanup.

This processor handles the final release of resources and completion of
entity processing in the simulation flow.
"""

import logging
from typing import Any, Generator, Optional

from .base import StepProcessor

logger = logging.getLogger(__name__)


class ReleaseStepProcessor(StepProcessor):
    """
    Processor for release-type steps in the simulation flow.
    
    Handles entity completion, resource cleanup, and flow termination.
    This processor can optionally perform active resource release if entities
    hold resources throughout their lifecycle.
    """
    
    def can_handle(self, step_type: str) -> bool:
        """Check if this processor can handle release steps."""
        return step_type == "release"
    
    def validate_step(self, step: 'Step') -> bool:
        """Validate release step configuration."""
        if not super().validate_step(step):
            return False
        return step.step_type == "release"
    
    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                entity_table: str, event_table: str, event_tracker=None) -> Generator[Any, None, Optional[str]]:
        """
        Process a release step to complete entity lifecycle.
        
        Args:
            entity_id: Entity ID
            step: Release step configuration
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
            
        Yields:
            No SimPy events (release is instantaneous)
            
        Returns:
            None (flow ends at release step)
        """
        if not self.validate_step(step):
            self.logger.error(f"Invalid release step configuration for step {step.step_id}")
            return None
        
        self.log_step_start(entity_id, step)
        
        # Perform resource cleanup if needed
        self._perform_resource_cleanup(entity_id, step)
        
        # Record entity completion
        self._record_entity_completion(entity_id, step, flow)
        
        # Log completion
        self.logger.info(f"Entity {entity_id} completed flow {flow.flow_id} at release step {step.step_id}")
        
        self.log_step_end(entity_id, step, None)
        
        # Release step ends the flow - return None to indicate completion
        yield self.env.timeout(0)  # Instantaneous event
        return None
    
    def _perform_resource_cleanup(self, entity_id: int, step: 'Step'):
        """
        Perform active resource cleanup for the entity.
        
        This method can be configured to release resources that the entity
        may have been holding throughout its lifecycle. Currently, our
        architecture releases resources after each event, but this provides
        a hook for future enhancement.
        
        Args:
            entity_id: Entity ID
            step: Release step configuration
        """
        try:
            # Check if entity has any persistent resource allocations
            persistent_allocations = self._get_persistent_allocations(entity_id)
            
            if persistent_allocations:
                self.logger.info(f"Releasing {len(persistent_allocations)} persistent resources for entity {entity_id}")
                
                for allocation in persistent_allocations:
                    try:
                        self.resource_manager.release_resources(allocation['event_id'])
                        self.logger.debug(f"Released resources for event {allocation['event_id']} of entity {entity_id}")
                    except Exception as e:
                        self.logger.warning(f"Error releasing resources for event {allocation['event_id']}: {e}")
            else:
                self.logger.debug(f"No persistent resource allocations found for entity {entity_id}")
                
        except Exception as e:
            self.logger.warning(f"Error during resource cleanup for entity {entity_id}: {e}")
    
    def _get_persistent_allocations(self, entity_id: int) -> list:
        """
        Get list of persistent resource allocations for an entity.
        
        This method checks for any resources that are still allocated to
        events belonging to this entity. In the current architecture,
        this should typically return an empty list since resources are
        released after each event.
        
        Args:
            entity_id: Entity ID to check
            
        Returns:
            List of allocation records
        """
        try:
            persistent_allocations = []
            
            # Check resource manager's current allocations
            if hasattr(self.resource_manager, 'event_allocations'):
                for event_id, resources in self.resource_manager.event_allocations.items():
                    # We would need a way to map event_id back to entity_id
                    # This is a placeholder for future enhancement
                    if self._event_belongs_to_entity(event_id, entity_id):
                        persistent_allocations.append({
                            'event_id': event_id,
                            'resources': resources
                        })
            
            return persistent_allocations
            
        except Exception as e:
            self.logger.warning(f"Error checking persistent allocations for entity {entity_id}: {e}")
            return []
    
    def _event_belongs_to_entity(self, event_id: int, entity_id: int) -> bool:
        """
        Check if an event belongs to a specific entity.
        
        This is a placeholder method that would need to query the database
        to determine the relationship between events and entities.
        
        Args:
            event_id: Event ID to check
            entity_id: Entity ID to check against
            
        Returns:
            True if event belongs to entity, False otherwise
        """
        # Placeholder implementation
        # In a real implementation, this would query the database to check
        # the relationship between the event and entity
        return False
    
    def _record_entity_completion(self, entity_id: int, step: 'Step', flow: 'EventFlow'):
        """
        Record the completion of an entity in the simulation.
        
        This method can be used to track entity completion statistics,
        update entity status in the database, or trigger completion events.
        
        Args:
            entity_id: Entity ID
            step: Release step configuration
            flow: Event flow configuration
        """
        try:
            # Record completion time
            completion_time = self.env.now
            
            # Update entity manager if it tracks completion
            if hasattr(self.entity_manager, 'entity_current_event_types'):
                # Mark entity as completed
                self.entity_manager.entity_current_event_types[entity_id] = 'COMPLETED'
            
            # Could also record completion in database or tracking system
            self.logger.debug(f"Recorded completion for entity {entity_id} at time {completion_time}")
            
        except Exception as e:
            self.logger.warning(f"Error recording entity completion for entity {entity_id}: {e}")
    
    def get_release_strategies(self) -> list:
        """
        Get list of supported release strategies.
        
        Returns:
            List of release strategy options
        """
        return [
            "immediate",      # Release resources immediately (current behavior)
            "persistent",     # Hold resources until release step
            "conditional"     # Release based on conditions
        ]
    
    def configure_release_strategy(self, strategy: str):
        """
        Configure the resource release strategy.
        
        Args:
            strategy: Release strategy to use
        """
        if strategy not in self.get_release_strategies():
            raise ValueError(f"Unsupported release strategy: {strategy}")
        
        # This would be implemented based on specific requirements
        self.logger.info(f"Release strategy configured: {strategy}")
        # TODO: Implement strategy-specific logic