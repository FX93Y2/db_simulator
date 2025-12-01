"""
Entity routing logic for the simulation engine.
"""

import logging
from typing import Optional, TYPE_CHECKING
import simpy

if TYPE_CHECKING:
    from ....config_parser import EventFlow, Step

logger = logging.getLogger(__name__)


class EntityRouter:
    """
    Handles entity routing through simulation flows.
    
    This class manages the routing of entities from their creation
    points to their initial processing steps, and between steps
    during flow execution.
    """
    
    def __init__(self, env: simpy.Environment):
        """
        Initialize the entity router.
        
        Args:
            env: SimPy environment
        """
        self.env = env
    
    def route_entity_from_create(self, entity_id: int, initial_step_id: str, flow: 'EventFlow',
                                entity_table: str, event_table: str, step_executor):
        """
        Route an entity from a create module to its initial step.
        
        Args:
            entity_id: ID of the created entity
            initial_step_id: ID of the initial step to route to
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
            step_executor: Step executor instance for processing
        """
        try:
            # Find the initial step in the flow
            initial_step = self._find_step_by_id(initial_step_id, flow)
            if not initial_step:
                logger.error(f"Initial step {initial_step_id} not found in flow {flow.flow_id}")
                return
            
            logger.debug(f"Routing entity {entity_id} from table {entity_table} to step {initial_step_id}")
            
            # Start processing the entity from the initial step
            self.env.process(
                step_executor.process_step(entity_id, initial_step_id, flow, entity_table, event_table)
            )
            
        except Exception as e:
            logger.error(f"Error routing entity {entity_id} from Create module: {e}", exc_info=True)
    
    def route_entity_to_next_step(self, entity_id: int, current_step_id: str, next_step_id: str,
                                 flow: 'EventFlow', entity_table: str, event_table: str, step_executor):
        """
        Route an entity from one step to the next step in a flow.
        
        Args:
            entity_id: Entity ID
            current_step_id: ID of the current step
            next_step_id: ID of the next step to route to
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
            step_executor: Step executor instance for processing
        """
        try:
            # Find the next step in the flow
            next_step = self._find_step_by_id(next_step_id, flow)
            if not next_step:
                logger.error(f"Next step {next_step_id} not found in flow {flow.flow_id}")
                return
            
            logger.debug(f"Routing entity {entity_id} from step {current_step_id} to step {next_step_id}")
            
            # Continue processing the entity at the next step
            self.env.process(
                step_executor.process_step(entity_id, next_step_id, flow, entity_table, event_table)
            )
            
        except Exception as e:
            logger.error(f"Error routing entity {entity_id} from step {current_step_id} to {next_step_id}: {e}", exc_info=True)
    
    def _find_step_by_id(self, step_id: str, flow: 'EventFlow') -> Optional['Step']:
        """
        Find a step by its ID within a flow
        
        Args:
            step_id: Step ID to find
            flow: Event flow to search in
            
        Returns:
            Step object or None if not found
        """
        for step in flow.steps:
            if step.step_id == step_id:
                return step
        return None