from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class ResourceManager:
    """Manages resource allocation, availability, and work hours"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.resources = {}  # Resource availability tracking
        self.resource_definitions = self._parse_resource_definitions()
        self.work_hours = self._parse_work_hours()

    def _parse_resource_definitions(self) -> List[Dict]:
        """Parse resource definitions from config"""
        return self.config.get('resource_definitions', [])

    def _parse_work_hours(self) -> Dict:
        """Parse work hours configuration"""
        work_hours = self.config['simulation_parameters']['work_hours']
        start_hour = work_hours.get('start_hour', 9)
        return {
            'hours_per_day': work_hours['hours_per_day'],
            'start_hour': start_hour,
            'end_hour': start_hour + work_hours['hours_per_day'],
            'start_time': time(start_hour, 0),
            'end_time': time(start_hour + work_hours['hours_per_day'], 0)
        }

    def initialize_resources(self, entities: Dict):
        """Initialize resource pool from entities"""
        for res_def in self.resource_definitions:
            table_name = res_def['table']
            type_field = res_def['type_field']
            
            if table_name not in entities:
                logger.warning(f"Resource table {table_name} not found in entities")
                continue

            self.resources[table_name] = {}
            for id, data in entities[table_name].items():
                self.resources[table_name][id] = {
                    'type': data[type_field],
                    'available': True,
                    'current_process': None
                }

    def find_available_resources(self, requirements: List[Dict]) -> Optional[Dict[str, List[int]]]:
        """Find available resources that match requirements"""
        needed_resources = {}
        
        for req in requirements:
            resource_type = req['type']
            count = req['count']
            
            # Find available resources across all resource tables
            available = []
            for table_name, resources in self.resources.items():
                available.extend([
                    (table_name, rid) 
                    for rid, info in resources.items()
                    if info['type'] == resource_type and info['available']
                ])
            
            if len(available) < count:
                return None  # Not enough resources
                
            needed_resources[resource_type] = available[:count]
        
        return needed_resources

    def allocate_resources(self, process_id: str, resources: Dict[str, List[Tuple[str, int]]]):
        """Allocate resources to a process"""
        for resource_type, resource_list in resources.items():
            for table_name, rid in resource_list:
                self.resources[table_name][rid]['available'] = False
                self.resources[table_name][rid]['current_process'] = process_id

    def release_resources(self, process_id: str):
        """Release resources from a process"""
        for table_name in self.resources:
            for rid, info in self.resources[table_name].items():
                if info['current_process'] == process_id:
                    info['available'] = True
                    info['current_process'] = None

    def calculate_work_hours(
        self,
        current_time: datetime,
        duration_hours: float
    ) -> Tuple[datetime, datetime]:
        """Calculate working time based on hours per day"""
        remaining_hours = duration_hours
        current = current_time
        start_time = None
        
        # Adjust start time to work hours if needed
        if current.time() < self.work_hours['start_time']:
            current = current.replace(
                hour=self.work_hours['start_hour'],
                minute=0,
                second=0
            )
        elif current.time() >= self.work_hours['end_time']:
            # Move to next day
            current = (current + timedelta(days=1)).replace(
                hour=self.work_hours['start_hour'],
                minute=0,
                second=0
            )
        
        start_time = current
        
        while remaining_hours > 0:
            # Calculate available hours for current day
            day_end = current.replace(
                hour=self.work_hours['end_hour'],
                minute=0,
                second=0
            )
            
            available_hours = (day_end - current).total_seconds() / 3600
            work_hours = min(remaining_hours, available_hours)
            
            remaining_hours -= work_hours
            current += timedelta(hours=work_hours)
            
            if remaining_hours > 0:
                # Move to next day
                current = (current + timedelta(days=1)).replace(
                    hour=self.work_hours['start_hour'],
                    minute=0,
                    second=0
                )
        
        return start_time, current