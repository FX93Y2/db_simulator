# Database Generation Logic Documentation

## Project Overview

DB Simulator is a comprehensive discrete event simulation tool designed for modeling and analyzing database workloads with advanced resource management capabilities. The system creates synthetic SQLite databases based on YAML schema definitions, populates them with realistic data using Faker integration and configurable distribution generators, and then runs SimPy-based discrete event simulations to analyze performance metrics and resource utilization patterns.

## Database Generation Architecture

The database generation system follows a layered architecture with three main components:

### 1. Configuration Layer (`python/src/config_parser/`)
- **`db_parser.py`**: Parses YAML database configurations into Python dataclasses
- **`base.py`**: Defines base configuration classes
- **`sim_parser.py`**: Handles simulation configuration parsing

### 2. Generation Layer (`python/src/generator/`)
- **`db_generator.py`**: Core database generation logic using SQLAlchemy ORM

### 3. Storage Layer (`python/config_storage/`)
- **`config_db.py`**: Manages persistent storage of configurations and projects

## Step-by-Step Database Generation Process

### Step 1: Configuration Parsing

The system begins by parsing YAML configuration files that define database schemas. The configuration parser converts YAML structures into Python dataclasses:

```python
# python/src/config_parser/db_parser.py:72-121
def parse_db_config(file_path: Union[str, Path]) -> DatabaseConfig:
    if isinstance(file_path, str):
        file_path = Path(file_path)
        
    if not file_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {file_path}")
    
    with open(file_path, 'r') as f:
        config_dict = yaml.safe_load(f)
    
    entities = []
    for entity_dict in config_dict.get('entities', []):
        attributes = []
        for attr_dict in entity_dict.get('attributes', []):
            generator = None
            if 'generator' in attr_dict:
                gen_dict = attr_dict['generator']
                generator = Generator(
                    type=gen_dict['type'],
                    method=gen_dict.get('method'),
                    template=gen_dict.get('template'),
                    distribution=gen_dict.get('distribution'),
                    values=gen_dict.get('values'),
                    weights=gen_dict.get('weights'),
                    subtype=gen_dict.get('subtype')
                )
            
            attributes.append(Attribute(
                name=attr_dict['name'],
                type=attr_dict['type'],
                generator=generator,
                ref=attr_dict.get('ref'),
                relationship=relationship
            ))
        
        entities.append(Entity(
            name=entity_dict['name'],
            attributes=attributes,
            rows=entity_dict.get('rows', 0),
            type=entity_dict.get('type')
        ))
    
    return DatabaseConfig(entities=entities)
```

**Key Configuration Classes:**
- `DatabaseConfig`: Root configuration containing all entities
- `Entity`: Represents a database table with attributes and row count
- `Attribute`: Column definition with type, generator, and relationship info
- `Generator`: Defines how to generate synthetic data for each attribute

### Step 2: Database Generation Initialization

The `DatabaseGenerator` class is initialized with the parsed configuration and output directory:

```python
# python/src/generator/db_generator.py:30-44
class DatabaseGenerator:
    def __init__(self, config: DatabaseConfig, output_dir: str = "output", dynamic_entity_tables: Optional[List[str]] = None):
        from sqlalchemy.ext.declarative import declarative_base
        self.Base = declarative_base()
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
```

### Step 3: Database File Creation

The system creates a SQLite database file with automatic timestamp naming:

```python
# python/src/generator/db_generator.py:46-92
def generate(self, db_name: Optional[str] = None) -> str:
    # Generate database name if not provided
    if not db_name:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        db_name = f"generated_db_{timestamp}"
    
    # Create database file path (ensure it's absolute)
    if os.path.isabs(self.output_dir):
        db_path = os.path.join(self.output_dir, f"{db_name}.db")
    else:
        db_path = os.path.abspath(os.path.join(self.output_dir, f"{db_name}.db"))
    
    # Delete the file if it already exists to ensure we start fresh
    if not safe_delete_sqlite_file(db_path):
        logger.warning(f"Could not delete existing database file, continuing anyway: {db_path}")
    
    # Create SQLAlchemy engine with specific flags for better reliability
    connection_string = f"sqlite:///{db_path}"
    self.engine = create_engine(connection_string, echo=False)
```

### Step 4: Table Schema Creation

The system dynamically creates SQLAlchemy ORM models based on the entity definitions:

```python
# python/src/generator/db_generator.py:154-194
def _create_tables(self):
    """Create tables based on configuration"""
    # First pass: Create model classes for all entities
    for entity in self.config.entities:
        self._create_model_class(entity)
    
    # Create all tables
    self.Base.metadata.create_all(self.engine)

def _create_model_class(self, entity: Entity):
    """Create SQLAlchemy model class for an entity"""
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
    model_class = type(entity.name, (self.Base,), attrs)
    self.models[entity.name] = model_class
```

### Step 5: Data Population with Dependency Resolution

The system populates tables in dependency order, ensuring parent tables are populated before child tables with foreign keys:

```python
# python/src/generator/db_generator.py:475-519
def _sort_entities_by_dependencies(self) -> List[Entity]:
    """Sort entities based on dependencies (foreign keys)"""
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
    
    # Topological sort to ensure proper order
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
```

### Step 6: Synthetic Data Generation

The system generates realistic data using multiple generator types:

