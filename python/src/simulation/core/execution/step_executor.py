"""Execute individual steps in flows and route to the next step."""

import logging
from typing import Dict, Optional, TYPE_CHECKING
import simpy

if TYPE_CHECKING:
    from ....config_parser import EventFlow, Step

logger = logging.getLogger(__name__)


class StepExecutor:
    """Runs a step via processors and continues flow routing."""
    
    def __init__(self, env: simpy.Environment, step_processor_factory, flow_event_trackers: Dict):
        """
        Args:
            env: SimPy environment.
            step_processor_factory: Factory for step processors.
            flow_event_trackers: Flow-specific event trackers.
        """
        self.env = env
        self.step_processor_factory = step_processor_factory
        self.flow_event_trackers = flow_event_trackers
    
    def process_step(self, entity_id: int, step_id: str, flow: 'EventFlow', 
                    entity_table: str, event_table: str):
        """
        Process a step using processors, then route to next if provided.

        Args:
            entity_id: Entity ID.
            step_id: Current step ID.
            flow: Event flow configuration.
            entity_table: Name of the entity table.
            event_table: Name of the event table.
        """
        step = self._find_step_by_id(step_id, flow)
        if not step:
            logger.error(f"Step {step_id} not found in flow {flow.flow_id}")
            return
        
        logger.debug(f"Processing step {step_id} of type {step.step_type} for entity {entity_id}")
        
        try:
            # Get flow-specific EventTracker
            flow_event_tracker = self.flow_event_trackers.get(flow.flow_id)
            
            # Use the step processor factory to process the step
            step_generator = self.step_processor_factory.process_step(
                entity_id, step, flow, entity_table, event_table, flow_event_tracker
            )
            
            # Process the step and get the next step ID
            next_step_id = yield from step_generator
            
            # Continue to next step if applicable
            if next_step_id:
                self.env.process(self.process_step(entity_id, next_step_id, flow, entity_table, event_table))
            else:
                logger.debug(f"Entity {entity_id} flow ended at step {step_id}")
                
        except Exception as e:
            logger.error(f"Error processing step {step_id} for entity {entity_id}: {str(e)}", exc_info=True)
    
    def _find_step_by_id(self, step_id: str, flow: 'EventFlow') -> Optional['Step']:
        """
        Find a step by its ID within a flow
        
        Args:
            step_id: Step ID to find.
            flow: Event flow to search in.
            
        Returns:
            Step object or None if not found.
        """
        for step in flow.steps:
            if step.step_id == step_id:
                return step
        return None
