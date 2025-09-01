"""
Inventory helper functions for DB Simulator.

This module provides helper functions for inventory management operations,
including inventory availability checking for decision-making in simulation flows.
These functions work with bridge table architecture for relational inventory management.
"""

import logging
from typing import Union
from sqlalchemy import text

logger = logging.getLogger(__name__)


class InventoryHelpers:
    """
    Helper functions for inventory operations in simulation expressions.
    
    These functions work with bridge table architecture and provide utilities
    for inventory availability checking used in decision steps.
    """
    
    def __init__(self, engine=None):
        """
        Initialize inventory helpers.
        
        Args:
            engine: SQLAlchemy engine for database operations (optional)
        """
        self.engine = engine
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    def check_inventory(self, entity_id: Union[int, str], 
                       bridge_table: str,
                       inventory_table: str) -> bool:
        """
        Check if all inventory items in bridge table have sufficient quantity available.
        
        This function checks inventory availability using the bridge table approach:
        - Queries bridge table to get required inventory items and quantities for an entity
        - Checks each item against the inventory table for availability
        
        Args:
            entity_id: Entity ID to check inventory for
            bridge_table: Name of bridge table (e.g., 'OrderBooks')
            inventory_table: Name of inventory table (e.g., 'Book')
            
        Returns:
            True if all items have sufficient stock, False otherwise
        """
        try:
            entity_id = int(entity_id)
            
            if not self.engine:
                self.logger.error("CHECK_INVENTORY: No database engine provided")
                return False
            
            # Query bridge table to get required inventory for this entity
            with self.engine.connect() as connection:
                bridge_query = text(f'''
                    SELECT inventory_id, quantity_needed 
                    FROM "{bridge_table}" 
                    WHERE entity_id = :entity_id
                ''')
                
                bridge_results = connection.execute(bridge_query, {"entity_id": entity_id}).fetchall()
                
                if not bridge_results:
                    self.logger.debug(f"CHECK_INVENTORY: No inventory requirements for entity {entity_id}")
                    return True
                
                # Check each required item against available inventory
                for row in bridge_results:
                    inventory_id, quantity_needed = row
                    if not self._check_single_item(inventory_table, inventory_id, quantity_needed):
                        self.logger.debug(f"CHECK_INVENTORY: Insufficient stock for item {inventory_id} (need {quantity_needed})")
                        return False
                
                self.logger.debug(f"CHECK_INVENTORY: All {len(bridge_results)} items available for entity {entity_id}")
                return True
            
        except Exception as e:
            self.logger.error(f"Error in CHECK_INVENTORY: {e}")
            return False
    
    
    
    
    def _check_single_item(self, inventory_table: str, item_id: Union[int, str], needed_quantity: int) -> bool:
        """
        Check if a single inventory item has sufficient quantity.
        
        Args:
            inventory_table: Name of the inventory table
            item_id: ID of the item to check
            needed_quantity: Quantity needed
            
        Returns:
            True if sufficient quantity available, False otherwise
        """
        try:
            with self.engine.connect() as connection:
                query = text(f'SELECT quantity FROM "{inventory_table}" WHERE id = :item_id')
                result = connection.execute(query, {"item_id": item_id})
                row = result.fetchone()
                
                if row:
                    available_quantity = int(row[0])
                    return available_quantity >= needed_quantity
                else:
                    self.logger.warning(f"Item {item_id} not found in {inventory_table}")
                    return False
                    
        except Exception as e:
            self.logger.error(f"Error checking item {item_id} in {inventory_table}: {e}")
            return False