```python
# python/src/generator/db_generator.py:245-325
def _populate_entity(self, entity: Entity):
    """Populate table with data based on entity configuration"""
    model_class = self.models[entity.name]
    
    # Determine number of rows to generate
    num_rows = self._get_num_rows(entity)
    
    # Generate rows
    for i in range(num_rows):
        row_data = {}
        
        # Generate data for each attribute
        for attr in entity.attributes:
            # Skip primary key for auto-increment
            if attr.is_primary_key:
                continue

            # Handle foreign key generator type
            if attr.generator and getattr(attr.generator, "type", None) == "foreign_key":
                if not attr.ref:
                    logger.error(f"Foreign key attribute '{attr.name}' missing 'ref'")
                    row_data[attr.name] = None
                else:
                    ref_table, ref_column = attr.ref.split('.')
                    parent_model = self.models[ref_table]
                    parent_ids = self.session.query(getattr(parent_model, ref_column)).all()
                    parent_ids = [id[0] for id in parent_ids]
                    if not parent_ids:
                        row_data[attr.name] = None
                    else:
                        # Support weighted distribution for foreign key selection
                        dist = getattr(attr.generator, "distribution", None)
                        if dist and getattr(dist, "type", None) == "choice":
                            weights = getattr(dist, "values", None)
                            if weights and len(weights) == len(parent_ids):
                                row_data[attr.name] = np.random.choice(parent_ids, p=weights)
                            else:
                                row_data[attr.name] = random.choices(parent_ids, k=1)[0]
                        else:
                            row_data[attr.name] = random.choices(parent_ids, k=1)[0]
            
            # Generate data based on other generator configuration
            elif attr.generator:
                row_data[attr.name] = self._generate_attribute_value(attr, i)
            
            # Handle attributes without generators
            else:
                row_data[attr.name] = f"MissingGenerator_{attr.name}_{i}"
        
        # Create and add row
        row = model_class(**row_data)
        self.session.add(row)
    
    # Commit after each table to make IDs available for foreign keys
    self.session.commit()
```

### Step 7: Data Generator Types

The system supports multiple data generation strategies:

```python
# python/src/utils/data_generation.py:5-87
def generate_attribute_value(attr_config: Dict[str, Any], row_index: int) -> Any:
    """Generate value for an attribute based on its generator configuration"""
    generator_config = attr_config.get('generator')
    generator_type = generator_config.get('type')

    # Faker generator - uses realistic fake data
    if generator_type == 'faker':
        method = generator_config.get('method')
        if method:
            return generate_fake_data(method)  # e.g., faker.name(), faker.email()

    # Template generator - uses string templates with variables
    elif generator_type == 'template':
        template = generator_config.get('template') or "{id}"
        context = {'id': row_index + 1} 
        return template.format(**context)  # e.g., "Project_{id}" -> "Project_1"

    # Distribution generator - uses statistical distributions
    elif generator_type == 'distribution':
        distribution = generator_config.get('distribution')
        dist_type = distribution.get('type')

        if dist_type == 'choice':
            values = distribution.get('values', [])
            weights = distribution.get('weights')
            return random.choices(values, weights=weights, k=1)[0]

    # Foreign key generator - references other tables
    elif generator_type == 'foreign_key':
        return None  # Handled by database generator with proper FK resolution
```

### Step 8: Configuration Storage

The system persists project configurations and generated databases using SQLite:

```python
# python/config_storage/config_db.py:53-90
def _init_db(self):
    """Initialize the database schema if it doesn't exist"""
    conn = sqlite3.connect(self.db_path)
    cursor = conn.cursor()
    
    # Create projects table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    ''')
    
    # Create configs table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        project_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    ''')
    
    conn.commit()
    conn.close()
```

## Key Features and Capabilities

### 1. **Dynamic Schema Generation**
- Converts YAML configurations to SQLAlchemy ORM models
- Supports primary keys, foreign keys, and custom column types
- Handles complex relationships with dependency resolution

### 2. **Synthetic Data Generation**
- **Faker Integration**: Realistic names, emails, addresses, etc.
- **Template-based**: Pattern-based generation (e.g., "Project_{id}")
- **Distribution-based**: Statistical distributions for realistic data patterns
- **Foreign Key Resolution**: Proper referential integrity with weighted selection

### 3. **Relationship Management**
- Topological sorting ensures proper table population order
- Supports one-to-many and many-to-many relationships
- Configurable multiplicity with statistical distributions

### 4. **Project Organization**
- Project-based configuration management
- Version control for database schemas
- Persistent storage of configurations and metadata

### 5. **Error Handling and Validation**
- Circular dependency detection
- File system safety checks
- Database integrity validation
- Comprehensive logging throughout the process

## Example Configuration Structure

```yaml
# Example from tests/test_config/demo_db.yaml
entities:
  - name: Department
    rows: 5
    attributes:
      - name: id
        type: pk
      - name: name
        type: string
        generator:
          type: template
          template: "Department_{id}"

  - name: Consultant
    type: resource
    rows: 30
    attributes:
      - name: id
        type: pk
      - name: department_id
        type: fk
        ref: Department.id
        generator:
          type: foreign_key
          subtype: one_to_many
      - name: name
        type: string
        generator:
          type: faker
          method: name
      - name: role
        type: resource_type
        generator:
          type: distribution
          distribution:
            type: choice
            values: ["Developer", "Tester", "Tech Lead", "Business Analyst"]
            weights: [0.5, 0.2, 0.2, 0.1]
```

This comprehensive database generation system provides a robust foundation for creating realistic synthetic databases that can be used for discrete event simulation modeling and performance analysis.