"""
Database table population with synthetic data.

This module handles the population of database tables
with synthetic data based on entity configurations.
"""

import logging
import dataclasses
from typing import List, Any

from ...config_parser import DatabaseConfig, Entity, Attribute
from ...utils.data_generation import generate_attribute_value

logger = logging.getLogger(__name__)


class DataPopulator:
    """Handles population of database tables with synthetic data."""
    
    def __init__(self):
        """Initialize the data populator."""
        pass
    
    def populate_tables(self, models: dict, config: DatabaseConfig, session, 
                       dynamic_entity_tables: List[str] = None):
        """
        Populate tables with data based on configuration
        
        Args:
            models: Dictionary of SQLAlchemy model classes
            config: Database configuration
            session: SQLAlchemy session
            dynamic_entity_tables: List of tables to skip during population
        """
        self.models = models
        self.session = session
        self.dynamic_entity_tables = dynamic_entity_tables or []
        
        # Sort entities to handle dependencies (this will be moved to dependency_sorter)
        from ..schema import DependencySorter
        dependency_sorter = DependencySorter()
        sorted_entities = dependency_sorter.sort_entities_by_dependencies(config)
        
        # Populate all tables in sorted order
        for entity in sorted_entities:
            # Skip dynamic entity/event tables
            if entity.name in self.dynamic_entity_tables:
                continue
            self._populate_entity(entity)
    
    def _populate_entity(self, entity: Entity):
        """
        Populate table with data based on entity configuration
        
        Args:
            entity: Entity configuration
        """
        model_class = self.models[entity.name]
        
        # Determine number of rows to generate
        num_rows = self._get_num_rows(entity)
        
        logger.info(f"Generating {num_rows} rows for table {entity.name}")
        
        # Generate rows
        for i in range(num_rows):
            row_data = {}
            
            # Generate data for each attribute
            for attr in entity.attributes:
                # Skip primary key for auto-increment
                if attr.is_primary_key:
                    continue

                # Handle new "foreign_key" generator type
                if attr.generator and getattr(attr.generator, "type", None) == "foreign_key":
                    # Get parent table and column
                    if not attr.ref:
                        logger.error(f"Foreign key attribute '{attr.name}' in table '{entity.name}' missing 'ref'. Assigning None.")
                        row_data[attr.name] = None
                    else:
                        ref_table, ref_column = attr.ref.split('.')
                        parent_model = self.models[ref_table]
                        parent_ids = self.session.query(getattr(parent_model, ref_column)).all()
                        parent_ids = [id[0] for id in parent_ids]
                        
                        if not parent_ids:
                            logger.warning(f"No rows in parent table {ref_table}, assigning None to FK '{attr.name}' in '{entity.name}'")
                            row_data[attr.name] = None
                        else:
                            # Use ForeignKeyResolver for proper formula-based selection
                            from .foreign_key import ForeignKeyResolver
                            fk_resolver = ForeignKeyResolver()
                            formula = getattr(attr.generator, 'formula', None)
                            row_data[attr.name] = fk_resolver.select_parent_id(parent_ids, formula)
                # Generate data based on other generator configuration
                elif attr.generator:
                    row_data[attr.name] = self._generate_attribute_value(attr, i)
                # Handle foreign keys without generator
                elif attr.is_foreign_key:
                    logger.error(f"Missing generator for foreign key '{attr.name}' in table '{entity.name}'. Assigning None.")
                    row_data[attr.name] = None
                # Default value for other attributes without generator - Log warning
                else:
                    logger.warning(f"Missing generator for attribute '{attr.name}' in table '{entity.name}'. Using placeholder.")
                    row_data[attr.name] = f"MissingGenerator_{attr.name}_{i}"
            
            # Create and add row
            # Ensure row_data doesn't contain keys not present in the model if assigning None to FKs caused issues
            valid_keys = {col.name for col in model_class.__table__.columns}
            filtered_row_data = {k: v for k, v in row_data.items() if k in valid_keys}
            
            try:
                 row = model_class(**filtered_row_data)
                 self.session.add(row)
            except Exception as e:
                 logger.error(f"Error creating row for {entity.name} with data {filtered_row_data}: {e}")

            self.session.add(row)
        
        # Commit after each table to make IDs available for foreign keys
        self.session.commit()
    
    def _get_num_rows(self, entity: Entity) -> int:
        """
        Determine number of rows to generate for an entity
        
        Args:
            entity: Entity configuration
            
        Returns:
            Number of rows to generate
        """
        # Handle fixed number of rows
        if isinstance(entity.rows, int):
            return entity.rows
        
        # Handle 'n/a' for event/entity tables
        if entity.rows == 'n/a':
            # For event/entity tables, we'll generate rows based on relationships
            # But here we're just skipping them for now
            return 0
        
        # Default value if rows is not specified
        return 10
    
    def _generate_attribute_value(self, attr: Attribute, row_index: int) -> Any:
        """
        Generate value for an attribute using the utility function.
        
        Args:
            attr: Attribute configuration object
            row_index: Index of current row
            
        Returns:
            Generated value
        """
        # Convert Attribute object's generator to dictionary for the utility function
        attr_config_dict = {
            'name': attr.name,
            'generator': dataclasses.asdict(attr.generator) if attr.generator else None
            # Add other necessary fields from attr if needed by the utility function
        }
        
        # Note: Pass 0-based row_index to the utility function
        return generate_attribute_value(attr_config_dict, row_index)