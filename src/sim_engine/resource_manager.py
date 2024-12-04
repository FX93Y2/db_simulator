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
                # Find the type field (attribute with distribution generator and choices)
                type_field = next(
                    (attr['name'] for attr in entity['attributes']
                    if (attr.get('generator', {}).get('type') == 'distribution' and 
                        'choices' in attr.get('generator', {}))),
                    None
                )
                
                if type_field:
                    resource_tables[entity['name']] = type_field
                else:
                    logger.warning(
                        f"Resource table {entity['name']} has no type field "
                        "(attribute with distribution generator and choices)"
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
            
            # Debug log for resource initialization
            logger.debug(f"Initializing resources for table {table_name} with type field {type_field}")
            
            for entity_id, entity_data in entities[table_name].items():
                resource_type = entity_data.get(type_field)
                logger.debug(f"Resource {entity_id} has type {resource_type} from field {type_field}")
                
                if resource_type is None:
                    logger.warning(f"Resource {entity_id} has no type value for field {type_field}")
                    continue
                if isinstance(resource_type, (int, float)):
                    entity_config = next(
                        (e for e in self.config['entities'] if e['name'] == table_name),
                        None
                    )
                    if entity_config:
                        role_attr = next(
                            (attr for attr in entity_config['attributes'] 
                            if attr['name'] == type_field),
                            None
                        )
                        if role_attr and 'generator' in role_attr:
                            choices = role_attr['generator'].get('choices', [])
                            if 0 <= resource_type < len(choices):
                                resource_type = choices[int(resource_type)]
                
                self.resources[table_name][entity_id] = {
                    'type': resource_type,
                    'status': ResourceStatus.AVAILABLE,
                    'current_process': None,
                    'allocation_history': []
                }
            
            # Log resource type distribution
            type_counts = {}
            for resource in self.resources[table_name].values():
                type_counts[resource['type']] = type_counts.get(resource['type'], 0) + 1
            logger.info(f"Resource type distribution for {table_name}: {type_counts}")
                
    def get_available_resource_types(self, group_by: Optional[str] = None) -> Dict[str, List[str]]:
        """Get currently available resource types for each resource table
        
        Args:
            group_by: Optional field name to group resources by. If None, uses the default type field.
        
        Returns:
            Dict mapping resource table names to lists of available resource types with counts
        """
        available_types = {}
        
        for table_name, resources in self.resources.items():
            type_counts = {}  # Track count of each available type
            grouping_field = group_by or self.resource_tables.get(table_name)
            
            if not grouping_field:
                logger.warning(f"No grouping field found for table {table_name}")
                continue
                
            for resource_info in resources.values():
                if resource_info['status'] == ResourceStatus.AVAILABLE:
                    resource_type = resource_info.get(grouping_field)
                    if resource_type:
                        type_counts[resource_type] = type_counts.get(resource_type, 0) + 1
            
            # Only include types that have available resources
            available_types[table_name] = [
                f"{resource_type} ({count} available)"
                for resource_type, count in type_counts.items()
            ]
        
        return available_types

    def find_available_resources(
        self,
        requirements: List[Dict],
        current_time: Optional[datetime] = None
    ) -> Optional[Dict[str, List[Tuple[str, int]]]]:
        """Find resources that can be seized for process"""
        needed_resources = {}
        
        logger.debug(f"Looking for resources with requirements: {requirements}")
        
        for req in requirements:
            resource_type = req['type']
            count = req.get('count', 1)
            resource_table = req['resource_table']
            group_by = req.get('group_by', self.resource_tables.get(resource_table))
            
            if not group_by:
                logger.warning(f"No grouping field found for table {resource_table}")
                return None
            
            if resource_table not in self.resources:
                logger.warning(f"Resource table {resource_table} not found")
                return None
                
            # Debug log current resource availability
            available_resources = {
                rid: info for rid, info in self.resources[resource_table].items()
                if info['status'] == ResourceStatus.AVAILABLE
            }
            logger.debug(
                f"Available resources in {resource_table}: "
                f"{[(rid, info['type']) for rid, info in available_resources.items()]}"
            )
            
            # Get resources of the required type that are available
            available = [
                (resource_table, rid) 
                for rid, info in self.resources[resource_table].items()
                if info['type'] == resource_type and 
                info['status'] == ResourceStatus.AVAILABLE
            ]
            
            if len(available) < count:
                logger.debug(
                    f"Insufficient {resource_type} resources in {resource_table}. "
                    f"Need {count}, found {len(available)}. "
                    f"Available types: {self.get_available_resource_types()}"
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
        try:
            # Validate resources exist
            for resource_type, resource_list in resources.items():
                for table_name, rid in resource_list:
                    if (table_name not in self.resources or 
                        rid not in self.resources[table_name]):
                        raise ValueError(
                            f"Resource {rid} not found in table {table_name}"
                        )
            
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
                    
                    logger.debug(
                        f"Seized resource {rid} of type {resource_type} "
                        f"from table {table_name} for process {process_id}"
                    )
                
        except Exception as e:
            logger.error(f"Failed to seize resources: {str(e)}")
            raise

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