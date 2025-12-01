"""Set up simulation env, DB engine, managers, and termination system."""

import logging
import random
import numpy as np
import simpy
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from typing import Dict, Any

from ....config_parser import SimulationConfig, DatabaseConfig
from ...termination.formula import TerminationFormulaParser, TerminationFormulaEvaluator
from ...managers.resource_manager import ResourceManager
from ...managers.entity_manager import EntityManager
from ...managers.entity_attribute_manager import EntityAttributeManager
from ...managers.queue_manager import QueueManager
from ...processors import StepProcessorFactory

logger = logging.getLogger(__name__)


class SimulatorInitializer:
    """Builds all core simulation components."""

    def __init__(self, config: SimulationConfig, db_config: DatabaseConfig, db_path: str):
        """
        Store configs/paths and prepare holders for components.
        
        Args:
            config: Parsed simulation config.
            db_config: Parsed database config.
            db_path: Path to the SQLite database.
        """
        self.config = config
        self.db_config = db_config
        self.db_path = db_path
        
        # Core components - will be initialized
        self.env = None
        self.engine = None
        self.resource_manager = None
        self.entity_manager = None
        self.entity_attribute_manager = None
        self.queue_manager = None
        self.step_processor_factory = None
        
        # Tracking components
        self.processed_events = 0
        self.entities_processed = 0
        self.termination_reason = None
        
        # Termination system
        self.termination_parser = None
        self.termination_evaluator = None
        self.termination_condition = None
    
    def initialize_environment(self) -> simpy.Environment:
        """
        Create SimPy env.
        
        Returns:
            SimPy environment instance.
        """
        self.env = simpy.Environment()
        logger.debug("Initialized SimPy environment")
        return self.env
    
    def initialize_database_engine(self):
        """
        Create SQLAlchemy engine (WAL + NullPool for SQLite).
        
        Returns:
            SQLAlchemy engine.
        """
        self.engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool
        )
        logger.debug(f"Initialized database engine for: {self.db_path}")
        return self.engine
    
    def initialize_random_seed(self):
        """Set random seeds if config provides one."""
        if self.config.random_seed is not None:
            random.seed(self.config.random_seed)
            np.random.seed(self.config.random_seed)
            logger.debug(f"Set random seed to: {self.config.random_seed}")
    
    def initialize_termination_system(self):
        """Parse termination formula or fall back to long-running default."""
        self.termination_parser = TerminationFormulaParser()
        self.termination_evaluator = TerminationFormulaEvaluator()

        if self.config.terminating_conditions:
            try:
                formula = self.config.terminating_conditions.formula
                self.termination_condition = self.termination_parser.parse(formula)
                logger.info(f"Parsed termination formula: {formula}")
            except Exception as e:
                logger.error(f"Error parsing termination formula: {e}")
                # Fallback to default
                self.termination_condition = self.termination_parser.parse("TIME(999999)")
        else:
            # No termination conditions - use very long time
            self.termination_condition = self.termination_parser.parse("TIME(999999)")

    def initialize_queue_manager(self):
        """Build queue manager (queues optional)."""
        queue_definitions = []

        # Extract queue definitions from event_simulation config
        if (hasattr(self.config, 'event_simulation') and
            self.config.event_simulation and
            hasattr(self.config.event_simulation, 'queues')):
            queue_definitions = self.config.event_simulation.queues or []

        # Create QueueManager with database logging enabled
        self.queue_manager = QueueManager(
            self.env,
            queue_definitions,
            self.db_config,
            db_path=self.db_path,
            start_date=self.config.start_date
        )

        if queue_definitions:
            logger.info(f"Initialized QueueManager with {len(queue_definitions)} queue(s)")
        else:
            logger.debug("Initialized QueueManager with no queues (using default resource allocation)")
    
    def initialize_managers(self, flow_event_trackers: Dict):
        """
        Instantiate managers (queue, resource, entity, attributes).
        
        Args:
            flow_event_trackers: Flow-specific trackers to hand to managers.
        """
        # Initialize queue manager first (needed by resource manager)
        self.initialize_queue_manager()

        # Initialize resource manager
        self.resource_manager = ResourceManager(
            self.env, self.engine, self.db_path, self.db_config
        )

        # Initialize entity manager (using first flow's tracker for backward compatibility)
        event_tracker = next(iter(flow_event_trackers.values())) if flow_event_trackers else None
        self.entity_manager = EntityManager(
            self.env, self.engine, self.db_path, self.config, self.db_config, event_tracker
        )

        # Initialize entity attribute manager for Arena-style assign functionality
        self.entity_attribute_manager = EntityAttributeManager(self.entity_manager)

        logger.debug("Initialized all manager components")
    
    def initialize_step_processor_factory(self, simulator_ref):
        """
        Create step processor factory.
        
        Args:
            simulator_ref: Reference to main simulator for callbacks.
        """
        # Get the default event tracker for backward compatibility
        event_tracker = self.entity_manager.event_tracker if hasattr(self.entity_manager, 'event_tracker') else None

        self.step_processor_factory = StepProcessorFactory(
            self.env, self.engine, self.resource_manager, self.entity_manager,
            event_tracker, self.config, self.entity_attribute_manager, simulator_ref,
            self.queue_manager,  # Pass queue_manager to factory
            self.db_config  # Pass db_config for trigger processor
        )
        logger.debug("Initialized step processor factory")
    
    def get_initialization_state(self) -> Dict[str, Any]:
        """
        Get the current state of all initialized components.

        Returns:
            Dictionary containing all initialized components
        """
        return {
            'env': self.env,
            'engine': self.engine,
            'resource_manager': self.resource_manager,
            'entity_manager': self.entity_manager,
            'entity_attribute_manager': self.entity_attribute_manager,
            'queue_manager': self.queue_manager,
            'step_processor_factory': self.step_processor_factory,
            'processed_events': self.processed_events,
            'entities_processed': self.entities_processed,
            'termination_reason': self.termination_reason,
            'termination_parser': self.termination_parser,
            'termination_evaluator': self.termination_evaluator,
            'termination_condition': self.termination_condition
        }
