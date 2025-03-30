"""
Simulation configuration parser
"""

import yaml
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, time

logger = logging.getLogger(__name__)

@dataclass
class ResourceRequirement:
    resource_type: str
    count: Any  # Can be int or distribution dict

@dataclass
class ResourceTable:
    resource_table: str
    type_column: str
    requirements: List[ResourceRequirement]

@dataclass
class EntityArrival:
    interarrival_time: Dict
    max_entities: Optional[int] = None
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
    enabled: bool
    event_types: List[EventTypeDefinition]
    transitions: List[EventSequenceTransition]
    initial_event: str

@dataclass
class EventSimulation:
    entity_table: str
    event_table: str
    relationship_column: str
    event_duration: Dict
    resource_requirements: List[ResourceTable]
    entity_arrival: Optional[EntityArrival] = None
    work_shifts: Optional[WorkShifts] = None
    event_sequence: Optional[EventSequence] = None

@dataclass
class SimulationConfig:
    duration_days: int
    start_date: Optional[datetime] = None
    random_seed: Optional[int] = None
    event_simulation: Optional[EventSimulation] = None

def parse_sim_config(file_path: Union[str, Path]) -> SimulationConfig:
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
                        resource_type=req_dict.get('resource_type', ''),
                        count=req_dict.get('count', 1)
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
                enabled=seq_dict.get('enabled', False),
                event_types=event_types,
                transitions=transitions,
                initial_event=seq_dict.get('initial_event', '')
            )
        
        resource_requirements = []
        for req_dict in event_dict.get('resource_requirements', []):
            requirements = []
            if isinstance(req_dict.get('requirements'), list):
                for req_item in req_dict['requirements']:
                    requirements.append(ResourceRequirement(
                        resource_type=req_item.get('resource_type'),
                        count=req_item.get('count', 1)
                    ))
            
            resource_requirements.append(ResourceTable(
                resource_table=req_dict['resource_table'],
                type_column=req_dict['type_column'],
                requirements=requirements
            ))
        
        event_simulation = EventSimulation(
            entity_table=event_dict['entity_table'],
            event_table=event_dict['event_table'],
            relationship_column=event_dict['relationship_column'],
            event_duration=event_dict['event_duration'],
            resource_requirements=resource_requirements,
            entity_arrival=entity_arrival,
            work_shifts=work_shifts,
            event_sequence=event_sequence
        )
    
    return SimulationConfig(
        duration_days=sim_dict.get('duration_days', 0),
        start_date=start_date,
        random_seed=sim_dict.get('random_seed'),
        event_simulation=event_simulation
    ) 