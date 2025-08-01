"""
Simulation configuration parser
"""

import yaml
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime, time

from .db_parser import DatabaseConfig, Entity, Attribute

logger = logging.getLogger(__name__)

@dataclass
class ResourceRequirement:
    resource_table: str
    value: str  # Corresponds to the value in the resource_type column
    count: int  # Number of resources required
    capacity_per_resource: int = 1  # Capacity needed per resource

@dataclass
class CapacityRule:
    """Defines capacity assignment rules for specific resource types"""
    resource_type: str
    capacity: Union[int, Dict[str, Any]]  # Fixed int or distribution config

@dataclass
class ResourceCapacityConfig:
    """Configuration for resource capacities for a specific resource table"""
    capacity_rules: List[CapacityRule] = field(default_factory=list)
    default_capacity: int = 1
    capacity_formula: Optional[str] = None  # For formula-based capacity calculation
    min_capacity: int = 1
    max_capacity: int = 100  # More reasonable default maximum

@dataclass
class TableSpecification:
    entity_table: str
    event_table: str
    resource_table: str

@dataclass
class EntityArrival:
    interarrival_time: Dict
    max_entities: Optional[Any] = None  # Can be int or 'n/a'
    override_db_config: bool = True

@dataclass
class ShiftPattern:
    name: str
    days: List[int]  # 0=Monday, 6=Sunday
    start_time: str
    end_time: str

@dataclass
class ResourceShift:
    resource_type: str
    shift_pattern: Union[str, List[str]]  # Name of shift pattern or list of names

@dataclass
class WorkShifts:
    enabled: bool
    shift_patterns: List[ShiftPattern]
    resource_shifts: List[ResourceShift]


# New event flow dataclasses
@dataclass
class Condition:
    # Clean new format: if name is value
    if_: Optional[str] = field(default=None, metadata={'yaml_key': 'if'})  # "Attribute", "Variable" (future), etc.
    name: Optional[str] = None     # attribute/variable name
    is_: Optional[str] = field(default=None, metadata={'yaml_key': 'is'})  # "==", "!=", ">", ">=", "<", "<=", "<>"
    value: Optional[Union[str, int, float]] = None

@dataclass
class Outcome:
    outcome_id: str
    next_step_id: str
    conditions: List[Condition] = field(default_factory=list)

@dataclass
class DecideConfig:
    module_id: str
    decision_type: str
    outcomes: List[Outcome] = field(default_factory=list)

# Arena-style Assignment module dataclasses
@dataclass
class AssignmentOperation:
    assignment_type: str  # "attribute", future: "variable", "variable_array"
    # Attribute-specific fields
    attribute_name: Optional[str] = None
    value: Optional[Union[str, int, float]] = None

@dataclass
class AssignConfig:
    module_id: str
    assignments: List[AssignmentOperation] = field(default_factory=list)

@dataclass
class EventStepConfig:
    name: str
    duration: Dict
    resource_requirements: List[ResourceRequirement] = field(default_factory=list)

@dataclass
class Step:
    step_id: str
    step_type: str  # 'event', 'decide', 'release', 'assign'
    event_config: Optional[EventStepConfig] = None
    decide_config: Optional[DecideConfig] = None
    assign_config: Optional[AssignConfig] = None
    next_steps: List[str] = field(default_factory=list)

@dataclass
class EventFlow:
    flow_id: str
    initial_step: str
    steps: List[Step] = field(default_factory=list)

@dataclass
class EventFlowsConfig:
    flows: List[EventFlow] = field(default_factory=list)

@dataclass
class EventSimulation:
    table_specification: TableSpecification
    entity_arrival: Optional[EntityArrival] = None
    work_shifts: Optional[WorkShifts] = None
    event_flows: Optional[EventFlowsConfig] = None
    resource_capacities: Optional[Dict[str, ResourceCapacityConfig]] = None

def find_table_by_type(db_config: DatabaseConfig, table_type: str) -> Optional[str]:
    """
    Find a table with the specified type in the database configuration.
    
    Args:
        db_config: The database configuration
        table_type: The type of table to find (entity, event, resource)
        
    Returns:
        The name of the table or None if not found
    """
    if not db_config:
        return None
        
    for entity in db_config.entities:
        if entity.type == table_type:
            return entity.name
            
    return None

