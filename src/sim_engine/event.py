from datetime import datetime
from typing import Dict, Any, Optional, List, Union

class Event:
    def __init__(
        self,
        event_type: str,
        entity: Union[str, Dict[str, Any]],
        entity_id: int,
        time: datetime,
        name: str,
        params: Optional[Dict[str, Any]] = None
    ):
        self.type = event_type
        self.entity = entity
        self.entity_type = (
            entity['entity_table'] if isinstance(entity, dict) else entity
        )
        self.entity_table = (
            entity['entity_table'] if isinstance(entity, dict) else entity
        )
        self.group_by = (
            entity.get('group_by') if isinstance(entity, dict) else None
        )
        self.entity_id = entity_id
        self.time = time
        self.name = name
        self.params = params or {}
        
        # Process-specific attributes
        self.process_start_time: Optional[datetime] = None
        self.process_end_time: Optional[datetime] = None
        self.allocated_resources: Dict[str, list] = {}  # {resource_type: [(table_name, resource_id)]}
        
        # Subprocess tracking
        self.parent_process: Optional[str] = None
        self.subprocesses: List[Dict[str, Any]] = []
        self.current_subprocess: Optional[str] = None
        
        # Resource work time tracking
        self.resource_work_times: Dict[str, float] = {}  # {(table_name, resource_id): hours_worked}
        
        # Dependency tracking
        self.dependencies: List[Dict[str, Any]] = []
        self.dependent_processes: List[str] = []
        self.dependency_status: Dict[str, bool] = {}  # {process_name: is_satisfied}

    def record_process_timing(self, start_time: datetime, end_time: datetime):
        """Record the start and end times of a process"""
        self.process_start_time = start_time
        self.process_end_time = end_time

    def allocate_resources(self, resources: Dict[str, list]):
        """Record allocated resources for this process"""
        self.allocated_resources = resources

    def record_work_time(self, table_name: str, resource_id: int, hours: float):
        """Record work time for a specific resource"""
        self.resource_work_times[(table_name, resource_id)] = round(hours, 2)

    def add_subprocess(self, subprocess_config: Dict[str, Any]):
        """Add a subprocess to this event"""
        self.subprocesses.append(subprocess_config)

    def set_current_subprocess(self, subprocess_name: str):
        """Set the currently executing subprocess"""
        self.current_subprocess = subprocess_name

    def add_dependency(self, process_name: str, dependency_type: str):
        """Add a process dependency"""
        self.dependencies.append({
            'process': process_name,
            'type': dependency_type,
            'satisfied': False
        })
        self.dependency_status[process_name] = False

    def mark_dependency_satisfied(self, process_name: str):
        """Mark a dependency as satisfied"""
        self.dependency_status[process_name] = True

    def are_dependencies_satisfied(self) -> bool:
        """Check if all dependencies are satisfied"""
        return all(self.dependency_status.values())

    def get_process_duration(self) -> float:
        """Get the total duration of the process in hours"""
        if self.process_start_time and self.process_end_time:
            return (self.process_end_time - self.process_start_time).total_seconds() / 3600
        return 0.0

    def __lt__(self, other):
        return self.time < other.time

    def __str__(self):
        base_info = (
            f"Event(type={self.type}, entity_type={self.entity_type}, "
            f"entity_id={self.entity_id}, time={self.time}, name={self.name}"
        )
        
        if self.type == "Process":
            process_info = (
                f", process_start={self.process_start_time}, "
                f"process_end={self.process_end_time}, "
                f"current_subprocess={self.current_subprocess}, "
                f"dependencies={self.dependencies}"
            )
            return base_info + process_info + ")"
        
        return base_info + ")"

    def __repr__(self):
        return self.__str__()