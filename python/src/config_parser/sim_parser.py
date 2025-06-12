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

@dataclass
class EventTypeDefinition:
    name: str
    duration: Dict
    resource_requirements: List[ResourceRequirement] = field(default_factory=list)

@dataclass
class EventTransition:
    event_type: str
    probability: float

@dataclass
class EventSequenceTransition:
    from_event: str
    to_events: List[EventTransition]

@dataclass
class EventSequence:
    event_types: List[EventTypeDefinition]
    transitions: List[EventSequenceTransition]

@dataclass
class EventSimulation:
    table_specification: TableSpecification
    entity_arrival: Optional[EntityArrival] = None
    work_shifts: Optional[WorkShifts] = None
    event_sequence: Optional[EventSequence] = None
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

def find_relationship_keys(db_config: DatabaseConfig, event_table: str, entity_table: str) -> List[str]:
    """
    Find foreign key columns in the event table that reference the entity table.
    
    Args:
        db_config: The database configuration
        event_table: Name of the event table
        entity_table: Name of the entity table
        
    Returns:
        List of column names that are foreign keys to the entity table
    """
    relationship_keys = []
    
    # Find the event and entity table entities
    event_entity = next((e for e in db_config.entities if e.name == event_table), None)
    entity_entity = next((e for e in db_config.entities if e.name == entity_table), None)
    
    if not event_entity or not entity_entity:
        logger.warning(f"Could not find event table '{event_table}' or entity table '{entity_table}' in database config")
        return []
    
    # Find primary key of entity table
    entity_pk = next((attr.name for attr in entity_entity.attributes if attr.is_primary_key), None)
    
    if not entity_pk:
        logger.warning(f"Entity table '{entity_table}' has no primary key defined")
        return []
    
    # Find foreign keys in event table that reference entity table's primary key
    for attr in event_entity.attributes:
        if attr.is_foreign_key and attr.ref:
            # Reference format should be "TableName.column_name"
            ref_parts = attr.ref.split('.')
            if len(ref_parts) == 2 and ref_parts[0] == entity_table and ref_parts[1] == entity_pk:
                relationship_keys.append(attr.name)
    
    return relationship_keys

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

def get_event_values(db_config: DatabaseConfig, event_table: str) -> List[str]:
    """
    Get the list of possible event type values from the database configuration.
    
    Args:
        db_config: The database configuration
        event_table: Name of the event table
        
    Returns:
        List of possible event type values or empty list if not found
    """
    event_entity = next((e for e in db_config.entities if e.name == event_table), None)
    
    if not event_entity:
        logger.warning(f"Could not find event table '{event_table}' in database config")
        return []
    
    # Find column with type 'event_type'
    event_type_attr = next((attr for attr in event_entity.attributes if attr.type == 'event_type'), None)
    
    if not event_type_attr or not event_type_attr.generator or event_type_attr.generator.type != 'simulation_event':
        logger.warning(f"Event table '{event_table}' has no valid event_type column with simulation_event generator")
        return []
    
    return event_type_attr.generator.values or []

def get_initial_event(event_sequence: EventSequence) -> Optional[str]:
    """
    Determine the initial event type from the transitions.
    
    The initial event is determined by finding the first transition in the list.
    
    Args:
        event_sequence: The event sequence configuration
        
    Returns:
        The name of the initial event type or None if not found
    """
    if not event_sequence or not event_sequence.transitions:
        return None
    
    # The first transition's "from" event is the initial event
    return event_sequence.transitions[0].from_event

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
        
        # Parse event sequence configuration
        event_sequence = None
        if 'event_sequence' in event_dict:
            seq_dict = event_dict['event_sequence']
            
            # Parse event types
            event_types = []
            for event_type_dict in seq_dict.get('event_types', []):
                # Parse resource requirements for this event type
                resource_reqs = []
                for req_dict in event_type_dict.get('resource_requirements', []):
                    resource_reqs.append(ResourceRequirement(
                        resource_table=req_dict.get('resource_table', ''),
                        value=req_dict.get('value', ''),
                        count=req_dict.get('count', 1),
                        capacity_per_resource=req_dict.get('capacity_per_resource', 1)
                    ))
                
                event_types.append(EventTypeDefinition(
                    name=event_type_dict.get('name', ''),
                    duration=event_type_dict.get('duration', {}),
                    resource_requirements=resource_reqs
                ))
            
            # Parse transitions
            transitions = []
            for transition_dict in seq_dict.get('transitions', []):
                to_events = []
                for to_event_dict in transition_dict.get('to', []):
                    to_events.append(EventTransition(
                        event_type=to_event_dict.get('event_type', ''),
                        probability=to_event_dict.get('probability', 1.0)
                    ))
                
                transitions.append(EventSequenceTransition(
                    from_event=transition_dict.get('from', ''),
                    to_events=to_events
                ))
            
            event_sequence = EventSequence(
                event_types=event_types,
                transitions=transitions
            )
        
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
            event_sequence=event_sequence,
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
        
        # Parse event sequence configuration
        event_sequence = None
        if 'event_sequence' in event_dict:
            seq_dict = event_dict['event_sequence']
            
            # Parse event types
            event_types = []
            for event_type_dict in seq_dict.get('event_types', []):
                # Parse resource requirements for this event type
                resource_reqs = []
                for req_dict in event_type_dict.get('resource_requirements', []):
                    resource_reqs.append(ResourceRequirement(
                        resource_table=req_dict.get('resource_table', ''),
                        value=req_dict.get('value', ''),
                        count=req_dict.get('count', 1),
                        capacity_per_resource=req_dict.get('capacity_per_resource', 1)
                    ))
                
                event_types.append(EventTypeDefinition(
                    name=event_type_dict.get('name', ''),
                    duration=event_type_dict.get('duration', {}),
                    resource_requirements=resource_reqs
                ))
            
            # Parse transitions
            transitions = []
            for transition_dict in seq_dict.get('transitions', []):
                to_events = []
                for to_event_dict in transition_dict.get('to', []):
                    to_events.append(EventTransition(
                        event_type=to_event_dict.get('event_type', ''),
                        probability=to_event_dict.get('probability', 1.0)
                    ))
                
                transitions.append(EventSequenceTransition(
                    from_event=transition_dict.get('from', ''),
                    to_events=to_events
                ))
            
            event_sequence = EventSequence(
                event_types=event_types,
                transitions=transitions
            )
        
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
            event_sequence=event_sequence,
            resource_capacities=resource_capacities
        )
    
    return SimulationConfig(
        duration_days=sim_dict.get('duration_days', 0),
        start_date=start_date,
        random_seed=sim_dict.get('random_seed'),
        event_simulation=event_simulation
    )