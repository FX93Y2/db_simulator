"""Set up simulation resources via the resource manager."""

import logging
from typing import Dict, Any

from ....config_parser import SimulationConfig

logger = logging.getLogger(__name__)


class ResourceInitializer:
    """Sets up resources and exposes basic status."""

    def __init__(self, resource_manager, config: SimulationConfig):
        """
        Args:
            resource_manager: Resource manager instance.
            config: Simulation configuration.
        """
        self.resource_manager = resource_manager
        self.config = config
    
    def setup_resources(self):
        """
        Setup resources for the simulation.
        
        This method initializes all resources defined in the simulation
        configuration and prepares them for allocation.
        """
        if not self.config.event_simulation:
            logger.warning("No event simulation configuration found")
            return
            
        self.resource_manager.setup_resources(self.config.event_simulation)
        logger.debug("Resources setup completed")
    
    def get_resource_status(self) -> Dict[str, Any]:
        """
        Get the current status of all resources.
        
        Returns:
            Dictionary containing resource status information.
        """
        try:
            return self.resource_manager.get_utilization_stats()
        except Exception as e:
            logger.error(f"Error getting resource status: {e}")
            return {}
