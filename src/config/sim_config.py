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
class ResourceRequirement:
    resource_type: str
    quantity: int

@dataclass
class EntityRequirement:
    entity_type: str
    needs: List[ResourceRequirement]

@dataclass
class ProcessConfig:
    name: str
    description: str
    entity_table: str
    resource_table: str
    entity_type: Dict[str, Any]
    resource_type: Dict[str, Any]
    requirements: List[EntityRequirement]
    duration: Dict[str, Any]
    capacity: Dict[str, Any]

    @classmethod
    def from_dict(cls, process_dict: Dict[str, Any]) -> 'ProcessConfig':
        # Convert requirements list to proper objects
        requirements = []
        for req in process_dict['requirements']:
            needs = [
                ResourceRequirement(
                    resource_type=need['resource_type'],
                    quantity=need['quantity']
                )
                for need in req['needs']
            ]
            requirements.append(EntityRequirement(
                entity_type=req['entity_type'],
                needs=needs
            ))
        
        # Create ProcessConfig with converted requirements
        return cls(
            name=process_dict['name'],
            description=process_dict['description'],
            entity_table=process_dict['entity_table'],
            resource_table=process_dict['resource_table'],
            entity_type=process_dict['entity_type'],
            resource_type=process_dict['resource_type'],
            requirements=requirements,
            duration=process_dict['duration'],
            capacity=process_dict['capacity']
        )

@dataclass
class MetricConfig:
    name: str
    description: str
    type: str
    unit: Optional[str] = None
    aggregation: Optional[str] = None

    def __post_init__(self):
        if self.unit is None:
            if self.type == 'percentage':
                self.unit = 'percentage'
            elif self.type == 'duration':
                self.unit = 'seconds'
            else:
                self.unit = 'count'

@dataclass
class SimulationProcessConfig:
    simulation: SimulationConfig
    processes: List[ProcessConfig]
    metrics: List[MetricConfig]

class SimulationConfigParser:
    """Parses simulation configuration YAML files"""
    
    @staticmethod
    def parse(config_path: Path) -> SimulationProcessConfig:
        with open(config_path) as f:
            config_dict = yaml.safe_load(f)
            
        sim_config = SimulationConfig(
            duration=config_dict['simulation']['duration'],
            time_unit=config_dict['simulation']['time_unit'],
            random_seed=config_dict['simulation']['random_seed'],
            timing=SimulationTiming(
                start_time=datetime.fromisoformat(config_dict['simulation']['timing']['start_time']),
                end_time=datetime.fromisoformat(config_dict['simulation']['timing']['end_time'])
            )
        )
        
        # Use the new from_dict method to parse processes
        processes = [
            ProcessConfig.from_dict(process_dict)
            for process_dict in config_dict['processes']
        ]
        
        metrics = []
        for metric_dict in config_dict['metrics']:
            try:
                metric = MetricConfig(**metric_dict)
                metrics.append(metric)
            except TypeError as e:
                print(f"Warning: Error parsing metric {metric_dict.get('name', 'unknown')}: {e}")
                print(f"Using default unit based on type")
                metric = MetricConfig(
                    name=metric_dict['name'],
                    description=metric_dict['description'],
                    type=metric_dict['type'],
                    aggregation=metric_dict.get('aggregation'),
                )
                metrics.append(metric)
        
        return SimulationProcessConfig(
            simulation=sim_config,
            processes=processes,
            metrics=metrics
        ) 