"""
Patch for simulator to handle graceful shutdown and resource cleanup
"""

import logging
from typing import Dict, Any, Optional
import simpy

logger = logging.getLogger(__name__)


class SimulatorShutdownMixin:
    """
    Mixin to add graceful shutdown capabilities to the simulator
    """
    
    def __init__(self):
        self._shutdown_requested = False
        self._active_processes = set()
    
    def request_shutdown(self):
        """Request a graceful shutdown of the simulation"""
        self._shutdown_requested = True
        logger.info("Shutdown requested for simulation")
    
    def register_process(self, process_id: Any):
        """Register an active process"""
        self._active_processes.add(process_id)
    
    def unregister_process(self, process_id: Any):
        """Unregister a completed process"""
        self._active_processes.discard(process_id)
    
    def is_shutdown_requested(self) -> bool:
        """Check if shutdown has been requested"""
        return self._shutdown_requested
    
    def wait_for_processes(self, timeout: float = 5.0):
        """Wait for active processes to complete"""
        if self._active_processes:
            logger.info(f"Waiting for {len(self._active_processes)} active processes to complete")
            # In a real implementation, this would wait with a timeout
            # For now, we'll just log
            logger.info("Active processes cleared")
            self._active_processes.clear()


def safe_database_operation(func):
    """
    Decorator to safely handle database operations that might fail during shutdown
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            if "closed database" in str(e).lower() or "generatorexit" in str(e).lower():
                logger.debug(f"Database operation skipped during shutdown: {func.__name__}")
                return None
            else:
                # Re-raise other exceptions
                raise
    return wrapper


class SafeEventTracker:
    """
    Wrapper for EventTracker that handles database errors during shutdown
    """
    
    def __init__(self, event_tracker):
        self._tracker = event_tracker
        self._shutdown = False
    
    def set_shutdown(self, shutdown: bool = True):
        """Mark that we're in shutdown mode"""
        self._shutdown = shutdown
    
    @safe_database_operation
    def record_resource_allocation(self, *args, **kwargs):
        """Safe wrapper for record_resource_allocation"""
        if self._shutdown:
            logger.debug("Skipping resource allocation recording during shutdown")
            return
        return self._tracker.record_resource_allocation(*args, **kwargs)
    
    def __getattr__(self, name):
        """Delegate other methods to the wrapped tracker"""
        return getattr(self._tracker, name)