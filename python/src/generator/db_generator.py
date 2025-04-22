"""
Database generator using SQLAlchemy

Creates database tables and relationships based on configuration,
and populates them with synthetic data.
"""

import os
import logging
import random
import numpy as np
from typing import Dict, List, Any, Optional, Union, Tuple
from pathlib import Path
from datetime import datetime
from ..utils.faker_utils import generate_fake_data
import sqlite3
import dataclasses # Import dataclasses

from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, MetaData, Table, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

from ..config_parser import DatabaseConfig, Entity, Attribute
from ..utils.data_generation import generate_attribute_value

logger = logging.getLogger(__name__)

Base = declarative_base()

class DatabaseGenerator:
    def __init__(self, config: DatabaseConfig, output_dir: str = "output", dynamic_entity_tables: Optional[List[str]] = None):
        self.config = config
        self.output_dir = output_dir
        self.engine = None
        self.session = None
        self.metadata = MetaData()
        self.tables = {}
        self.models = {}
        self.dynamic_entity_tables = dynamic_entity_tables or []
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
    
    def generate(self, db_name: Optional[str] = None) -> str:
        """
        Generate database based on configuration
        
        Args:
            db_name: Name of the database file (without path or extension)
            
        Returns:
            Path to the generated database file (absolute path)
        """
        # Generate database name if not provided
        if not db_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            db_name = f"generated_db_{timestamp}"
        
        # Ensure output directory exists with detailed logging
        try:
            os.makedirs(self.output_dir, exist_ok=True)
            logger.info(f"Ensured output directory exists: {self.output_dir}")
            
            # Check if directory is writable
            if not os.access(self.output_dir, os.W_OK):
                logger.warning(f"Output directory {self.output_dir} is not writable!")
        except Exception as e:
            logger.error(f"Error creating output directory {self.output_dir}: {e}")
            # Try to find an alternative directory
            alt_dir = os.path.abspath('.')
            logger.info(f"Falling back to current directory: {alt_dir}")
            self.output_dir = alt_dir
            os.makedirs(self.output_dir, exist_ok=True)
        
        # Create database file path (ensure it's absolute)
        if os.path.isabs(self.output_dir):
            db_path = os.path.join(self.output_dir, f"{db_name}.db")
        else:
            db_path = os.path.abspath(os.path.join(self.output_dir, f"{db_name}.db"))
        
        logger.info(f"Generating database at absolute path: {db_path}")
        
        # Delete the file if it already exists to ensure we start fresh
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
                logger.info(f"Removed existing database file: {db_path}")
            except Exception as e:
                logger.error(f"Error removing existing database file: {e}")
        
        # Create SQLAlchemy engine with specific flags for better reliability
        connection_string = f"sqlite:///{db_path}"
        self.engine = create_engine(connection_string, echo=False)
        
        # Create tables
        self._create_tables()
        
        # Create session
        Session = sessionmaker(bind=self.engine)
        self.session = Session()
        
        # Populate tables with data
        self._populate_tables()
        
        # Commit and close session
        self.session.commit()
        self.session.close()
        
        # Verify the database file exists and is not empty
        if not os.path.exists(db_path):
            logger.error(f"Database file was not created at expected path: {db_path}")
            
            # Log directory contents for debugging
            try:
                logger.info(f"Contents of directory {self.output_dir}:")
                for f in os.listdir(self.output_dir):
                    logger.info(f"  - {f}")
            except Exception as e:
                logger.error(f"Error listing directory contents: {e}")
                
            # Try connecting to the database directly as a final check
            try:
                import sqlite3
                conn = sqlite3.connect(db_path)
                conn.close()
                logger.info(f"Successfully connected to database despite file check failure")
            except Exception as e:
                logger.error(f"Failed to connect to database: {e}")
        else:
            size = os.path.getsize(db_path)
            logger.info(f"Database generated successfully at {db_path}, size: {size} bytes")
            
            if size == 0:
                logger.warning(f"Database file exists but is empty (0 bytes)")
            
            # Verify the database can be opened
            try:
                import sqlite3
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Check for tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                logger.info(f"Database contains {len(tables)} tables: {[t[0] for t in tables]}")
                
                conn.close()
            except Exception as e:
                logger.error(f"Error verifying database: {e}")
        
        return db_path
    
    def _create_tables(self):
        """Create tables based on configuration"""
        # First pass: Create model classes for all entities
        for entity in self.config.entities:
            self._create_model_class(entity)
        
        # Create all tables
        Base.metadata.create_all(self.engine)
    
    def _create_model_class(self, entity: Entity):
        """
        Create SQLAlchemy model class for an entity
        
        Args:
            entity: Entity configuration
        """
        attrs = {
            '__tablename__': entity.name,
            '__table_args__': {'extend_existing': True}
        }
        
        # Add columns based on attributes
        for attr in entity.attributes:
            column_type = self._get_column_type(attr.type)
            
            # Handle primary key
            if attr.is_primary_key:
                attrs[attr.name] = Column(Integer, primary_key=True)
            
            # Handle foreign key
            elif attr.is_foreign_key and attr.ref:
                ref_table, ref_column = attr.ref.split('.')
                attrs[attr.name] = Column(Integer, ForeignKey(f"{ref_table}.{ref_column}"))
            
            # Handle regular columns
            else:
                attrs[attr.name] = Column(column_type)
        
        # Create model class
        model_class = type(entity.name, (Base,), attrs)
        self.models[entity.name] = model_class
    
    def _get_column_type(self, attr_type: str) -> Any:
        """
        Map attribute type to SQLAlchemy column type
        
        Args:
            attr_type: Attribute type from configuration
            
        Returns:
            SQLAlchemy column type
        """
        type_map = {
            'string': String,
            'int': Integer,
            'pk': Integer,
            'fk': Integer
        }
        
        return type_map.get(attr_type, String)
    
    def _populate_tables(self):
        """Populate tables with data based on configuration"""
        # Sort entities to handle dependencies (foreign keys)
        sorted_entities = self._sort_entities_by_dependencies()
        
        # Populate all tables in sorted order
        for entity in sorted_entities:
            # Skip dynamic entity/event tables
            if entity.name in self.dynamic_entity_tables:
                continue
            self._populate_entity(entity)
    
    def _should_skip_entity_tables(self) -> bool:
        """
        Check if entity and event tables should be skipped
        
        Returns:
            True if entity and event tables should be skipped
        """
        # If dynamic_entity_tables is specified, skip those tables
        if self.dynamic_entity_tables:
            return True
            
        # For backward compatibility, check if any entity has rows='n/a'
        for entity in self.config.entities:
            if entity.rows == 'n/a':
                return True
        
        return False
    
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
                            # Use user-defined distribution if present, else random
                            dist = getattr(attr.generator, "distribution", None)
                            if dist and getattr(dist, "type", None) == "choice" and getattr(dist, "values", None):
                                # Weighted choice among parent_ids
                                import numpy as np
                                weights = getattr(dist, "values", None)
                                if len(weights) == len(parent_ids):
                                    row_data[attr.name] = np.random.choice(parent_ids, p=weights)
                                else:
                                    logger.warning(f"Distribution weights length does not match number of parent_ids for FK '{attr.name}' in '{entity.name}'. Using uniform random assignment.")
                                    row_data[attr.name] = random.choices(parent_ids, k=1)[0]
                            else:
                                # Uniform random assignment if no distribution is provided
                                row_data[attr.name] = random.choices(parent_ids, k=1)[0]
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
    
    # Removed legacy _populate_child_entity logic as foreign key assignment is now handled in _populate_entity with the "foreign_key" generator type.
    
    def _generate_relationship_counts(self, multiplicity: Dict, num_parents: int) -> List[int]:
        """
        Generate counts for one-to-many relationship based on multiplicity configuration
        
        Args:
            multiplicity: Multiplicity configuration from relationship
            num_parents: Number of parent records
            
        Returns:
            List of counts for each parent
        """
        # Check if distribution is specified
        if 'distribution' not in multiplicity:
            # Default to 1 child per parent
            return [1] * num_parents
        
        dist = multiplicity['distribution']
        dist_type = dist.get('type', 'fixed')
        
        # Fixed count
        if dist_type == 'fixed':
            count = dist.get('value', 1)
            return [count] * num_parents
        
        # Normal distribution
        elif dist_type == 'normal':
            mean = dist.get('mean', 3)
            stddev = dist.get('stddev', 1)
            min_val = dist.get('min', 0)
            max_val = dist.get('max', 10)
            
            # Generate random counts from normal distribution
            counts = np.random.normal(mean, stddev, num_parents)
            
            # Clamp to min/max and convert to integers
            counts = np.clip(counts, min_val, max_val)
            counts = np.round(counts).astype(int)
            
            return counts.tolist()
        
        # Uniform distribution
        elif dist_type == 'uniform':
            min_val = dist.get('min', 1)
            max_val = dist.get('max', 5)
            
            # Generate random counts from uniform distribution
            return [random.randint(min_val, max_val) for _ in range(num_parents)]
        
        # Poisson distribution
        elif dist_type == 'poisson':
            lam = dist.get('lambda', 3)
            
            # Generate random counts from poisson distribution
            counts = np.random.poisson(lam, num_parents)
            
            return counts.tolist()
        
        # Default to 1 child per parent
        return [1] * num_parents
    
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
        
    def print_database_stats(self):
        """Print statistics about the generated database"""
        inspector = inspect(self.engine)
        
        logger.info("Database Statistics:")
        
        for table_name in inspector.get_table_names():
            # Create a new connection for executing queries
            with self.engine.connect() as connection:
                # Count rows
                count_query = text(f"SELECT COUNT(*) FROM {table_name}")
                result = connection.execute(count_query).scalar()
                
                logger.info(f"  {table_name}: {result} rows")
                
                # For child tables with foreign keys, show distribution
                foreign_keys = inspector.get_foreign_keys(table_name)
                
                if foreign_keys:
                    for fk in foreign_keys:
                        ref_table = fk['referred_table']
                        ref_column = fk['referred_columns'][0]
                        constrained_column = fk['constrained_columns'][0]
                        
                        # Get distribution of children per parent
                        distribution_query = text(f"""
                        SELECT {constrained_column}, COUNT(*) 
                        FROM {table_name} 
                        GROUP BY {constrained_column}
                        """)
                        distribution = connection.execute(distribution_query).fetchall()
                        
                        # Calculate statistics
                        counts = [count for _, count in distribution]
                        if counts:
                            min_count = min(counts)
                            max_count = max(counts)
                            avg_count = sum(counts) / len(counts)
                            
                            logger.info(f"    Relationship with {ref_table}: Min={min_count}, Max={max_count}, Avg={avg_count:.2f}")
                        else:
                            logger.info(f"    No relationships with {ref_table}")

    def _sort_entities_by_dependencies(self) -> List[Entity]:
        """
        Sort entities based on dependencies (foreign keys)
        
        Returns:
            Sorted list of entities
        """
        # Map entity names to entities
        entity_map = {entity.name: entity for entity in self.config.entities}
        
        # Build dependency graph
        graph = {}
        for entity in self.config.entities:
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