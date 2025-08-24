"""
Flow-specific EventTracker setup logic.

This module handles the initialization of flow-specific EventTracker instances
for each event flow in the simulation configuration.
"""

import logging
from typing import Dict, Optional

from ....config_parser import SimulationConfig, DatabaseConfig
from ...managers.event_tracker import EventTracker

logger = logging.getLogger(__name__)


class FlowEventTrackerSetup:
    """
    Handles the setup of flow-specific EventTracker instances.
    
    This class was extracted from the main EventSimulator to centralize
    the complex logic for creating and managing flow-specific trackers.
    """
    
    def __init__(self, db_path: str, config: SimulationConfig, db_config: DatabaseConfig):
        """
        Initialize the tracker setup handler.
        
        Args:
            db_path: Database path
            config: Simulation configuration
            db_config: Database configuration
        """
        self.db_path = db_path
        self.config = config
        self.db_config = db_config
    
    def initialize_flow_event_trackers(self) -> Dict[str, EventTracker]:
        """
        Initialize flow-specific EventTracker instances for each flow.
        
        Returns:
            Dictionary mapping flow_id to EventTracker instance
        """
        flow_trackers = {}
        
        if not self.config.event_simulation or not self.config.event_simulation.event_flows:
            logger.warning("No event flows found. Cannot create flow-specific EventTrackers.")
            return flow_trackers
        
        # Get resource table name (shared across flows)
        resource_table_name = self._get_resource_table_name()
        if not resource_table_name:
            logger.error("Could not determine resource table name. EventTrackers cannot be created.")
            return flow_trackers
        
        # Handle both new EventFlowsConfig structure and direct list structure  
        flows = self._get_flows_from_config()
        
        for flow in flows:
            flow_id = flow.flow_id
            event_table_name = flow.event_table
            
            if not event_table_name:
                logger.warning(f"Flow {flow_id} has no event_table specified. Skipping EventTracker creation.")
                continue
            
            # Find bridge table for this flow's event table
            bridge_table_config = self._find_bridge_table_for_flow(event_table_name, resource_table_name)
            
            if bridge_table_config:
                # Create EventTracker for this flow
                event_tracker = EventTracker(
                    self.db_path,
                    self.config.start_date,
                    event_table_name=event_table_name,
                    resource_table_name=resource_table_name,
                    bridge_table_config=bridge_table_config
                )
                flow_trackers[flow_id] = event_tracker
                logger.debug(f"Created EventTracker for flow {flow_id}: event_table={event_table_name}, bridge_table={bridge_table_config['name']}")
            else:
                logger.warning(f"Could not find bridge table for flow {flow_id} (event_table={event_table_name}). Resource tracking may not work.")
        
        logger.debug(f"Initialized {len(flow_trackers)} flow-specific EventTrackers")
        return flow_trackers
    
    def _get_resource_table_name(self) -> Optional[str]:
        """
        Get the resource table name from configuration.
        
        Returns:
            Resource table name or None if not found
        """
        if self.config.event_simulation.table_specification:
            return self.config.event_simulation.table_specification.resource_table
        elif self.db_config:
            # Find resource table from database config
            for entity in self.db_config.entities:
                if entity.type == 'resource':
                    return entity.name
        return None
    
    def _get_flows_from_config(self):
        """
        Get flows from configuration, handling both new and legacy structures.
        
        Returns:
            List of flows
        """
        return (self.config.event_simulation.event_flows.flows 
                if hasattr(self.config.event_simulation.event_flows, 'flows') 
                else self.config.event_simulation.event_flows)
    
    def _find_bridge_table_for_flow(self, event_table_name: str, resource_table_name: str) -> Optional[Dict]:
        """
        Find the bridge table configuration for a specific event table.
        
        Args:
            event_table_name: Name of the event table for this flow
            resource_table_name: Name of the resource table (shared)
            
        Returns:
            Bridge table configuration dict or None if not found
        """
        if not self.db_config:
            return None
        
        # Find a bridge table entity that has event_id and resource_id type attributes
        for entity in self.db_config.entities:
            event_fk_attr = None
            resource_fk_attr = None
            
            # Check if this entity has attributes with type 'event_id' and 'resource_id'
            for attr in entity.attributes:
                if attr.type == 'event_id' and attr.ref and attr.ref.startswith(f"{event_table_name}."):
                    event_fk_attr = attr
                elif attr.type == 'resource_id' and attr.ref and attr.ref.startswith(f"{resource_table_name}."):
                    resource_fk_attr = attr
            
            # If we found both attributes, this is the bridge table for this flow
            if event_fk_attr and resource_fk_attr:
                return {
                    'name': entity.name,
                    'event_fk_column': event_fk_attr.name,
                    'resource_fk_column': resource_fk_attr.name
                }
        
        return None