@dataclass
class SimulationConfig:
    duration_days: int
    start_date: Optional[datetime] = None
    random_seed: Optional[int] = None
    event_simulation: Optional[EventSimulation] = None


def find_event_type_column(db_config: DatabaseConfig, event_table: str) -> Optional[str]:
    """
    Find the event_type column in the event table.
    
    Args:
        db_config: The database configuration
        event_table: Name of the event table
        
    Returns:
        Name of the event_type column or None if not found
    """
    event_entity = next((e for e in db_config.entities if e.name == event_table), None)
    
    if not event_entity:
        logger.warning(f"Could not find event table '{event_table}' in database config")
        return None
    
    # Find column with type 'event_type'
    event_type_col = next((attr.name for attr in event_entity.attributes if attr.type == 'event_type'), None)
    
    if not event_type_col:
        logger.warning(f"Event table '{event_table}' has no column with type 'event_type'")
    
    return event_type_col

def find_resource_type_column(db_config: DatabaseConfig, resource_table: str) -> Optional[str]:
    """
    Find the resource_type column in the resource table.
    
    Args:
        db_config: The database configuration
        resource_table: Name of the resource table
        
    Returns:
        Name of the resource_type column or None if not found
    """
    resource_entity = next((e for e in db_config.entities if e.name == resource_table), None)
    
    if not resource_entity:
        logger.warning(f"Could not find resource table '{resource_table}' in database config")
        return None
    
    # Find column with type 'resource_type'
    resource_type_col = next((attr.name for attr in resource_entity.attributes if attr.type == 'resource_type'), None)
    
    if not resource_type_col:
        logger.warning(f"Resource table '{resource_table}' has no column with type 'resource_type'")
    
    return resource_type_col



