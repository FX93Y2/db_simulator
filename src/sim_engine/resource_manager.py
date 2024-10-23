from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Tuple
import logging
from ..utils.time_utils import (
    calculate_work_end_time,
    calculate_working_hours,
    get_working_periods
)

logger = logging.getLogger(__name__)

class ResourceManager:
    """Manages resource allocation and availability with proper seize/release patterns"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.resources = {}  # Resource availability tracking
        self.resource_definitions = self._parse_resource_definitions()
        self.work_schedule = self._parse_work_schedule()

    def _parse_resource_definitions(self) -> List[Dict]:
        """Parse resource definitions including status fields"""
        return self.config.get('resource_definitions', [])

    def _parse_work_schedule(self) -> Dict:
        """Parse work schedule from process definition"""
        process_config = self.config['process_definitions'][0]  # Using first process for now
        schedule = process_config['work_schedule']
        return {
            'hours_per_day': schedule['hours_per_day'],
            'start_hour': schedule['start_hour'],
            'end_hour': schedule['end_hour'],
            'work_days': schedule['work_days']
        }

    def initialize_resources(self, entities: Dict):
        """Initialize resource pool from entities"""
        for res_def in self.resource_definitions:
            table_name = res_def['table']
            type_field = res_def['type_field']
            status_field = res_def['status_field']
            
            if table_name not in entities:
                logger.warning(f"Resource table {table_name} not found in entities")
                continue

            self.resources[table_name] = {}
            for id, data in entities[table_name].items():
                self.resources[table_name][id] = {
                    'type': data[type_field],
                    'status': data[status_field],
                    'current_process': None
                }

    def find_available_resources(self, requirements: List[Dict]) -> Optional[Dict[str, List[Tuple[str, int]]]]:
        """Find resources that can be seized for process"""
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
                    if info['type'] == resource_type and 
                       info['status'] == self._get_available_status(table_name) and
                       info['current_process'] is None
                ])
            
            if len(available) < count:
                return None  # Not enough resources
                
            needed_resources[resource_type] = available[:count]
        
        return needed_resources

    def seize_resources(self, process_id: str, resources: Dict[str, List[Tuple[str, int]]]):
        """Seize resources for a process"""
        for resource_type, resource_list in resources.items():
            for table_name, rid in resource_list:
                res_def = self._get_resource_definition(table_name)
                self.resources[table_name][rid]['status'] = res_def['busy_status']
                self.resources[table_name][rid]['current_process'] = process_id

    def release_resources(self, process_id: str):
        """Release resources from a process"""
        for table_name, resources in self.resources.items():
            for rid, info in resources.items():
                if info['current_process'] == process_id:
                    res_def = self._get_resource_definition(table_name)
                    info['status'] = res_def['available_status']
                    info['current_process'] = None

    def _get_resource_definition(self, table_name: str) -> Dict:
        """Get resource definition for a table"""
        return next(
            res_def for res_def in self.resource_definitions 
            if res_def['table'] == table_name
        )

    def _get_available_status(self, table_name: str) -> str:
        """Get available status value for a resource table"""
        res_def = self._get_resource_definition(table_name)
        return res_def['available_status']

    def calculate_work_hours(
        self,
        current_time: datetime,
        duration_hours: float
    ) -> Tuple[datetime, datetime]:
        """Calculate working time respecting work schedule"""
        remaining_hours = duration_hours
        current = current_time
        start_time = None
        
        # Adjust start time to next work period if needed
        while True:
            # Skip non-working days
            while current.weekday() + 1 not in self.work_schedule['work_days']:
                current += timedelta(days=1)
                current = current.replace(
                    hour=self.work_schedule['start_hour'],
                    minute=0,
                    second=0
                )
            
            # Adjust for work hours
            if current.hour < self.work_schedule['start_hour']:
                current = current.replace(
                    hour=self.work_schedule['start_hour'],
                    minute=0,
                    second=0
                )
            elif current.hour >= self.work_schedule['end_hour']:
                current += timedelta(days=1)
                current = current.replace(
                    hour=self.work_schedule['start_hour'],
                    minute=0,
                    second=0
                )
                continue
            
            start_time = current
            break
        
        while remaining_hours > 0:
            # Skip to next work day if needed
            if current.weekday() + 1 not in self.work_schedule['work_days']:
                current += timedelta(days=1)
                current = current.replace(
                    hour=self.work_schedule['start_hour'],
                    minute=0,
                    second=0
                )
                continue
            
            # Calculate available hours for current day
            day_end = current.replace(
                hour=self.work_schedule['end_hour'],
                minute=0,
                second=0
            )
            
            available_hours = (day_end - current).total_seconds() / 3600
            work_hours = min(remaining_hours, available_hours)
            
            remaining_hours -= work_hours
            current += timedelta(hours=work_hours)
            
            if remaining_hours > 0:
                # Move to next work day
                current += timedelta(days=1)
                current = current.replace(
                    hour=self.work_schedule['start_hour'],
                    minute=0,
                    second=0
                )
        
        return start_time, current