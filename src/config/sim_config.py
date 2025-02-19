from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import yaml
from pathlib import Path
from datetime import datetime

@dataclass
class SimulationTiming:
    start_time: datetime
    end_time: datetime

@dataclass
class SimulationConfig:
    duration: int
    time_unit: str
    random_seed: int
    timing: SimulationTiming

@dataclass
class ArrivalPattern:
    type: str
    rate: Optional[float] = None
    delay: Optional[int] = None
    count: Optional[Any] = None

@dataclass
class TableConfig:
    name: str
    type_column: str
    relationship: Optional[str] = None
    arrival_pattern: Optional[ArrivalPattern] = None

@dataclass
class EntityTableConfig:
    parent_table: TableConfig
    child_table: TableConfig

@dataclass
class ResourceRequirement:
    resource_type: str
    quantity: int

@dataclass
class ProcessConfig:
    name: str
    description: str
    entity_table: EntityTableConfig
    resource_table: TableConfig
    requirements: List[Dict[str, Any]]
    duration: Dict[str, Any]
    
@dataclass
class ProcessSequence:
    name: str
    config_file: str
    dependencies: List[str]

@dataclass
class SimulationSequenceConfig:
    simulation: SimulationConfig
    process_sequence: List[ProcessSequence]


@dataclass
class ProcessSimConfig:
    simulation: Optional[SimulationConfig] = None
    process: Optional[ProcessConfig] = None
    process_sequence: Optional[List[ProcessSequence]] = None


class SimulationConfigParser:
    @staticmethod
    def parse(config_path: Path) -> ProcessSimConfig:
        """Main parse method that handles all config file types"""
        with open(config_path) as f:
            config_dict = yaml.safe_load(f)

        sim_config = None
        process_config = None
        process_sequence = None

        # Parse simulation config if present
        if 'simulation' in config_dict:
            sim_config = SimulationConfigParser._parse_simulation_config(config_dict['simulation'])

        # Parse process config if present
        if 'process' in config_dict:
            process_config = SimulationConfigParser._parse_process_config(config_dict['process'])

        # Parse process sequence if present
        if 'process_sequence' in config_dict:
            process_sequence = [
                ProcessSequence(
                    name=proc['name'],
                    config_file=proc['config_file'],
                    dependencies=proc.get('dependencies', [])
                )
                for proc in config_dict['process_sequence']
            ]

        return ProcessSimConfig(
            simulation=sim_config,
            process=process_config,
            process_sequence=process_sequence
        )

    @staticmethod
    def _parse_simulation_config(sim_dict: Dict) -> SimulationConfig:
        """Parse simulation configuration section"""
        timing = SimulationTiming(
            start_time=datetime.fromisoformat(sim_dict['timing']['start_time']),
            end_time=datetime.fromisoformat(sim_dict['timing']['end_time'])
        )
        
        return SimulationConfig(
            duration=sim_dict['duration'],
            time_unit=sim_dict['time_unit'],
            random_seed=sim_dict['random_seed'],
            timing=timing
        )

    @staticmethod
    def _parse_process_config(process_dict: Dict) -> ProcessConfig:
        """Parse process configuration section"""
        # Parse parent table config
        parent_table = TableConfig(
            name=process_dict['entity_table']['parent_table']['name'],
            type_column=process_dict['entity_table']['parent_table']['type_column'],
            arrival_pattern=SimulationConfigParser._parse_arrival_pattern(
                process_dict['entity_table']['parent_table'].get('arrival_pattern')
            )
        )

        # Parse child table config
        child_table = TableConfig(
            name=process_dict['entity_table']['child_table']['name'],
            type_column=process_dict['entity_table']['child_table']['type_column'],
            relationship=process_dict['entity_table']['child_table']['relationship'],
            arrival_pattern=SimulationConfigParser._parse_arrival_pattern(
                process_dict['entity_table']['child_table'].get('arrival_pattern')
            )
        )

        # Parse resource table config
        resource_table = TableConfig(
            name=process_dict['resource_table']['name'],
            type_column=process_dict['resource_table']['type_column']
        )

        return ProcessConfig(
            name=process_dict['name'],
            description=process_dict['description'],
            entity_table=EntityTableConfig(
                parent_table=parent_table,
                child_table=child_table
            ),
            resource_table=resource_table,
            requirements=process_dict['requirements'],
            duration=process_dict['duration']
        )

    @staticmethod
    def _parse_arrival_pattern(pattern_dict: Optional[Dict]) -> Optional[ArrivalPattern]:
        """Parse arrival pattern configuration"""
        if not pattern_dict:
            return None
        return ArrivalPattern(
            type=pattern_dict.get('type'),
            rate=pattern_dict.get('rate'),
            delay=pattern_dict.get('delay'),
            count=pattern_dict.get('count')
        )