def parse_sim_config(file_path: Union[str, Path], db_config: Optional[DatabaseConfig] = None) -> SimulationConfig:
    if isinstance(file_path, str):
        file_path = Path(file_path)
        
    if not file_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {file_path}")
    
    with open(file_path, 'r') as f:
        config_dict = yaml.safe_load(f)
    
    sim_dict = config_dict.get('simulation', {})
    
    start_date = None
    if 'start_date' in sim_dict:
        date_str = str(sim_dict['start_date'])
        try:
            if len(date_str) == 10:
                start_date = datetime.strptime(date_str, '%Y-%m-%d')
            else:
                start_date = datetime.fromisoformat(date_str)
        except (ValueError, TypeError):
            logger.warning(f"Failed to parse start_date: {date_str}")
            start_date = datetime.now()
    
    event_simulation = None
    if 'event_simulation' in config_dict:
        event_dict = config_dict['event_simulation']
        
        # Parse table specification
        table_spec = None
        if 'table_specification' in event_dict:
            # Use the table specification from the simulation config
            table_dict = event_dict['table_specification']
            table_spec = TableSpecification(
                entity_table=table_dict.get('entity_table', ''),
                event_table=table_dict.get('event_table', ''),
                resource_table=table_dict.get('resource_table', '')
            )
        elif db_config:
            # Derive table specification from database config based on table types
            entity_table = find_table_by_type(db_config, 'entity')
            event_table = find_table_by_type(db_config, 'event')
            resource_table = find_table_by_type(db_config, 'resource')
            
            if entity_table and event_table and resource_table:
                table_spec = TableSpecification(
                    entity_table=entity_table,
                    event_table=event_table,
                    resource_table=resource_table
                )
                logger.info(f"Derived table specification from database config: entity={entity_table}, event={event_table}, resource={resource_table}")
        
        # Parse entity arrival configuration
        entity_arrival = None
        if 'entity_arrival' in event_dict:
            arrival_dict = event_dict['entity_arrival']
            entity_arrival = EntityArrival(
                interarrival_time=arrival_dict.get('interarrival_time', {}),
                max_entities=arrival_dict.get('max_entities'),
                override_db_config=arrival_dict.get('override_db_config', True)
            )
        
        # Parse work shifts configuration
        work_shifts = None
        if 'work_shifts' in event_dict:
            shifts_dict = event_dict['work_shifts']
            
            # Parse shift patterns
            shift_patterns = []
            for pattern_dict in shifts_dict.get('shift_patterns', []):
                shift_patterns.append(ShiftPattern(
                    name=pattern_dict.get('name', ''),
                    days=pattern_dict.get('days', []),
                    start_time=pattern_dict.get('start_time', '09:00'),
                    end_time=pattern_dict.get('end_time', '17:00')
                ))
            
            # Parse resource shifts
            resource_shifts = []
            for shift_dict in shifts_dict.get('resource_shifts', []):
                resource_shifts.append(ResourceShift(
                    resource_type=shift_dict.get('resource_type', ''),
                    shift_pattern=shift_dict.get('shift_pattern') or shift_dict.get('shift_patterns', [])
                ))
            
            work_shifts = WorkShifts(
                enabled=shifts_dict.get('enabled', False),
                shift_patterns=shift_patterns,
                resource_shifts=resource_shifts
            )
        
        
        # Parse event flows configuration
        event_flows = None
        if 'event_flows' in event_dict:
            flows = []
            for flow_dict in event_dict['event_flows']:
                steps = []
                for step_dict in flow_dict.get('steps', []):
                    # Parse step configuration
                    event_config = None
                    decide_config = None
                    
                    if step_dict.get('step_type') == 'event' and 'event_config' in step_dict:
                        ec_dict = step_dict['event_config']
                        # Parse resource requirements for this step
                        resource_reqs = []
                        for req_dict in ec_dict.get('resource_requirements', []):
                            resource_reqs.append(ResourceRequirement(
                                resource_table=req_dict.get('resource_table', ''),
                                value=req_dict.get('value', ''),
                                count=req_dict.get('count', 1),
                                capacity_per_resource=req_dict.get('capacity_per_resource', 1)
                            ))
                        
                        event_config = EventStepConfig(
                            name=ec_dict.get('name', ''),
                            duration=ec_dict.get('duration', {}),
                            resource_requirements=resource_reqs
                        )
                    
                    elif step_dict.get('step_type') == 'decide' and 'decide_config' in step_dict:
                        dc_dict = step_dict['decide_config']
                        outcomes = []
                        for outcome_dict in dc_dict.get('outcomes', []):
                            conditions = []
                            for condition_dict in outcome_dict.get('conditions', []):
                                conditions.append(Condition(
                                    if_=condition_dict.get('if'),
                                    name=condition_dict.get('name'),
                                    is_=condition_dict.get('is'),
                                    value=condition_dict.get('value')
                                ))
                            
                            outcomes.append(Outcome(
                                outcome_id=outcome_dict.get('outcome_id', ''),
                                next_step_id=outcome_dict.get('next_step_id', ''),
                                conditions=conditions
                            ))
                        
                        decide_config = DecideConfig(
                            module_id=dc_dict.get('module_id', ''),
                            decision_type=dc_dict.get('decision_type', ''),
                            outcomes=outcomes
                        )
                    
                    # Parse assign config if present
                    assign_config = None
                    if 'assign_config' in step_dict:
                        assign_dict = step_dict['assign_config']
                        assignments = []
                        if 'assignments' in assign_dict:
                            for assignment_dict in assign_dict['assignments']:
                                assignments.append(AssignmentOperation(
                                    assignment_type=assignment_dict.get('assignment_type', ''),
                                    attribute_name=assignment_dict.get('attribute_name'),
                                    value=assignment_dict.get('value')
                                ))
                        assign_config = AssignConfig(
                            module_id=assign_dict.get('module_id', ''),
                            assignments=assignments
                        )
                    
                    steps.append(Step(
                        step_id=step_dict.get('step_id', ''),
                        step_type=step_dict.get('step_type', ''),
                        event_config=event_config,
                        decide_config=decide_config,
                        assign_config=assign_config,
                        next_steps=step_dict.get('next_steps', [])
                    ))
                
                flows.append(EventFlow(
                    flow_id=flow_dict.get('flow_id', ''),
                    initial_step=flow_dict.get('initial_step', ''),
                    steps=steps
                ))
            
            event_flows = EventFlowsConfig(flows=flows)
        
        # Parse resource capacities configuration
        resource_capacities = None
        if 'resource_capacities' in event_dict:
            resource_capacities = {}
            for table_name, capacity_config_dict in event_dict['resource_capacities'].items():
                # Parse capacity rules
                capacity_rules = []
                for rule_dict in capacity_config_dict.get('capacity_rules', []):
                    capacity_rules.append(CapacityRule(
                        resource_type=rule_dict.get('resource_type', ''),
                        capacity=rule_dict.get('capacity', 1)
                    ))
                
                resource_capacities[table_name] = ResourceCapacityConfig(
                    capacity_rules=capacity_rules,
                    default_capacity=capacity_config_dict.get('default_capacity', 1),
                    capacity_formula=capacity_config_dict.get('capacity_formula'),
                    min_capacity=capacity_config_dict.get('min_capacity', 1),
                    max_capacity=capacity_config_dict.get('max_capacity', 100)  # More reasonable default
                )
        
        event_simulation = EventSimulation(
            table_specification=table_spec,
            entity_arrival=entity_arrival,
            work_shifts=work_shifts,
            event_flows=event_flows,
            resource_capacities=resource_capacities
        )
    
    return SimulationConfig(
        duration_days=sim_dict.get('duration_days', 0),
        start_date=start_date,
        random_seed=sim_dict.get('random_seed'),
        event_simulation=event_simulation
    )

