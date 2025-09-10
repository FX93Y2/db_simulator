"""
Refactored simulation engine for DB Simulator.

This module implements the event-based simulation functionality 
using SimPy to model resource allocation and scheduling.

This refactored version uses a modular architecture with separate
modules for initialization, execution, and lifecycle management.
"""

import logging
from typing import Dict, Any

from ...config_parser import SimulationConfig, DatabaseConfig
from .initialization import SimulatorInitializer, FlowEventTrackerSetup, ResourceInitializer
from .execution import FlowManager
from .lifecycle import TerminationMonitor, DatabaseCleanup, MetricsCollector

logger = logging.getLogger(__name__)


class EventSimulator:
    """
    Event-based simulator for processing entities through a sequence of events
    
    The simulator uses SimPy to model the discrete event simulation, where:
    - Entities (e.g., Projects, Patients) arrive according to a configured pattern
    - Events (e.g., Deliverables, Treatments) are processed in primary key order
    - Resources (e.g., Consultants, Doctors) are allocated to complete events
    
    This refactored version delegates responsibilities to specialized modules:
    - Initialization: SimulatorInitializer, FlowEventTrackerSetup, ResourceInitializer
    - Execution: FlowManager, StepExecutor, EntityRouter
    - Lifecycle: TerminationMonitor, DatabaseCleanup, MetricsCollector
    """
    
    def __init__(self, config: SimulationConfig, db_config: DatabaseConfig, db_path: str):
        """
        Initialize the simulator
        
        Args:
            config: Simulation configuration
            db_config: Database configuration (for generators)
            db_path: Path to the SQLite database
        """
        self.config = config
        self.db_config = db_config
        self.db_path = db_path
        
        # Initialize core components using modular architecture
        self.initializer = SimulatorInitializer(config, db_config, db_path)
        self.tracker_setup = FlowEventTrackerSetup(db_path, config, db_config)
        self.cleanup_handler = DatabaseCleanup(db_path)
        
        # Components that will be initialized during setup
        self.flow_manager = None
        self.termination_monitor = None
        self.metrics_collector = None
        self.resource_initializer = None
        self.flow_event_trackers = None
        
        # Set up all components
        self._initialize_all_components()
    
    def _initialize_all_components(self):
        """Initialize all simulation components using the modular architecture."""
        # Initialize core SimPy environment and database
        self.initializer.initialize_environment()
        self.initializer.initialize_database_engine()
        self.initializer.initialize_random_seed()
        self.initializer.initialize_termination_system()
        
        # Set up flow-specific event trackers
        self.flow_event_trackers = self.tracker_setup.initialize_flow_event_trackers()
        
        # Initialize managers with flow trackers
        self.initializer.initialize_managers(self.flow_event_trackers)
        
        # Initialize step processor factory with self reference
        self.initializer.initialize_step_processor_factory(self)
        
        # Initialize resource setup
        self.resource_initializer = ResourceInitializer(
            self.initializer.resource_manager, self.config
        )
        
        # Initialize execution components
        self.flow_manager = FlowManager(
            self.initializer.env, self.config, self.initializer.step_processor_factory,
            self.flow_event_trackers, self.initializer.entity_manager
        )
        
        # Initialize lifecycle components
        self.termination_monitor = TerminationMonitor(
            self.initializer.env, self.initializer, self
        )
        self.metrics_collector = MetricsCollector(
            self.config, self.initializer.env, self.initializer
        )
        
        logger.debug("All simulation components initialized successfully")
    
    def run(self) -> Dict[str, Any]:
        """
        Run the simulation
        
        Returns:
            Dictionary with simulation results
        """
        try:
            # Set random seed again to ensure consistency
            self.initializer.initialize_random_seed()
            
            # Setup resources using resource initializer
            self.resource_initializer.setup_resources()
            
            # Start entity generation processes using flow manager
            self.flow_manager.start_create_modules()
            
            # Log simulation start
            self.termination_monitor.log_simulation_start()
            
            # Start termination monitoring process and run until it finishes
            # This ensures the environment stops exactly when a termination
            # condition is met, rather than running until the event queue is empty.
            termination_event = self.termination_monitor.start_monitoring()
            
            # Run simulation until the termination monitor process exits
            self.initializer.env.run(until=termination_event)
            
            # Clean up any remaining allocated resources
            self._cleanup_remaining_resources()
            
            logger.debug(f"Simulation completed. Processed {self.initializer.processed_events} events for {self.initializer.entity_manager.entity_count} entities")
            
            # Collect and return final results
            return self.metrics_collector.collect_final_results(
                self.termination_monitor.get_termination_reason()
            )
            
        finally:
            # ALWAYS clean up database connections to prevent EBUSY errors on Windows
            self._cleanup_database_connections()
    
    def _cleanup_remaining_resources(self):
        """Clean up any remaining allocated resources."""
        if hasattr(self.initializer.resource_manager, 'event_allocations'):
            remaining_allocations = list(self.initializer.resource_manager.event_allocations.keys())
            if remaining_allocations:
                logger.info(f"Cleaning up {len(remaining_allocations)} remaining resource allocations")
                for event_id in remaining_allocations:
                    try:
                        self.initializer.resource_manager.release_resources(event_id)
                    except Exception as e:
                        logger.debug(f"Error releasing resources for event {event_id}: {e}")
    
    def _cleanup_database_connections(self):
        """Clean up all database connections using the cleanup handler."""
        self.cleanup_handler.cleanup_database_connections(
            self.initializer.engine,
            self.initializer.entity_manager.event_tracker if hasattr(self.initializer.entity_manager, 'event_tracker') else None,
            self.initializer.entity_attribute_manager,
            self.initializer.resource_manager
        )
    
    # Delegation methods for backward compatibility and processor access
    def _find_step_by_id(self, step_id: str, flow):
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
    
    def _check_termination_conditions(self):
        """
        Check if termination condition is met.
        
        Returns:
            Tuple of (should_terminate, reason)
        """
        return self.termination_monitor._check_termination_conditions()
    
    def increment_entities_processed(self):
        """Increment the processed entities counter for termination tracking."""
        self.initializer.entities_processed += 1
    
    def increment_events_processed(self):
        """Increment the processed events counter for termination tracking."""
        self.initializer.processed_events += 1
    
    def _count_entities_in_table(self, table_name: str) -> int:
        """
        Count the number of entities in a specific table.
        
        Args:
            table_name: Name of the entity table
            
        Returns:
            Number of entities in the table
        """
        try:
            from sqlalchemy import text
            with self.initializer.engine.connect() as conn:
                sql_query = text(f'SELECT COUNT(*) FROM "{table_name}"')
                result = conn.execute(sql_query).fetchone()
                return result[0] if result else 0
        except Exception as e:
            logger.error(f"Error counting entities in table '{table_name}': {e}")
            return 0
    
    # Properties for backward compatibility
    @property
    def env(self):
        """SimPy environment."""
        return self.initializer.env
    
    @property
    def engine(self):
        """SQLAlchemy engine."""
        return self.initializer.engine
    
    @property
    def resource_manager(self):
        """Resource manager."""
        return self.initializer.resource_manager
    
    @property
    def entity_manager(self):
        """Entity manager."""
        return self.initializer.entity_manager
    
    @property
    def entity_attribute_manager(self):
        """Entity attribute manager."""
        return self.initializer.entity_attribute_manager
    
    @property
    def step_processor_factory(self):
        """Step processor factory."""
        return self.initializer.step_processor_factory
    
    @property
    def event_tracker(self):
        """Default event tracker (first flow's tracker for backward compatibility)."""
        return next(iter(self.flow_event_trackers.values())) if self.flow_event_trackers else None
    
    @property
    def processed_events(self):
        """Number of processed events."""
        return self.initializer.processed_events
    
    @property
    def entities_processed(self):
        """Number of processed entities."""
        return self.initializer.entities_processed
    
    @property
    def termination_reason(self):
        """Reason for termination."""
        return self.termination_monitor.get_termination_reason() if self.termination_monitor else None
