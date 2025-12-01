"""Manage flow entry points and start entity creation processes."""

import logging
from typing import List, Dict, Optional, TYPE_CHECKING
import simpy

if TYPE_CHECKING:
    from ....config_parser import EventFlow, Step, SimulationConfig

logger = logging.getLogger(__name__)


class FlowManager:
    """Finds flow entry points (Create) and starts their processes."""
    
    def __init__(self, env: simpy.Environment, config: 'SimulationConfig', 
                 step_processor_factory, flow_event_trackers: Dict, entity_manager):
        """
        Args:
            env: SimPy environment.
            config: Simulation configuration.
            step_processor_factory: Factory for step processors.
            flow_event_trackers: Flow-specific trackers.
            entity_manager: Entity manager instance.
        """
        self.env = env
        self.config = config
        self.step_processor_factory = step_processor_factory
        self.flow_event_trackers = flow_event_trackers
        self.entity_manager = entity_manager
    
    def start_create_modules(self):
        """
        Find Create steps in flows and start them as SimPy processes.
        """
        event_sim = self.config.event_simulation
        if not event_sim or not event_sim.event_flows or not event_sim.event_flows.flows:
            logger.warning("No event flows found. No entities will be created.")
            return
        
        create_modules_started = 0
        total_entry_points = 0
        
        # Scan all flows for entry point modules
        for flow in event_sim.event_flows.flows:
            logger.debug(f"Scanning flow {flow.flow_id} for entry point modules")
            
            # Find entry points for this flow
            entry_points = self._find_flow_entry_points(flow)
            total_entry_points += len(entry_points)
            
            if not entry_points:
                logger.warning(f"Flow {flow.flow_id} has no entry point modules. No entities will be created for this flow.")
                continue
            elif len(entry_points) > 1:
                logger.warning(f"Flow {flow.flow_id} has multiple entry points: {entry_points}. All will be started.")
            
            # Start each entry point module
            for step in flow.steps:
                if step.step_type == 'create' and step.create_config:
                    logger.debug(f"Starting Create module: {step.step_id} (table: {step.create_config.entity_table})")
                    
                    # Start the Create module as a SimPy process
                    self.env.process(self._run_create_module(step, flow))
                    create_modules_started += 1
                # Future: Add support for other entry point types like 'batch'
        
        if total_entry_points == 0:
            logger.warning("No entry point modules found in event flows. No entities will be created.")
        else:
            logger.debug(f"Found {total_entry_points} entry point(s), started {create_modules_started} Create module(s)")
    
    def _find_flow_entry_points(self, flow: 'EventFlow') -> List[str]:
        """
        Find steps that can start entity processing (currently create/batch).
        
        Args:
            flow: Event flow to analyze.
            
        Returns:
            List of step IDs that are entry points.
        """
        entry_points = []
        entry_point_types = ['create', 'batch']  # Extensible for future module types
        
        for step in flow.steps:
            if step.step_type in entry_point_types:
                entry_points.append(step.step_id)
                logger.debug(f"Identified entry point: {step.step_id} (type: {step.step_type})")
        
        return entry_points
    
    def _run_create_module(self, create_step: 'Step', flow: 'EventFlow'):
        """
        Run a Create module as a SimPy process.
        
        Args:
            create_step: The Create step configuration.
            flow: The event flow containing this Create step.
        """
        try:
            # Get flow-specific tables
            entity_table = create_step.create_config.entity_table
            event_table = flow.event_table
            _, _, resource_table = self.entity_manager.get_table_names()  # Still need resource table
            
            logger.debug(f"Create module {create_step.step_id} using flow-specific tables: entity={entity_table}, event={event_table}, flow={flow.flow_id}")
            
            # Get the Create step processor and set up entity routing callback
            create_processor = self.step_processor_factory.get_processor('create')
            if create_processor:
                # Set the entity routing callback so Create processor can route entities properly
                create_processor.entity_router_callback = self._route_entity_from_create
            
            # Get flow-specific EventTracker
            flow_event_tracker = self.flow_event_trackers.get(flow.flow_id)
            
            # Process the Create step using the step processor factory
            step_generator = self.step_processor_factory.process_step(
                0,  # entity_id not used for Create steps
                create_step, 
                flow, 
                entity_table,  # Use the specific entity table from Create config
                event_table,  # Use the flow-specific event table
                flow_event_tracker  # Use the flow-specific EventTracker
            )
            
            # Run the Create step generator
            yield from step_generator
            
        except Exception as e:
            logger.error(f"Error running Create module {create_step.step_id}: {e}", exc_info=True)
    
    def _route_entity_from_create(self, entity_id: int, initial_step_id: str, flow: 'EventFlow', 
                                entity_table: str, event_table: str):
        """
        Callback method for Create processors to route entities to their initial steps.
        
        Args:
            entity_id: ID of the created entity.
            initial_step_id: ID of the initial step to route to.
            flow: Event flow configuration.
            entity_table: Name of the entity table.
            event_table: Name of the event table.
        """
        try:
            # Find the initial step in the flow
            initial_step = self._find_step_by_id(initial_step_id, flow)
            if not initial_step:
                logger.error(f"Initial step {initial_step_id} not found in flow {flow.flow_id}")
                return
            
            logger.debug(f"Routing entity {entity_id} from table {entity_table} to step {initial_step_id}")
            
            # Import StepExecutor here to avoid circular import
            from .step_executor import StepExecutor
            step_executor = StepExecutor(
                self.env, self.step_processor_factory, self.flow_event_trackers
            )
            
            # Start processing the entity from the initial step
            self.env.process(
                step_executor.process_step(entity_id, initial_step_id, flow, entity_table, event_table)
            )
            
        except Exception as e:
            logger.error(f"Error routing entity {entity_id} from Create module: {e}", exc_info=True)
    
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
