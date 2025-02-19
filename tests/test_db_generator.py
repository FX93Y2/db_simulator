import pytest
from pathlib import Path
import tempfile
import os

from src.generator import DatabaseGenerator
from src.models import ModelRegistry, DatabaseManager

@pytest.fixture
def temp_db_path():
    """Create a temporary database file"""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    yield db_path
    os.unlink(db_path)

def test_model_creation():
    """Test dynamic model creation from config"""
    registry = ModelRegistry()
    
    # Test creating a simple model
    attributes = {
        'id': {'type': 'pk'},
        'name': {'type': 'string'},
        'count': {'type': 'integer'}
    }
    
    model = registry.create_model('TestEntity', attributes)
    
    assert model.__tablename__ == 'testentity'
    assert hasattr(model, 'id')
    assert hasattr(model, 'name')
    assert hasattr(model, 'count')

def test_relationship_creation():
    """Test relationship creation between models"""
    registry = ModelRegistry()
    
    # Create parent model
    parent_attrs = {
        'id': {'type': 'pk'},
        'name': {'type': 'string'}
    }
    parent_model = registry.create_model('Parent', parent_attrs)
    
    # Create child model with relationship
    child_attrs = {
        'id': {'type': 'pk'},
        'parent_id': {'type': 'fk', 'ref': 'Parent.id'},
        'data': {'type': 'string'}
    }
    child_rels = {
        'parent': {
            'target_entity': 'Parent',
            'back_populates': 'children'
        }
    }
    child_model = registry.create_model('Child', child_attrs, child_rels)
    
    assert hasattr(child_model, 'parent_id')
    assert hasattr(child_model, 'parent')

def test_database_operations(temp_db_path):
    """Test database operations with generated models"""
    # Create test config file
    config_content = """
    entities:
      - name: Department
        type: entity
        rows: 2
        attributes:
          - name: id
            type: pk
          - name: name
            type: string
            generator:
              type: template
              template: "Department_{id}"
              
      - name: Employee
        type: entity
        rows: 4
        attributes:
          - name: id
            type: pk
          - name: department_id
            type: fk
            ref: Department.id
          - name: name
            type: string
            generator:
              type: faker
              method: name
          - name: email
            type: string
            generator:
              type: faker
              method: email
          - name: role
            type: string
            generator:
              type: distribution
              distribution:
                type: choice
                values: ["Developer", "Manager", "Designer"]
                weights: [0.6, 0.2, 0.2]
    """
    
    config_path = Path('test_config.yaml')
    with open(config_path, 'w') as f:
        f.write(config_content)
    
    try:
        # Initialize generator with test config
        generator = DatabaseGenerator(config_path, temp_db_path)
        
        # Generate data
        generator.generate_all()
        
        # Verify data
        with generator.db as session:
            # Check departments
            Department = generator.model_registry.get_model('Department')
            departments = session.query(Department).all()
            assert len(departments) == 2
            assert all(d.name.startswith('Department_') for d in departments)
            
            # Check employees
            Employee = generator.model_registry.get_model('Employee')
            employees = session.query(Employee).all()
            assert len(employees) == 4
            assert all(e.department_id is not None for e in employees)
            assert all(e.name is not None for e in employees)
            assert all(e.email is not None for e in employees)
            assert all(e.role in ['Developer', 'Manager', 'Designer'] for e in employees)
            
    finally:
        # Cleanup
        if config_path.exists():
            config_path.unlink() 