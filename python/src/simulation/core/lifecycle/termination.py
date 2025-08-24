"""
Termination monitoring logic for the simulation engine.

This module handles the monitoring of termination conditions and
graceful shutdown of the simulation when conditions are met.
"""

import logging
from typing import Tuple, Optional, TYPE_CHECKING
import simpy

if TYPE_CHECKING:
    from ..initialization.config_loader import SimulatorInitializer

logger = logging.getLogger(__name__)


class TerminationMonitor:
    """
    Monitors termination conditions and manages simulation shutdown.
    
    This class runs as a separate SimPy process to continuously monitor
    termination conditions and gracefully shut down the simulation when
    conditions are met.
    """
    
    def __init__(self, env: simpy.Environment, initializer: 'SimulatorInitializer', simulator_ref):
        """
        Initialize the termination monitor.
        
        Args:
            env: SimPy environment
            initializer: Simulator initializer containing termination system
            simulator_ref: Reference to main simulator for condition checking
        """
        self.env = env
        self.initializer = initializer
        self.simulator_ref = simulator_ref
        self.termination_reason = None
    
    def start_monitoring(self):
        """
        Start the termination monitoring process.
        
        Returns:
            SimPy process for termination monitoring
        """
        return self.env.process(self._monitor_termination_conditions())
    
    def _monitor_termination_conditions(self):
        """
        Monitor termination conditions and stop simulation when any condition is met.
        
        This runs as a SimPy process and checks termination conditions periodically.
        """
        # Check every simulated minute
        check_interval = 1.0
        
        while True:
            try:
                # Wait for check interval
                yield self.env.timeout(check_interval)
                
                # Check termination conditions
                should_terminate, reason = self._check_termination_conditions()
                
                if should_terminate:
                    self.termination_reason = reason
                    logger.info(f"Termination condition met: {reason}")
                    break
                    
            except simpy.Interrupt:
                logger.debug("Termination monitor interrupted")
                break
        
        # Stop all processes by interrupting the environment
        # This will cause the run() method to exit
        logger.debug("Stopping simulation due to termination condition")
    
    def _check_termination_conditions(self) -> Tuple[bool, Optional[str]]:
        """
        Check if termination condition is met using formula evaluator.
        
        Returns:
            Tuple of (should_terminate, reason)
        """
        if not self.initializer.termination_condition:
            return False, None
        
        return self.initializer.termination_evaluator.evaluate(
            self.initializer.termination_condition, self.simulator_ref
        )
    
    def log_simulation_start(self):
        """Log simulation start with termination conditions."""
        if self.initializer.config.terminating_conditions:
            formula = self.initializer.config.terminating_conditions.formula
            logger.info(f"Starting simulation with termination formula: {formula}")
        else:
            logger.info("Starting simulation with default termination conditions")
    
    def get_termination_reason(self) -> Optional[str]:
        """
        Get the reason for termination.
        
        Returns:
            Termination reason string or None if not terminated
        """
        return self.termination_reason