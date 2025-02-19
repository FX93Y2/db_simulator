import pytest
from pathlib import Path
import tempfile
import os
import logging
from pprint import pformat
import sys

from src.generator import DatabaseGenerator
from src.models import ModelRegistry, DatabaseManager

def setup_logging():
    """Set up logging configuration"""
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(message)s')  # Simplified format for readability
    handler.setFormatter(formatter)
    
    # Remove any existing handlers
    root.handlers = []
    root.addHandler(handler)

@pytest.fixture
def temp_db_path():
    """Create a temporary database file"""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    yield db_path
    os.unlink(db_path)

def test_demo_config(temp_db_path):
    """Test database generation using the demo configuration"""
    setup_logging()
    config_path = Path('config/db_config/demo_db.yaml')
    
    print("\n" + "="*80)  # Clear separation for test output
    
    # Initialize generator with demo config
    print(f"\nInitializing generator with config: {config_path}")
    generator = DatabaseGenerator(config_path, temp_db_path)
    
    # Generate data
    print("\nGenerating database data...")
    generator.generate_all()
    
    # Query and display the generated data
    with generator.db as session:
        # Get all models
        for model_name, model_class in generator.model_registry.models.items():
            print(f"\n{'='*20} Data for {model_name} {'='*20}")
            instances = session.query(model_class).all()
            
            for instance in instances:
                # Get all attribute names
                attrs = [attr for attr in dir(instance) 
                        if not attr.startswith('_') and 
                        not callable(getattr(instance, attr)) and
                        attr != 'metadata']
                
                # Log each instance's data
                instance_data = {
                    attr: getattr(instance, attr) 
                    for attr in attrs 
                    if not isinstance(getattr(instance, attr), list)
                }
                print(f"\nInstance Data:\n{pformat(instance_data)}")
                
                # Log relationships if any exist
                for attr in attrs:
                    value = getattr(instance, attr)
                    if isinstance(value, list):
                        related_items = [
                            {
                                'type': item.__class__.__name__,
                                'id': item.id,
                                'data': {
                                    k: getattr(item, k)
                                    for k in dir(item)
                                    if not k.startswith('_') and 
                                    not callable(getattr(item, k)) and
                                    k != 'metadata' and
                                    not isinstance(getattr(item, k), list)
                                }
                            }
                            for item in value
                        ]
                        if related_items:
                            print(f"\nRelated {attr}:\n{pformat(related_items)}")
    
    print("\n" + "="*80)  # Clear separation for end of test 