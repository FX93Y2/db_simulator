"""
Entity Attribute Manager for DB Simulator.

This module manages custom entity attributes during simulation,
supporting Arena-style Assign module functionality.
"""

import logging
from typing import Dict, Union, Optional, Any
from threading import Lock

logger = logging.getLogger(__name__)


class EntityAttributeManager:
    """
    Manages custom attributes for entities during simulation.
    
    Provides thread-safe storage and retrieval of entity attributes
    assigned by Assign modules during simulation execution.
    """
    
    def __init__(self):
        """Initialize the entity attribute manager."""
        # Storage: {entity_id: {attribute_name: value}}
        self._entity_attributes: Dict[int, Dict[str, Union[str, int, float]]] = {}
        self._lock = Lock()  # Thread safety for concurrent access
        
    def set_attribute(self, entity_id: int, attribute_name: str, value: Union[str, int, float]) -> bool:
        """
        Set an attribute value for an entity.
        
        Args:
            entity_id: Entity ID
            attribute_name: Name of the attribute to set
            value: Value to assign (string, int, or float only)
            
        Returns:
            True if attribute was set successfully, False otherwise
        """
        if not isinstance(value, (str, int, float)):
            logger.error(f"Invalid attribute value type for entity {entity_id}, attribute '{attribute_name}': {type(value)}. Only str, int, float supported.")
            return False
            
        with self._lock:
            if entity_id not in self._entity_attributes:
                self._entity_attributes[entity_id] = {}
            
            self._entity_attributes[entity_id][attribute_name] = value
            logger.debug(f"Set attribute '{attribute_name}' = {value} for entity {entity_id}")
            return True
    
    def get_attribute(self, entity_id: int, attribute_name: str) -> Optional[Union[str, int, float]]:
        """
        Get an attribute value for an entity.
        
        Args:
            entity_id: Entity ID
            attribute_name: Name of the attribute to retrieve
            
        Returns:
            Attribute value if exists, None otherwise
        """
        with self._lock:
            if entity_id not in self._entity_attributes:
                return None
            
            return self._entity_attributes[entity_id].get(attribute_name)
    
    def has_attribute(self, entity_id: int, attribute_name: str) -> bool:
        """
        Check if an entity has a specific attribute.
        
        Args:
            entity_id: Entity ID
            attribute_name: Name of the attribute to check
            
        Returns:
            True if attribute exists, False otherwise
        """
        with self._lock:
            if entity_id not in self._entity_attributes:
                return False
            
            return attribute_name in self._entity_attributes[entity_id]
    
    def get_all_attributes(self, entity_id: int) -> Dict[str, Union[str, int, float]]:
        """
        Get all attributes for an entity.
        
        Args:
            entity_id: Entity ID
            
        Returns:
            Dictionary of attribute name -> value pairs (empty if no attributes)
        """
        with self._lock:
            if entity_id not in self._entity_attributes:
                return {}
            
            return self._entity_attributes[entity_id].copy()
    
    def clear_entity_attributes(self, entity_id: int) -> bool:
        """
        Clear all attributes for a specific entity.
        
        Args:
            entity_id: Entity ID
            
        Returns:
            True if entity had attributes to clear, False if no attributes existed
        """
        with self._lock:
            if entity_id in self._entity_attributes:
                del self._entity_attributes[entity_id]
                logger.debug(f"Cleared all attributes for entity {entity_id}")
                return True
            return False
    
    def get_entity_count(self) -> int:
        """
        Get the number of entities with attributes.
        
        Returns:
            Count of entities that have at least one attribute
        """
        with self._lock:
            return len(self._entity_attributes)
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about entity attributes.
        
        Returns:
            Dictionary with statistics about attribute usage
        """
        with self._lock:
            total_entities = len(self._entity_attributes)
            total_attributes = sum(len(attrs) for attrs in self._entity_attributes.values())
            
            # Count unique attribute names
            unique_attr_names = set()
            for attrs in self._entity_attributes.values():
                unique_attr_names.update(attrs.keys())
            
            return {
                "entities_with_attributes": total_entities,
                "total_attributes": total_attributes,
                "unique_attribute_names": len(unique_attr_names),
                "attribute_names": sorted(list(unique_attr_names))
            }
    
    def clear_all(self) -> None:
        """Clear all entity attributes (useful for cleanup)."""
        with self._lock:
            cleared_count = len(self._entity_attributes)
            self._entity_attributes.clear()
            if cleared_count > 0:
                logger.info(f"Cleared attributes for {cleared_count} entities")