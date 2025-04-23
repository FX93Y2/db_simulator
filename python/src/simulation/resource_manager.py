"""
Resource management for DB Simulator.

This module handles resource allocation and management for the simulation.
"""

import logging
import simpy
from typing import Dict, List, Tuple, Any, Optional
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from ..utils.distribution_utils import generate_from_distribution

logger = logging.getLogger(__name__)

class ResourceManager:
    """
    Manages resources for the event-based simulation.
    
    Handles resource initialization, allocation, and release during simulation.
    """
    
    def __init__(self, env, engine, db_path):
        """
        Initialize the resource manager
        
        Args:
            env: SimPy environment
            engine: SQLAlchemy engine
            db_path: Path to the SQLite database
        """
        self.env = env
        self.engine = engine
        self.db_path = db_path
        
        # Initialize resources
        self.resources = {}
        self.resource_types = {}
        
        # Dictionary to track allocated resources
        self.allocated_resources = {}
    
    def setup_resources(self, event_sim):
        """
        Set up resources based on configuration
        
        Args:
            event_sim: Event simulation configuration
        """
        if not event_sim:
            return
            
        resource_table = event_sim.table_specification.resource_table
        
        # First find the resource_type column
        with Session(self.engine) as session:
            # Get all resources from the database
            # Find the resource_type column first
            inspector = inspect(self.engine)
            columns = inspector.get_columns(resource_table)
            
            # Look for a column with type 'resource_type' or a column named 'role' (default fallback)
            resource_type_column = None
            for column in columns:
                # Check if this is a resource_type column
                table_query = text(f"PRAGMA table_info({resource_table})")
                columns_info = session.execute(table_query).fetchall()
                
                for col_info in columns_info:
                    # SQLite pragmas return column name at index 1
                    if col_info[1] == column['name']:
                        resource_type_column = column['name']
                        break
                
                if resource_type_column:
                    break
            
            if not resource_type_column:
                logger.error(f"Could not find resource type column in table {resource_table}")
                return
                
            # Get all resources from the database
            sql_query = text(f"SELECT id, {resource_type_column} FROM {resource_table}")
            result = session.execute(sql_query)
            resources_by_type = {}
            
            for row in result:
                resource_type = row[1]
                if resource_type not in resources_by_type:
                    resources_by_type[resource_type] = []
                resources_by_type[resource_type].append(row[0])
            
            # Create SimPy resources for each resource ID
            for resource_type, resource_ids in resources_by_type.items():
                for resource_id in resource_ids:
                    resource_key = f"{resource_table}_{resource_id}"
                    self.resources[resource_key] = simpy.Resource(self.env, capacity=1)
                    self.resource_types[resource_key] = resource_type
            
            logger.info(f"Set up {len(self.resources)} resources of {len(resources_by_type)} types")
    
    def determine_required_resources(self, event_id: int, event_sim) -> List[str]:
        """
        Determine the required resources for an event
        
        Args:
            event_id: Event ID
            event_sim: Event simulation configuration
            
        Returns:
            List of resource keys
        """
        if not event_sim:
            return []
            
        required_resources = []
        
        # Create a process-specific engine to avoid connection sharing issues
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Get the event type to determine specific resource requirements
                event_table = event_sim.table_specification.event_table
                sql_query = text(f"SELECT type FROM {event_table} WHERE id = {event_id}")
                result = session.execute(sql_query)
                event_type = None
                for row in result:
                    event_type = row[0]
                    break
                    
                # Check if event sequence has specific resource requirements for this event type
                if event_sim.event_sequence and event_type:
                    
                    # Find the event type definition in the event sequence configuration
                    event_type_def = None
                    for et in event_sim.event_sequence.event_types:
                        if et.name == event_type:
                            event_type_def = et
                            break
                    
                    if event_type_def and event_type_def.resource_requirements:
                        # Use event type-specific resource requirements
                        for req in event_type_def.resource_requirements:
                            resource_table = req.resource_table
                            resource_value = req.value
                            
                            # Determine how many resources of this type are needed
                            count = req.count
                            if isinstance(count, dict) and 'distribution' in count:
                                count = int(round(generate_from_distribution(count['distribution'])))
                            else:
                                count = int(count)
                            
                            # Skip if no resources needed
                            if count <= 0:
                                continue
                            
                            # Get all resources of this type
                            # First get the resource_type column
                            resource_type_column = None
                            inspector = inspect(self.engine)
                            columns = inspector.get_columns(resource_table)
                            
                            # Look for a resource_type column
                            for column in columns:
                                table_query = text(f"PRAGMA table_info({resource_table})")
                                columns_info = session.execute(table_query).fetchall()
                                
                                for col_info in columns_info:
                                    if col_info[1] == column['name']:
                                        resource_type_column = column['name']
                                        break
                                
                                if resource_type_column:
                                    break
                            
                            # If we still haven't found it, use 'type' or 'role' as fallback
                            if not resource_type_column:
                                for fallback in ['type', 'role', 'resource_type', 'category']:
                                    if fallback in [col['name'] for col in columns]:
                                        resource_type_column = fallback
                                        break
                            
                            if not resource_type_column:
                                logger.error(f"Could not find resource type column in table {resource_table}")
                                continue
                            
                            # Get all resources with the matching value
                            sql_query = text(f"""
                                SELECT id FROM {resource_table} 
                                WHERE {resource_type_column} = '{resource_value}'
                            """)
                            result = session.execute(sql_query)
                            matching_resources = [f"{resource_table}_{row[0]}" for row in result]
                            
                            # Add up to count resources of this type
                            added = 0
                            for resource_key in matching_resources:
                                if resource_key in self.resources and added < count:
                                    required_resources.append(resource_key)
                                    added += 1
                                    
                            if added < count:
                                logger.warning(f"Only found {added} of {count} required resources of type {resource_value}")
                
                # If no specific requirements, fall back to default
                if not required_resources:
                    # Default to using any available resource
                    resource_table = event_sim.table_specification.resource_table
                    for resource_key in self.resources:
                        if resource_key.startswith(f"{resource_table}_"):
                            required_resources.append(resource_key)
                            break
        except Exception as e:
            logger.error(f"Error determining required resources for event {event_id}: {str(e)}")
        finally:
            process_engine.dispose()
        
        return required_resources
    
    def find_resources(self, session, resource_table: str, resource_type: str, count: int) -> List[Tuple[int, str]]:
        """
        Find available resources matching the given type
        
        Args:
            session: SQLAlchemy session
            resource_table: Name of the resource table
            resource_type: Type of resource to find
            count: Number of resources to allocate
            
        Returns:
            List of tuples (resource_id, resource_table)
        """
        try:
            # Find the resource type column
            resource_type_column = self.find_resource_type_column(session, resource_table)
            if not resource_type_column:
                logger.error(f"Could not find resource type column in {resource_table}")
                return []
                
            logger.debug(f"Using resource type column: {resource_type_column}")
            
            # Get resources of the specified type that aren't already allocated
            resources = []
            
            # Check which resources are already allocated
            allocated_resources = set(self.allocated_resources.keys())
            
            # Query for resources of the specified type
            sql_query = text(f"SELECT id FROM {resource_table} WHERE {resource_type_column} = '{resource_type}'")
            result = session.execute(sql_query).fetchall()
            
            if not result:
                logger.warning(f"No resources found of type {resource_type} in {resource_table}")
                return []
                
            # Filter out already allocated resources
            available_resources = []
            for row in result:
                resource_id = row[0]
                resource_key = f"{resource_table}_{resource_id}"
                if resource_key not in allocated_resources:
                    available_resources.append(resource_id)
                    
            # Check if we have enough resources
            if len(available_resources) < count:
                logger.warning(f"Not enough resources available of type {resource_type}. Needed: {count}, Available: {len(available_resources)}")
                return []
                
            # Allocate the resources
            for i in range(count):
                resource_id = available_resources[i]
                resource_key = f"{resource_table}_{resource_id}"
                self.allocated_resources[resource_key] = resource_type
                resources.append((resource_id, resource_table))
                
            logger.debug(f"Allocated {count} resources of type {resource_type} from {resource_table}")
            return resources
            
        except Exception as e:
            logger.error(f"Error finding resources: {str(e)}")
            return []
            
    def release_resource(self, resource_table: str, resource_id: int):
        """
        Release an allocated resource
        
        Args:
            resource_table: Name of the resource table
            resource_id: ID of the resource to release
        """
        try:
            resource_key = f"{resource_table}_{resource_id}"
            if resource_key in self.allocated_resources:
                del self.allocated_resources[resource_key]
                logger.debug(f"Released resource {resource_key}")
            else:
                logger.warning(f"Attempted to release resource {resource_key} that wasn't allocated")
        except Exception as e:
            logger.error(f"Error releasing resource: {str(e)}")
            
    def find_resource_type_column(self, session, resource_table: str) -> str:
        """
        Find the column used for resource types in the resource table
        
        Args:
            session: SQLAlchemy session
            resource_table: Name of the resource table
            
        Returns:
            Name of the column used for resource types
        """
        try:
            # Common column names for resource types
            common_names = ['role', 'type', 'resource_type', 'category']
            
            # Get all column names for this table
            inspector = inspect(session.get_bind())
            columns = [col['name'] for col in inspector.get_columns(resource_table)]
            
            # Try to find a matching column
            for name in common_names:
                if name in columns:
                    return name
                    
            # If no match found, return the first one in our list that makes sense
            return 'role'  # Default fallback
        except Exception as e:
            logger.error(f"Error finding resource type column: {str(e)}")
            return 'role'  # Default fallback