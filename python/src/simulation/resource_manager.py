"""
Resource management for DB Simulator.

This module handles resource allocation and management for the simulation
using SimPy's FilterStore for efficient resource pooling and tracking.
"""

import logging
import simpy
from typing import Dict, List, Tuple, Any, Optional
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from dataclasses import dataclass
from datetime import datetime

from ..utils.distribution_utils import generate_from_distribution

logger = logging.getLogger(__name__)


@dataclass
class Resource:
    """Represents a resource with all its attributes"""
    id: int
    table: str
    type: str
    attributes: Dict[str, Any]
    
    def __getitem__(self, key):
        """Allow dict-like access for compatibility"""
        if key == 'id':
            return self.id
        elif key == 'table':
            return self.table
        elif key == 'type':
            return self.type
        else:
            return self.attributes.get(key)
    
    def get(self, key, default=None):
        """Dict-like get method"""
        try:
            return self[key]
        except KeyError:
            return default


class ResourceManager:
    """
    Manages resources for the event-based simulation using FilterStore.
    
    Each resource in the database is represented as an object in the FilterStore,
    allowing for individual tracking and flexible filtering.
    """
    
    def __init__(self, env, engine, db_path, db_config=None):
        """
        Initialize the resource manager
        
        Args:
            env: SimPy environment
            engine: SQLAlchemy engine
            db_path: Path to the SQLite database
            db_config: Optional database configuration
        """
        self.env = env
        self.engine = engine
        self.db_path = db_path
        self.db_config = db_config
        
        # Main resource store
        self.resource_store = simpy.FilterStore(env)
        
        # Track resource allocations for statistics
        self.allocation_history = []
        self.resource_utilization = {}
        
        # Track current allocations by event
        self.event_allocations = {}  # event_id -> List[Resource]
        
        # Track all resources by ID for type lookup
        self.all_resources = {}  # resource_key -> Resource
        
    def get_resource_table(self, event_sim):
        """
        Get the resource table name from event simulation configuration or database config
        
        Args:
            event_sim: Event simulation configuration
            
        Returns:
            Name of the resource table or None if not found
        """
        if not event_sim:
            return None
            
        # Try to get from simulation config
        if event_sim.table_specification and event_sim.table_specification.resource_table:
            return event_sim.table_specification.resource_table
            
        # Try to find from database config based on table type
        if hasattr(self, 'db_config') and self.db_config:
            for entity in self.db_config.entities:
                if entity.type == 'resource':
                    return entity.name
                    
        return None
    
    def setup_resources(self, event_sim):
        """
        Set up resources by loading them from the database into the FilterStore
        
        Args:
            event_sim: Event simulation configuration
        """
        if not event_sim:
            return
            
        resource_table = self.get_resource_table(event_sim)
        if not resource_table:
            logger.error("Could not determine resource table name. Resources will not be set up.")
            return
        
        with Session(self.engine) as session:
            try:
                # Get table columns to find the resource type column
                inspector = inspect(self.engine)
                columns = inspector.get_columns(resource_table)
                column_names = [col['name'] for col in columns]
                
                # Find the resource type column
                resource_type_column = self._find_resource_type_column(column_names)
                if not resource_type_column:
                    logger.error(f"Could not find resource type column in table {resource_table}")
                    return
                
                logger.info(f"Using '{resource_type_column}' as resource type column")
                
                # Get all resources from the database
                sql_query = text(f"SELECT * FROM {resource_table}")
                result = session.execute(sql_query)
                
                # Add each resource to the FilterStore
                resource_count = 0
                resource_types = set()
                
                for row in result:
                    row_dict = dict(row._mapping)
                    
                    # Create a Resource object
                    resource = Resource(
                        id=row_dict.get('id'),
                        table=resource_table,
                        type=row_dict.get(resource_type_column, 'unknown'),
                        attributes=row_dict
                    )
                    
                    # Add to the store
                    self.resource_store.put(resource)
                    resource_count += 1
                    resource_types.add(resource.type)
                    
                    # Store resource for type lookup
                    resource_key = f"{resource_table}_{resource.id}"
                    self.all_resources[resource_key] = resource
                    
                    # Initialize utilization tracking
                    self.resource_utilization[resource_key] = {
                        'total_busy_time': 0,
                        'allocation_count': 0,
                        'last_allocated': None,
                        'last_released': None
                    }
                
                logger.info(f"Loaded {resource_count} resources of {len(resource_types)} types into FilterStore")
                logger.info(f"Resource types: {', '.join(sorted(resource_types))}")
                
            except Exception as e:
                logger.error(f"Error setting up resources from table {resource_table}: {e}")
                import traceback
                logger.error(traceback.format_exc())
    
    def _find_resource_type_column(self, column_names: List[str]) -> Optional[str]:
        """
        Find the column that represents resource type
        
        Args:
            column_names: List of column names in the resource table
            
        Returns:
            Name of the resource type column or None
        """
        # Common names for resource type columns
        common_names = ['role', 'type', 'resource_type', 'category', 'skill', 'position']
        
        # First, look for exact matches
        for name in common_names:
            if name in column_names:
                return name
        
        # Then look for columns containing these words
        for col in column_names:
            col_lower = col.lower()
            for name in common_names:
                if name in col_lower:
                    return col
        
        # Default fallback
        logger.warning("Could not find resource type column, using 'role' as default")
        return 'role' if 'role' in column_names else None
    
    def allocate_resources(self, event_id: int, requirements: List[Dict[str, Any]]):
        """
        Allocate resources for an event based on requirements
        
        Args:
            event_id: ID of the event requesting resources
            requirements: List of resource requirements
            
        Yields:
            When all required resources are allocated
        """
        allocated_resources = []
        allocation_start_time = self.env.now
        
        try:
            for req in requirements:
                resource_table = req.get('resource_table')
                resource_value = req.get('value')
                count = req.get('count', 1)
                
                # Handle dynamic count
                if isinstance(count, dict) and 'distribution' in count:
                    count = int(round(generate_from_distribution(count['distribution'])))
                else:
                    count = int(count)
                
                if count <= 0:
                    continue
                
                logger.debug(f"Event {event_id} requesting {count} resources of type {resource_table}.{resource_value}")
                
                # Request resources from the FilterStore
                for i in range(count):
                    # Define filter function for this resource type
                    def resource_filter(r, table=resource_table, value=resource_value):
                        return r.table == table and r.type == value
                    
                    # Get a resource matching the criteria
                    resource = yield self.resource_store.get(resource_filter)
                    allocated_resources.append(resource)
                    
                    # Track allocation
                    resource_key = f"{resource.table}_{resource.id}"
                    self.resource_utilization[resource_key]['allocation_count'] += 1
                    self.resource_utilization[resource_key]['last_allocated'] = allocation_start_time
                    
                    logger.debug(f"Allocated resource {resource_key} (type: {resource.type}) to event {event_id}")
            
            # Store the allocation for this event
            self.event_allocations[event_id] = allocated_resources
            
            # Record allocation in history
            self.allocation_history.append({
                'event_id': event_id,
                'timestamp': allocation_start_time,
                'resources': [(r.table, r.id, r.type) for r in allocated_resources],
                'action': 'allocate'
            })
            
            logger.info(f"Successfully allocated {len(allocated_resources)} resources to event {event_id}")
            
        except simpy.Interrupt:
            # If interrupted, release any resources we managed to allocate
            logger.warning(f"Resource allocation interrupted for event {event_id}")
            for resource in allocated_resources:
                self.resource_store.put(resource)
            raise
    
    def release_resources(self, event_id: int):
        """
        Release all resources allocated to an event
        
        Args:
            event_id: ID of the event releasing resources
        """
        if event_id not in self.event_allocations:
            logger.warning(f"No resources found for event {event_id} to release")
            return
        
        resources = self.event_allocations[event_id]
        release_time = self.env.now
        
        for resource in resources:
            # Update utilization tracking
            resource_key = f"{resource.table}_{resource.id}"
            util = self.resource_utilization[resource_key]
            
            if util['last_allocated'] is not None:
                busy_duration = release_time - util['last_allocated']
                util['total_busy_time'] += busy_duration
                util['last_released'] = release_time
            
            # Return resource to the store
            self.resource_store.put(resource)
            
            logger.debug(f"Released resource {resource_key} from event {event_id}")
        
        # Record release in history
        self.allocation_history.append({
            'event_id': event_id,
            'timestamp': release_time,
            'resources': [(r.table, r.id, r.type) for r in resources],
            'action': 'release'
        })
        
        # Remove from current allocations
        del self.event_allocations[event_id]
        
        logger.info(f"Released {len(resources)} resources from event {event_id}")
    
    def get_available_resources(self, resource_type: Optional[str] = None) -> List[Resource]:
        """
        Get list of currently available resources
        
        Args:
            resource_type: Optional filter by resource type
            
        Returns:
            List of available resources
        """
        # Note: This is a snapshot and may change immediately after calling
        available = list(self.resource_store.items)
        
        if resource_type:
            available = [r for r in available if r.type == resource_type]
        
        return available
    
    def get_utilization_stats(self) -> Dict[str, Any]:
        """
        Get resource utilization statistics
        
        Returns:
            Dictionary of utilization statistics
        """
        stats = {
            'total_resources': len(self.resource_utilization),
            'currently_allocated': sum(len(resources) for resources in self.event_allocations.values()),
            'total_allocations': len([h for h in self.allocation_history if h['action'] == 'allocate']),
            'by_resource': {},
            'by_type': {}
        }
        
        # Calculate per-resource statistics
        type_stats = {}
        
        for resource_key, util in self.resource_utilization.items():
            # Calculate utilization percentage
            if self.env.now > 0:
                # Add current busy time if resource is still allocated
                current_busy = 0
                if util['last_allocated'] and (not util['last_released'] or 
                                              util['last_allocated'] > util['last_released']):
                    current_busy = self.env.now - util['last_allocated']
                
                total_busy = util['total_busy_time'] + current_busy
                utilization_pct = (total_busy / self.env.now) * 100
            else:
                utilization_pct = 0
            
            stats['by_resource'][resource_key] = {
                'allocation_count': util['allocation_count'],
                'total_busy_time': util['total_busy_time'],
                'utilization_percentage': round(utilization_pct, 2)
            }
            
            # Aggregate by type
            # Get resource type from stored resource information
            resource_type = 'unknown'
            if resource_key in self.all_resources:
                resource_type = self.all_resources[resource_key].type
            
            if resource_type not in type_stats:
                type_stats[resource_type] = {
                    'count': 0,
                    'total_allocations': 0,
                    'total_busy_time': 0
                }
            
            type_stats[resource_type]['count'] += 1
            type_stats[resource_type]['total_allocations'] += util['allocation_count']
            type_stats[resource_type]['total_busy_time'] += util['total_busy_time']
        
        # Calculate type-level statistics
        for rtype, tstats in type_stats.items():
            if self.env.now > 0 and tstats['count'] > 0:
                avg_utilization = (tstats['total_busy_time'] / (self.env.now * tstats['count'])) * 100
            else:
                avg_utilization = 0
            
            stats['by_type'][rtype] = {
                'count': tstats['count'],
                'total_allocations': tstats['total_allocations'],
                'average_utilization_percentage': round(avg_utilization, 2)
            }
        
        return stats
    
    def get_allocation_history(self, event_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get resource allocation history
        
        Args:
            event_id: Optional filter by specific event
            
        Returns:
            List of allocation history entries
        """
        if event_id is not None:
            return [h for h in self.allocation_history if h['event_id'] == event_id]
        return self.allocation_history.copy()