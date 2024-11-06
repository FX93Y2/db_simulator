from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Tuple, Set
import logging
import random
from ..utils.time_utils import (
    calculate_work_end_time,
    calculate_working_hours,
    get_working_periods
)

logger = logging.getLogger(__name__)

class TableType:
    RESOURCE = 'resource'
    PROCESS_ENTITY = 'process_entity'
    MAPPING = 'mapping'

class ResourceStatus:
    """Status constants for resources"""
    AVAILABLE = 'Available'
    BUSY = 'Busy'

class ResourceManager:
    """Manages resource allocation and availability for any resource-type table"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.resources = {}  # Resource availability tracking
        self.work_schedule = self._parse_work_schedule()
        
        # Track resource tables and their type fields
        self.resource_tables = self._identify_resource_tables()
        
        # Track active allocations
        self.active_allocations = {}  # process_id -> {resource_table: {resource_id: allocation_info}}

    def _identify_resource_tables(self) -> Dict[str, str]:
        """Identify all resource tables and their type fields"""
        resource_tables = {}
        
        for entity in self.config['entities']:
            if entity.get('type') == TableType.RESOURCE:
                # Find the type field (attribute with choice generator)
                type_field = next(
                    (attr['name'] for attr in entity['attributes']
                     if attr.get('generator', {}).get('type') == 'choice'),
                    None
                )
                
                if type_field:
                    resource_tables[entity['name']] = type_field
                else:
                    logger.warning(
                        f"Resource table {entity['name']} has no type field "
                        "(attribute with choice generator)"
                    )
        
        return resource_tables

    def _parse_work_schedule(self) -> Dict:
        """Parse work schedule from configuration"""
        return self.config['simulation_parameters'].get('work_schedule', {
            'hours_per_day': 8,
            'start_hour': 9,
            'end_hour': 17,
            'work_days': [1, 2, 3, 4, 5]
        })

    def initialize_resources(self, entities: Dict):
        """Initialize resource pool from entities"""
        for table_name, type_field in self.resource_tables.items():
            if table_name not in entities:
                logger.warning(f"Resource table {table_name} not found in entities")
                continue

            self.resources[table_name] = {}
            for id, data in entities[table_name].items():
                self.resources[table_name][id] = {
                    'type': data[type_field],
                    'status': ResourceStatus.AVAILABLE,
                    'current_process': None,
                    'allocation_history': []
                }

    def find_available_resources(
        self,
        requirements: List[Dict],
        current_time: Optional[datetime] = None
    ) -> Optional[Dict[str, List[Tuple[str, int]]]]:
        """Find resources that can be seized for process"""
        needed_resources = {}
        
        for req in requirements:
            resource_type = req['type']
            count = req.get('count', 1)
            
            # Find available resources across all resource tables
            available = []
            for table_name, resources in self.resources.items():
                # Get the type field for this resource table
                type_field = self.resource_tables[table_name]
                
                # Find matching available resources
                available.extend([
                    (table_name, rid) 
                    for rid, info in resources.items()
                    if info['type'] == resource_type and 
                       info['status'] == ResourceStatus.AVAILABLE and
                       info['current_process'] is None
                ])
            
            if len(available) < count:
                logger.debug(
                    f"Not enough resources of type {resource_type} "
                    f"(needed: {count}, available: {len(available)})"
                )
                return None
                
            # Randomly select required number of resources
            selected = random.sample(available, count)
            needed_resources[resource_type] = selected
        
        return needed_resources

    def seize_resources(
        self,
        process_id: str,
        resources: Dict[str, List[Tuple[str, int]]],
        start_time: datetime
    ):
        """Seize resources for a process"""
        # Initialize allocation tracking for this process
        self.active_allocations[process_id] = {}
        
        for resource_type, resource_list in resources.items():
            for table_name, rid in resource_list:
                # Update resource status
                self.resources[table_name][rid].update({
                    'status': ResourceStatus.BUSY,
                    'current_process': process_id
                })
                
                # Track allocation
                if table_name not in self.active_allocations[process_id]:
                    self.active_allocations[process_id][table_name] = {}
                
                self.active_allocations[process_id][table_name][rid] = {
                    'start_time': start_time,
                    'resource_type': resource_type
                }
                
                # Add to resource history
                self.resources[table_name][rid]['allocation_history'].append({
                    'process_id': process_id,
                    'start_time': start_time
                })
                
                logger.debug(
                    f"Seized resource {rid} of type {resource_type} "
                    f"from table {table_name} for process {process_id}"
                )

    def release_resources(self, process_id: str, end_time: datetime):
        """Release resources from a process"""
        if process_id not in self.active_allocations:
            logger.warning(f"No active allocations found for process {process_id}")
            return
        
        for table_name, resources in self.active_allocations[process_id].items():
            for rid, allocation_info in resources.items():
                # Update resource status
                self.resources[table_name][rid].update({
                    'status': ResourceStatus.AVAILABLE,
                    'current_process': None
                })
                
                # Update allocation history
                for allocation in self.resources[table_name][rid]['allocation_history']:
                    if allocation['process_id'] == process_id and 'end_time' not in allocation:
                        allocation['end_time'] = end_time
                        break
                
                logger.debug(
                    f"Released resource {rid} of type {allocation_info['resource_type']} "
                    f"from table {table_name} for process {process_id}"
                )
        
        # Remove active allocation tracking
        del self.active_allocations[process_id]

    def get_allocation_info(self, process_id: str) -> Dict:
        """Get information about current resource allocations for a process"""
        if process_id not in self.active_allocations:
            return {}
        
        allocation_info = {}
        for table_name, resources in self.active_allocations[process_id].items():
            if table_name not in allocation_info:
                allocation_info[table_name] = {}
            
            for rid, info in resources.items():
                allocation_info[table_name][rid] = {
                    'resource_type': info['resource_type'],
                    'start_time': info['start_time']
                }
        
        return allocation_info

    def get_resource_utilization(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict:
        """Calculate resource utilization statistics"""
        utilization_stats = {}
        
        for table_name, resources in self.resources.items():
            utilization_stats[table_name] = {
                'total_resources': len(resources),
                'by_type': {},
                'overall_utilization': 0.0
            }
            
            total_busy_time = timedelta()
            total_available_time = timedelta()
            
            for rid, info in resources.items():
                resource_type = info['type']
                
                if resource_type not in utilization_stats[table_name]['by_type']:
                    utilization_stats[table_name]['by_type'][resource_type] = {
                        'count': 0,
                        'busy_time': timedelta(),
                        'utilization': 0.0
                    }
                
                utilization_stats[table_name]['by_type'][resource_type]['count'] += 1
                
                # Calculate busy time from allocation history
                for allocation in info['allocation_history']:
                    if start_time and allocation['start_time'] < start_time:
                        continue
                    if end_time and allocation.get('end_time', datetime.max) > end_time:
                        continue
                        
                    alloc_start = max(allocation['start_time'], start_time) if start_time else allocation['start_time']
                    alloc_end = min(allocation.get('end_time', datetime.max), end_time) if end_time else allocation.get('end_time')
                    
                    if alloc_end:
                        busy_time = calculate_working_hours(
                            alloc_start,
                            alloc_end,
                            self.work_schedule['hours_per_day'],
                            self.work_schedule['start_hour'],
                            self.work_schedule['end_hour'],
                            self.work_schedule['work_days']
                        )
                        total_busy_time += timedelta(hours=busy_time)
                        utilization_stats[table_name]['by_type'][resource_type]['busy_time'] += timedelta(hours=busy_time)
            
            # Calculate utilization percentages
            total_time = calculate_working_hours(
                start_time or self.config['simulation_parameters']['start_date'],
                end_time or self.config['simulation_parameters']['end_date'],
                self.work_schedule['hours_per_day'],
                self.work_schedule['start_hour'],
                self.work_schedule['end_hour'],
                self.work_schedule['work_days']
            )
            
            if total_time > 0:
                utilization_stats[table_name]['overall_utilization'] = (
                    total_busy_time.total_seconds() / 
                    (total_time * 3600 * len(resources)) * 100
                )
                
                for resource_type in utilization_stats[table_name]['by_type']:
                    type_count = utilization_stats[table_name]['by_type'][resource_type]['count']
                    type_busy_time = utilization_stats[table_name]['by_type'][resource_type]['busy_time']
                    utilization_stats[table_name]['by_type'][resource_type]['utilization'] = (
                        type_busy_time.total_seconds() / 
                        (total_time * 3600 * type_count) * 100
                    )
        
        return utilization_stats