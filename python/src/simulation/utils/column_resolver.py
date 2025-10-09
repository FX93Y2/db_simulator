"""
Column resolver utility for mapping column types to actual column names.

This module provides strict type-based column resolution with NO fallback to conventions.
Every column must be properly typed in the database configuration.
"""

import logging
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..config_parser.db_parser import DatabaseConfig

logger = logging.getLogger(__name__)


class ColumnResolver:
    """
    Strict column resolver that maps semantic column types to actual column names.
    
    NO FALLBACKS - every column must be properly typed in db_config.
    This ensures explicit, configuration-driven column resolution.
    """
    
    def __init__(self, db_config: 'DatabaseConfig'):
        """
        Initialize column resolver.
        
        Args:
            db_config: Database configuration containing entity definitions
            
        Raises:
            ValueError: If db_config is None or invalid
        """
        if not db_config:
            raise ValueError("db_config is required for ColumnResolver - no fallback supported")
        
        self.db_config = db_config
        self._cache = {}
        self.logger = logger
        
    def get_primary_key(self, table_name: str) -> str:
        """
        Get primary key column name for a table.
        
        Args:
            table_name: Name of the table
            
        Returns:
            Name of the primary key column
            
        Raises:
            ValueError: If no column with type='pk' is found
        """
        pk = self.get_column_by_type(table_name, 'pk')
        if not pk:
            raise ValueError(
                f"Table '{table_name}' has no column with type='pk'. "
                f"Every table must have exactly one primary key column defined."
            )
        return pk

    def get_entity_fk_column(self, table_name: str) -> str:
        """
        Get entity foreign key column in a table.
        
        Args:
            table_name: Name of the table
            
        Returns:
            Name of the entity FK column
            
        Raises:
            ValueError: If no column with type='entity_id' is found
        """
        col = self.get_column_by_type(table_name, 'entity_id')
        if not col:
            raise ValueError(
                f"Table '{table_name}' has no column with type='entity_id'. "
                f"Tables referencing entities must have an entity FK column defined."
            )
        return col

    def get_event_fk_column(self, table_name: str) -> str:
        """
        Get event foreign key column in a table.
        
        Args:
            table_name: Name of the table
            
        Returns:
            Name of the event FK column
            
        Raises:
            ValueError: If no column with type='event_id' is found
        """
        col = self.get_column_by_type(table_name, 'event_id')
        if not col:
            raise ValueError(
                f"Table '{table_name}' has no column with type='event_id'. "
                f"Tables referencing events must have an event FK column defined."
            )
        return col

    def get_resource_fk_column(self, table_name: str) -> str:
        """
        Get resource foreign key column in a table.
        
        Args:
            table_name: Name of the table
            
        Returns:
            Name of the resource FK column
            
        Raises:
            ValueError: If no column with type='resource_id' is found
        """
        col = self.get_column_by_type(table_name, 'resource_id')
        if not col:
            raise ValueError(
                f"Table '{table_name}' has no column with type='resource_id'. "
                f"Tables referencing resources must have a resource FK column defined."
            )
        return col

    def get_event_type_column(self, table_name: str) -> str:
        """
        Get event type column in an event table.
        
        Args:
            table_name: Name of the event table
            
        Returns:
            Name of the event type column
            
        Raises:
            ValueError: If no column with type='event_type' is found
        """
        col = self.get_column_by_type(table_name, 'event_type')
        if not col:
            raise ValueError(
                f"Event table '{table_name}' has no column with type='event_type'. "
                f"Event tables must have a column marking the event type."
            )
        return col
        
    def get_column_by_type(self, table_name: str, col_type: str) -> Optional[str]:
        """
        Get column name by its semantic type.
        
        Args:
            table_name: Name of the table
            col_type: Semantic type of the column (e.g., 'pk', 'entity_id')
            
        Returns:
            Column name if found, None otherwise
            
        Raises:
            ValueError: If table is not found in configuration
        """
        cache_key = f"{table_name}:{col_type}"
        if cache_key in self._cache:
            return self._cache[cache_key]
            
        table = self._get_table_config(table_name)
        if not table:
            raise ValueError(
                f"Table '{table_name}' not found in database configuration. "
                f"All referenced tables must be defined in the db_config."
            )
            
        # Search for column with matching type
        # Support parameterized types like decimal(10,2) by matching base type
        for attr in table.attributes:
            attr_type = attr.type
            base_type = attr_type.split('(')[0] if isinstance(attr_type, str) and '(' in attr_type else attr_type
            if base_type == col_type:
                self.logger.debug(f"Resolved {table_name}.{col_type} -> {attr.name}")
                self._cache[cache_key] = attr.name
                return attr.name
                
        # Not found - cache None to avoid repeated lookups
        self._cache[cache_key] = None
        return None
        
    def _get_table_config(self, table_name: str):
        """
        Get table configuration from database config.
        
        Args:
            table_name: Name of the table to find
            
        Returns:
            Table configuration object if found, None otherwise
        """
        if not hasattr(self.db_config, 'entities'):
            return None
            
        for entity in self.db_config.entities:
            if entity.name == table_name:
                return entity
                
        return None

    def validate_table_types(self, table_name: str, required_types: list) -> bool:
        """
        Validate that a table has all required column types.
        
        Args:
            table_name: Name of the table to validate
            required_types: List of required column types
            
        Returns:
            True if all types are present
            
        Raises:
            ValueError: If any required type is missing
        """
        table = self._get_table_config(table_name)
        if not table:
            raise ValueError(f"Table '{table_name}' not found in configuration")
            
        # Compare on base types to handle parameterized types like decimal(10,2)
        found_types = {(
            t.split('(')[0] if isinstance(t, str) and '(' in t else t
        ) for t in (attr.type for attr in table.attributes)}
        missing_types = set(required_types) - found_types
        
        if missing_types:
            raise ValueError(
                f"Table '{table_name}' is missing required column types: {sorted(missing_types)}. "
                f"Found types: {sorted(found_types)}"
            )
            
        return True