def parse_sim_config_from_string(config_content: str, db_config: Optional[DatabaseConfig] = None) -> SimulationConfig:
    """
    Parse simulation configuration from a YAML string
    
    Args:
        config_content: YAML content string
        db_config: Optional database configuration to derive table specifications
        
    Returns:
        Simulation configuration
    """
    config_dict = yaml.safe_load(config_content)
    
    sim_dict = config_dict.get('simulation', {})
    
    start_date = None
    if 'start_date' in sim_dict:
        date_str = str(sim_dict['start_date'])
        try:
            if len(date_str) == 10:
                start_date = datetime.strptime(date_str, '%Y-%m-%d')
            else:
                start_date = datetime.fromisoformat(date_str)
        except (ValueError, TypeError):
            logger.warning(f"Failed to parse start_date: {date_str}")
            start_date = datetime.now()
    
    event_simulation = None
    if 'event_simulation' in config_dict:
        event_dict = config_dict['event_simulation']
        
        # Parse table specification
        table_spec = None
        if 'table_specification' in event_dict:
            # Use the table specification from the simulation config
            table_dict = event_dict['table_specification']
            table_spec = TableSpecification(
                entity_table=table_dict.get('entity_table', ''),
                event_table=table_dict.get('event_table', ''),
                resource_table=table_dict.get('resource_table', '')
            )
        elif db_config:
            # Derive table specification from database config based on table types
            entity_table = find_table_by_type(db_config, 'entity')
            event_table = find_table_by_type(db_config, 'event')
            resource_table = find_table_by_type(db_config, 'resource')
            
            if entity_table and event_table and resource_table:
                table_spec = TableSpecification(
                    entity_table=entity_table,
                    event_table=event_table,
                    resource_table=resource_table
                )
                logger.info(f"Derived table specification from database config: entity={entity_table}, event={event_table}, resource={resource_table}")
        
        # Parse the rest of the event simulation configuration
        # (This is the same code as in parse_sim_config)
        entity_arrival = None
        if 'entity_arrival' in event_dict:
            arrival_dict = event_dict['entity_arrival']
            entity_arrival = EntityArrival(
                interarrival_time=arrival_dict.get('interarrival_time', {}),
                max_entities=arrival_dict.get('max_entities'),
                override_db_config=arrival_dict.get('override_db_config', True)
            )
        
        work_shifts = None
        if 'work_shifts' in event_dict:
            shifts_dict = event_dict['work_shifts']
            
            # Parse shift patterns
            shift_patterns = []
            for pattern_dict in shifts_dict.get('shift_patterns', []):
                shift_patterns.append(ShiftPattern(
                    name=pattern_dict.get('name', ''),
                    days=pattern_dict.get('days', []),
                    start_time=pattern_dict.get('start_time', '09:00'),
                    end_time=pattern_dict.get('end_time', '17:00')
                ))
            
            # Parse resource shifts
            resource_shifts = []
            for shift_dict in shifts_dict.get('resource_shifts', []):
                resource_shifts.append(ResourceShift(
                    resource_type=shift_dict.get('resource_type', ''),
                    shift_pattern=shift_dict.get('shift_pattern') or shift_dict.get('shift_patterns', [])
                ))
            
            work_shifts = WorkShifts(
                enabled=shifts_dict.get('enabled', False),
                shift_patterns=shift_patterns,
                resource_shifts=resource_shifts
            )
        
        
        # Parse event flows configuration
        event_flows = None
        if 'event_flows' in event_dict:
            flows = []
            for flow_dict in event_dict['event_flows']:
                steps = []
                for step_dict in flow_dict.get('steps', []):
                    # Parse step configuration
                    event_config = None
                    decide_config = None
                    
                    if step_dict.get('step_type') == 'event' and 'event_config' in step_dict:
                        ec_dict = step_dict['event_config']
                        # Parse resource requirements for this step
                        resource_reqs = []
                        for req_dict in ec_dict.get('resource_requirements', []):
                            resource_reqs.append(ResourceRequirement(
                                resource_table=req_dict.get('resource_table', ''),
                                value=req_dict.get('value', ''),
                                count=req_dict.get('count', 1),
                                capacity_per_resource=req_dict.get('capacity_per_resource', 1)
                            ))
                        
                        event_config = EventStepConfig(
                            name=ec_dict.get('name', ''),
                            duration=ec_dict.get('duration', {}),
                            resource_requirements=resource_reqs
                        )
                    
                    elif step_dict.get('step_type') == 'decide' and 'decide_config' in step_dict:
                        dc_dict = step_dict['decide_config']
                        outcomes = []
                        for outcome_dict in dc_dict.get('outcomes', []):
                            conditions = []
                            for condition_dict in outcome_dict.get('conditions', []):
                                conditions.append(Condition(
                                    if_=condition_dict.get('if'),
                                    name=condition_dict.get('name'),
                                    is_=condition_dict.get('is'),
                                    value=condition_dict.get('value')
                                ))
                            
                            outcomes.append(Outcome(
                                outcome_id=outcome_dict.get('outcome_id', ''),
                                next_step_id=outcome_dict.get('next_step_id', ''),
                                conditions=conditions
                            ))
                        
                        decide_config = DecideConfig(
                            module_id=dc_dict.get('module_id', ''),
                            decision_type=dc_dict.get('decision_type', ''),
                            outcomes=outcomes
                        )
                    
                    # Parse assign config if present
                    assign_config = None
                    if 'assign_config' in step_dict:
                        assign_dict = step_dict['assign_config']
                        assignments = []
                        if 'assignments' in assign_dict:
                            for assignment_dict in assign_dict['assignments']:
                                assignments.append(AssignmentOperation(
                                    assignment_type=assignment_dict.get('assignment_type', ''),
                                    attribute_name=assignment_dict.get('attribute_name'),
                                    value=assignment_dict.get('value')
                                ))
                        assign_config = AssignConfig(
                            module_id=assign_dict.get('module_id', ''),
                            assignments=assignments
                        )
                    
                    steps.append(Step(
                        step_id=step_dict.get('step_id', ''),
                        step_type=step_dict.get('step_type', ''),
                        event_config=event_config,
                        decide_config=decide_config,
                        assign_config=assign_config,
                        next_steps=step_dict.get('next_steps', [])
                    ))
                
                flows.append(EventFlow(
                    flow_id=flow_dict.get('flow_id', ''),
                    initial_step=flow_dict.get('initial_step', ''),
                    steps=steps
                ))
            
            event_flows = EventFlowsConfig(flows=flows)
        
        # Parse resource capacities configuration
        resource_capacities = None
        if 'resource_capacities' in event_dict:
            resource_capacities = {}
            for table_name, capacity_config_dict in event_dict['resource_capacities'].items():
                # Parse capacity rules
                capacity_rules = []
                for rule_dict in capacity_config_dict.get('capacity_rules', []):
                    capacity_rules.append(CapacityRule(
                        resource_type=rule_dict.get('resource_type', ''),
                        capacity=rule_dict.get('capacity', 1)
                    ))
                
                resource_capacities[table_name] = ResourceCapacityConfig(
                    capacity_rules=capacity_rules,
                    default_capacity=capacity_config_dict.get('default_capacity', 1),
                    capacity_formula=capacity_config_dict.get('capacity_formula'),
                    min_capacity=capacity_config_dict.get('min_capacity', 1),
                    max_capacity=capacity_config_dict.get('max_capacity', 100)
                )
        
        event_simulation = EventSimulation(
            table_specification=table_spec,
            entity_arrival=entity_arrival,
            work_shifts=work_shifts,
            event_flows=event_flows,
            resource_capacities=resource_capacities
        )
    
    return SimulationConfig(
        duration_days=sim_dict.get('duration_days', 0),
        start_date=start_date,
        random_seed=sim_dict.get('random_seed'),
        event_simulation=event_simulation
    )