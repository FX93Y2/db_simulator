"""
Metrics collection and results generation for the simulation engine.

This module handles the collection of simulation metrics and
generation of final results for the simulation run.
"""

import logging
from typing import Dict, Any, Optional, TYPE_CHECKING
from datetime import timedelta

if TYPE_CHECKING:
    from ....config_parser import SimulationConfig
    from ....utils.time_units import TimeUnit

logger = logging.getLogger(__name__)


class MetricsCollector:
    """
    Collects simulation metrics and generates results.
    
    This class handles the collection of various simulation metrics
    including resource utilization, entity statistics, and timing data.
    """
    
    def __init__(self, config: 'SimulationConfig', env, initializer):
        """
        Initialize the metrics collector.
        
        Args:
            config: Simulation configuration
            env: SimPy environment
            initializer: Simulator initializer with tracking data
        """
        self.config = config
        self.env = env
        self.initializer = initializer
    
    def collect_final_results(self, termination_reason: Optional[str] = None) -> Dict[str, Any]:
        """
        Collect final simulation results and metrics.
        
        Args:
            termination_reason: Reason for simulation termination
            
        Returns:
            Dictionary containing all simulation results
        """
        try:
            # Import here to avoid circular imports
            from ....utils.time_units import TimeUnitConverter
            
            # Get final resource utilization stats
            resource_stats = {}
            if hasattr(self.initializer, 'resource_manager') and self.initializer.resource_manager:
                resource_stats = self.initializer.resource_manager.get_utilization_stats()
            
            # Get entity attribute statistics
            attribute_stats = {}
            if hasattr(self.initializer, 'entity_attribute_manager') and self.initializer.entity_attribute_manager:
                attribute_stats = self.initializer.entity_attribute_manager.get_statistics()

            # Get queue statistics
            queue_stats = {}
            if hasattr(self.initializer, 'queue_manager') and self.initializer.queue_manager:
                queue_stats = self.initializer.queue_manager.get_statistics()

            # Get entity count
            entity_count = 0
            if hasattr(self.initializer, 'entity_manager') and self.initializer.entity_manager:
                entity_count = self.initializer.entity_manager.entity_count
            
            # Collect timing and termination data
            results = {
                'simulation_time_minutes': self.env.now,
                'simulation_time_base_units': TimeUnitConverter.from_minutes(self.env.now, self.config.base_time_unit),
                'base_time_unit': self.config.base_time_unit,
                'termination_reason': termination_reason or self.initializer.termination_reason,
                'entity_count': entity_count,
                'entities_processed': self.initializer.entities_processed,
                'processed_events': self.initializer.processed_events,
                'resource_utilization': resource_stats,
                'entity_attributes': attribute_stats,
                'queue_statistics': queue_stats,  # Add queue statistics
                # Legacy field for backward compatibility
                'duration_days': getattr(self.config, 'duration_days', None)
            }
            
            logger.debug(f"Collected final results: processed {self.initializer.processed_events} events for {entity_count} entities")
            return results
            
        except Exception as e:
            logger.error(f"Error collecting final results: {e}")
            # Return basic results on error
            return {
                'simulation_time_minutes': self.env.now if hasattr(self, 'env') else 0,
                'entity_count': 0,
                'entities_processed': 0,
                'processed_events': 0,
                'error': str(e)
            }
    
    def get_resource_utilization(self) -> Dict[str, Any]:
        """
        Get current resource utilization statistics.
        
        Returns:
            Dictionary containing resource utilization data
        """
        try:
            if hasattr(self.initializer, 'resource_manager') and self.initializer.resource_manager:
                return self.initializer.resource_manager.get_utilization_stats()
            return {}
        except Exception as e:
            logger.error(f"Error getting resource utilization: {e}")
            return {}
    
    def get_entity_statistics(self) -> Dict[str, Any]:
        """
        Get current entity attribute statistics.

        Returns:
            Dictionary containing entity attribute statistics
        """
        try:
            if hasattr(self.initializer, 'entity_attribute_manager') and self.initializer.entity_attribute_manager:
                return self.initializer.entity_attribute_manager.get_statistics()
            return {}
        except Exception as e:
            logger.error(f"Error getting entity statistics: {e}")
            return {}

    def get_queue_statistics(self) -> Dict[str, Any]:
        """
        Get current queue statistics.

        Returns:
            Dictionary containing queue statistics
        """
        try:
            if hasattr(self.initializer, 'queue_manager') and self.initializer.queue_manager:
                return self.initializer.queue_manager.get_statistics()
            return {}
        except Exception as e:
            logger.error(f"Error getting queue statistics: {e}")
            return {}

    def log_simulation_progress(self):
        """Log current simulation progress."""
        try:
            entity_count = 0
            if hasattr(self.initializer, 'entity_manager') and self.initializer.entity_manager:
                entity_count = self.initializer.entity_manager.entity_count
            
            logger.debug(f"Simulation progress: {self.env.now:.1f} minutes, "
                        f"{entity_count} entities, "
                        f"{self.initializer.processed_events} events processed")
        except Exception as e:
            logger.debug(f"Error logging progress: {e}")