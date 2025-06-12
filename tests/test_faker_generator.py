"""
Test script to verify the Faker generator is working correctly.
"""

import os
import sys
import logging
import sqlite3

# Add the parent directory to the path to allow importing the modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from python.src.config_parser import parse_db_config
from python.src.generator import DatabaseGenerator

def test_faker_generator():
    """
    Test that the faker generator produces realistic names instead of 'Person X'.
    """
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Parse the demo database configuration
    config_file = os.path.join(os.path.dirname(__file__), 'test_config', 'demo_db.yaml')
    config = parse_db_config(config_file)
    
    # Create a database generator
    generator = DatabaseGenerator(config)
    
    # Generate the database in the tests directory
    db_path = generator.generate('test_faker.db')
    
    print(f"Generated database at: {db_path}")
    
    # Verify that Faker names are being generated correctly
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Query the Consultant table which should have faker-generated names
    cursor.execute("SELECT name FROM Consultant")
    names = cursor.fetchall()
    
    print("\nGenerated names:")
    for name in names:
        print(f"  - {name[0]}")
    
    # Check that names don't follow the 'Person X' pattern
    has_real_names = False
    for name in names:
        if not name[0].startswith("Person "):
            has_real_names = True
            break
    
    if has_real_names:
        print("\nSuccess! Faker is generating realistic names.")
    else:
        print("\nFailed! Names still follow the 'Person X' pattern.")
    
    conn.close()

if __name__ == "__main__":
    test_faker_generator() 