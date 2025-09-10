"""
Simulation attribute analysis for database generation.

This module analyzes simulation configurations to detect
flow-specific attribute assignments that need to be added
to database tables.
"""

import logging
from typing import Dict, Any, Optional

from sqlalchemy import Integer, String, Numeric

from ...config_parser import DatabaseConfig, SimulationConfig

logger = logging.getLogger(__name__)


class SimulationAttributeAnalyzer:
    """Analyzes simulation config for flow-specific attribute assignments."""
    
    def __init__(self, sim_config: Optional[SimulationConfig] = None, db_config: Optional[DatabaseConfig] = None):
        """
        Initialize the attribute analyzer.
        
        Args:
            sim_config: Simulation configuration to analyze
            db_config: Database configuration for context
        """
        self.sim_config = sim_config
        self.db_config = db_config
    
    def analyze_simulation_attributes(self) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """
        Analyze simulation config to detect flow-specific attribute assignments.
        
        Returns:
            Dictionary mapping: {flow_id: {entity_table: {attr_name: attr_type}}}
        """
        flow_attributes = {}
        
        if not self.sim_config or not self.sim_config.event_simulation:
            return flow_attributes
        
        event_flows = self.sim_config.event_simulation.event_flows
        if not event_flows:
            return flow_attributes
        
        logger.info("Analyzing simulation config for flow-specific attribute assignments...")
        
        # Handle both new EventFlowsConfig structure and direct list structure
        flows = event_flows.flows if hasattr(event_flows, 'flows') else event_flows
        if not flows:
            return flow_attributes
        
        # First, build a mapping of flows to their entity tables via Create modules
        flow_entity_mapping = {}  # {flow_id: [entity_table1, entity_table2, ...]}
        
        for flow in flows:
            flow_id = flow.flow_id
            flow_entity_mapping[flow_id] = []
            
            # Find Create modules in this flow to determine which entities it handles
            for step in flow.steps:
                if step.step_type == 'create' and step.create_config and step.create_config.entity_table:
                    entity_table = step.create_config.entity_table
                    if entity_table not in flow_entity_mapping[flow_id]:
                        flow_entity_mapping[flow_id].append(entity_table)
        
        # Now analyze assign modules and map them to the correct entity tables
        for flow in flows:
            flow_id = flow.flow_id
            entity_tables = flow_entity_mapping.get(flow_id, [])
            
            # Skip flows with no entity tables (no Create modules)
            if not entity_tables:
                logger.debug(f"Flow {flow_id} has no Create modules, skipping attribute analysis")
                continue
            
            flow_attributes[flow_id] = {}
            
            for step in flow.steps:
                if step.step_type == 'assign' and step.assign_config:
                    for assignment in step.assign_config.assignments:
                        if assignment.attribute_name and assignment.assignment_type in ('attribute', 'sql'):
                            attr_name = assignment.attribute_name
                            
                            # Infer column type
                            if assignment.assignment_type == 'sql':
                                # For SQL SELECT assignments, default to Numeric to support decimals
                                # (COUNT/SUM can be integers; Numeric handles both safely)
                                column_type = Numeric
                            else:
                                attr_value = assignment.value
                                if isinstance(attr_value, int):
                                    column_type = Integer
                                elif isinstance(attr_value, float):
                                    # Prefer Numeric to preserve decimals
                                    column_type = Numeric
                                elif isinstance(attr_value, str):
                                    # Try to detect if string represents a number
                                    try:
                                        int(attr_value)
                                        column_type = Integer
                                    except ValueError:
                                        try:
                                            float(attr_value)
                                            column_type = Numeric
                                        except ValueError:
                                            column_type = String
                                else:
                                    column_type = String
                            
                            # Add attribute to all entity tables in this flow
                            for entity_table in entity_tables:
                                if entity_table not in flow_attributes[flow_id]:
                                    flow_attributes[flow_id][entity_table] = {}
                                
                                # Store or merge the attribute
                                if attr_name in flow_attributes[flow_id][entity_table]:
                                    # Use most general type if types differ
                                    existing_type = flow_attributes[flow_id][entity_table][attr_name]
                                    if existing_type != column_type:
                                        flow_attributes[flow_id][entity_table][attr_name] = String
                                else:
                                    flow_attributes[flow_id][entity_table][attr_name] = column_type
                                
                                logger.debug(f"Assigned attribute to flow {flow_id}, entity {entity_table}: {attr_name} -> {column_type.__name__}")
        
        # Log summary
        total_attributes = 0
        for flow_id, entities in flow_attributes.items():
            for entity_table, attrs in entities.items():
                if attrs:
                    total_attributes += len(attrs)
                    logger.info(f"Flow {flow_id}, Entity {entity_table}: {len(attrs)} attributes {list(attrs.keys())}")
        
        if total_attributes > 0:
            logger.info(f"Found {total_attributes} total flow-specific attribute assignments")
        else:
            logger.info("No attribute assignments found in simulation config")
        
        return flow_attributes

    def get_entity_attribute_names_map(self, flow_attributes: Optional[Dict[str, Dict[str, Dict[str, Any]]]] = None) -> Dict[str, set]:
        """
        Build a mapping of entity table -> set of attribute names that are assigned in any flow.

        Args:
            flow_attributes: Optional precomputed flow attribute mapping from analyze_simulation_attributes().

        Returns:
            Dictionary mapping entity table name to a set of attribute names.
        """
        flow_attrs = flow_attributes if flow_attributes is not None else self.analyze_simulation_attributes()
        entity_to_attrs: Dict[str, set] = {}

        for _flow_id, entities in flow_attrs.items():
            for entity_table, attrs in entities.items():
                if entity_table not in entity_to_attrs:
                    entity_to_attrs[entity_table] = set()
                entity_to_attrs[entity_table].update(attrs.keys())

        return entity_to_attrs
