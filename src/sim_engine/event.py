from datetime import datetime
from typing import Dict, Any, Optional

class Event:
    def __init__(
        self,
        event_type: str,
        entity_type: str,
        entity_id: int,
        time: datetime,
        name: str,
        params: Optional[Dict[str, Any]] = None
    ):
        self.type = event_type
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.time = time
        self.name = name
        self.params = params or {}
        
        # Process-specific attributes
        self.process_start_time: Optional[datetime] = None
        self.process_end_time: Optional[datetime] = None
        self.allocated_resources: Dict[str, list] = {}  # {resource_type: [(table_name, resource_id)]}

    def record_process_timing(self, start_time: datetime, end_time: datetime):
        """Record the start and end times of a process"""
        self.process_start_time = start_time
        self.process_end_time = end_time

    def allocate_resources(self, resources: Dict[str, list]):
        """Record allocated resources for this process"""
        self.allocated_resources = resources

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
            f"entity_id={self.entity_id}, time={self.time}, name={self.name}, "
            f"params={self.params}"
        )
        
        if self.type == "Process":
            process_info = (
                f", process_start={self.process_start_time}, "
                f"process_end={self.process_end_time}, "
                f"allocated_resources={self.allocated_resources}"
            )
            return base_info + process_info + ")"
        
        return base_info + ")"

    def __repr__(self):
        return self.__str__()