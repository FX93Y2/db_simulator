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
import sqlite3

from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, MetaData, Table, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

from ..config_parser import DatabaseConfig, Entity, Attribute

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
        
        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Create database file path (ensure it's absolute)
        if os.path.isabs(self.output_dir):
            db_path = os.path.join(self.output_dir, f"{db_name}.db")
        else:
            db_path = os.path.abspath(os.path.join(self.output_dir, f"{db_name}.db"))
        
        logger.info(f"Generating database at absolute path: {db_path}")
        
        # Create SQLAlchemy engine
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
        
        # Verify the database file exists
        if not os.path.exists(db_path):
            logger.error(f"Database file was not created at expected path: {db_path}")
        else:
            logger.info(f"Database generated successfully at {db_path}, size: {os.path.getsize(db_path)} bytes")
        
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
        
        # Identify resource tables and entity/event tables
        resource_tables = []
        entity_event_tables = []
        
        for entity in sorted_entities:
            # Check if this table should be skipped (dynamic entity/event table)
            if entity.name in self.dynamic_entity_tables:
                entity_event_tables.append(entity)
                continue
                
            # Check if this is a resource table (has fixed number of rows)
            if isinstance(entity.rows, int) and entity.rows > 0:
                resource_tables.append(entity)
            else:
                entity_event_tables.append(entity)
        
        # First populate resource tables (always needed)
        for entity in resource_tables:
            self._populate_entity(entity)
        
        # Check if we should populate entity/event tables
        # This will be skipped if the simulation is configured to generate them dynamically
        skip_entity_tables = self._should_skip_entity_tables()
        
        if not skip_entity_tables:
            # Populate parent entity tables
            parent_tables = [e for e in entity_event_tables if not any(attr.is_foreign_key for attr in e.attributes)]
            for entity in parent_tables:
                self._populate_entity(entity)
            
            # Populate child event tables
            child_tables = [e for e in entity_event_tables if any(attr.is_foreign_key for attr in e.attributes)]
            for entity in child_tables:
                self._populate_child_entity(entity)
        else:
            logger.info("Skipping entity and event tables - will be generated dynamically during simulation")
    
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
                
                # Generate data based on generator configuration
                if attr.generator:
                    row_data[attr.name] = self._generate_attribute_value(attr, i)
                
                # Default value for attributes without generator
                else:
                    row_data[attr.name] = f"Default_{attr.name}_{i}"
            
            # Create and add row
            row = model_class(**row_data)
            self.session.add(row)
        
        # Commit after each table to make IDs available for foreign keys
        self.session.commit()
    
    def _populate_child_entity(self, entity: Entity):
        """
        Populate child table with proper relationship distribution
        
        Args:
            entity: Entity configuration
        """
        model_class = self.models[entity.name]
        
        # Find foreign key attributes and their relationships
        fk_attrs = []
        for attr in entity.attributes:
            if attr.is_foreign_key and attr.ref and attr.relationship:
                ref_table, ref_column = attr.ref.split('.')
                fk_attrs.append((attr, ref_table, ref_column))
        
        # If no foreign keys with relationships, use default population
        if not fk_attrs:
            self._populate_entity(entity)
            return
        
        logger.info(f"Generating rows for child table {entity.name} with relationships")
        
        # For each foreign key with relationship
        for attr, ref_table, ref_column in fk_attrs:
            # Get all IDs from the parent table
            parent_model = self.models[ref_table]
            parent_ids = self.session.query(getattr(parent_model, ref_column)).all()
            parent_ids = [id[0] for id in parent_ids]
            
            if not parent_ids:
                logger.warning(f"No rows in parent table {ref_table}, skipping child table {entity.name}")
                continue
            
            # Generate distribution of child counts per parent
            multiplicity = attr.relationship.multiplicity
            counts = self._generate_relationship_counts(multiplicity, len(parent_ids))
            
            # Create child rows for each parent based on the distribution
            for i, parent_id in enumerate(parent_ids):
                count = counts[i] if i < len(counts) else 0
                
                for j in range(count):
                    row_data = {attr.name: parent_id}
                    
                    # Generate data for other attributes
                    for other_attr in entity.attributes:
                        # Skip primary key and the current foreign key
                        if other_attr.is_primary_key or other_attr == attr:
                            continue
                        
                        # Handle other foreign keys
                        if other_attr.is_foreign_key and other_attr.ref:
                            other_ref_table, other_ref_column = other_attr.ref.split('.')
                            other_ids = self.session.query(getattr(self.models[other_ref_table], other_ref_column)).all()
                            
                            if other_ids:
                                row_data[other_attr.name] = random.choice(other_ids)[0]
                            else:
                                logger.warning(f"No rows in referenced table {other_ref_table}")
                                row_data[other_attr.name] = None
                        
                        # Generate data based on generator configuration
                        elif other_attr.generator:
                            row_data[other_attr.name] = self._generate_attribute_value(other_attr, j)
                        
                        # Default value
                        else:
                            row_data[other_attr.name] = f"Default_{other_attr.name}_{j}"
                    
                    # Create and add row
                    row = model_class(**row_data)
                    self.session.add(row)
            
            # Commit after processing each foreign key
            self.session.commit()
    
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
        Generate value for an attribute based on its generator configuration
        
        Args:
            attr: Attribute configuration
            row_index: Index of current row
            
        Returns:
            Generated value
        """
        generator = attr.generator
        
        if not generator:
            return f"Default_{attr.name}_{row_index}"
        
        generator_type = generator.type
        
        # Faker generator
        if generator_type == 'faker':
            if generator.method == 'name':
                return f"Person {row_index}"
            elif generator.method == 'email':
                return f"person{row_index}@example.com"
            else:
                return f"{generator.method}_{row_index}"
        
        # Template generator
        elif generator_type == 'template':
            template = generator.template or "{id}"
            context = {'id': row_index + 1}
            return template.format(**context)
        
        # Distribution generator
        elif generator_type == 'distribution':
            if not generator.distribution:
                return f"Dist_{row_index}"
                
            dist_type = generator.distribution.get('type')
            
            if dist_type == 'choice':
                values = generator.distribution.get('values', [])
                weights = generator.distribution.get('weights')
                
                if not values:
                    return f"Choice_{row_index}"
                
                return random.choices(values, weights=weights, k=1)[0]
            
            # Other distribution types can be implemented as needed
            
            return f"Dist_{dist_type}_{row_index}"
        
        # Default
        return f"Value_{row_index}"
        
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