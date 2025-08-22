"""
Entity dependency resolution for database generation.

This module handles topological sorting of entities based on
foreign key dependencies to ensure proper table population order.
"""

import logging
from typing import List, Dict, Set

from ...config_parser import DatabaseConfig, Entity

logger = logging.getLogger(__name__)


class DependencySorter:
    """Handles sorting entities by their foreign key dependencies."""
    
    def __init__(self):
        """Initialize the dependency sorter."""
        pass
    
    def sort_entities_by_dependencies(self, config: DatabaseConfig) -> List[Entity]:
        """
        Sort entities based on dependencies (foreign keys)
        
        Args:
            config: Database configuration containing entities
            
        Returns:
            Sorted list of entities
        """
        # Map entity names to entities
        entity_map = {entity.name: entity for entity in config.entities}
        
        # Build dependency graph
        graph = {}
        for entity in config.entities:
            dependencies = set()
            for attr in entity.attributes:
                if attr.is_foreign_key and attr.ref:
                    ref_table, _ = attr.ref.split('.')
                    dependencies.add(ref_table)
            
            graph[entity.name] = dependencies
        
        # Topological sort
        result = []
        visited = set()
        temp_visited = set()
        
        def visit(node):
            if node in temp_visited:
                raise ValueError(f"Circular dependency detected with entity {node}")
            
            if node not in visited:
                temp_visited.add(node)
                
                for dependency in graph.get(node, set()):
                    visit(dependency)
                
                temp_visited.remove(node)
                visited.add(node)
                result.append(entity_map[node])
        
        for entity_name in graph:
            if entity_name not in visited:
                visit(entity_name)
        
        return result