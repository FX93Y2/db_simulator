"""
Database generator module for the DB Simulator.
Provides functionality to generate synthetic SQLite databases
from configuration files.
"""

import os
import logging
from pathlib import Path

from .db_generator import DatabaseGenerator
from ..config_parser import parse_db_config, parse_sim_config, parse_db_config_from_string

# Create logger
logger = logging.getLogger(__name__)

# Export the generate_database function
def generate_database(config_path_or_content, output_dir='output', db_name=None):
    """
    Generate a SQLite database from a configuration file path or content string.
    
    Args:
        config_path_or_content (str): Path to the database configuration file or YAML content
        output_dir (str): Directory to store the generated database
        db_name (str, optional): Name of the database (without extension)
        
    Returns:
        Path: Path to the generated database file
    """
    # Check if the input is a file path or content string
    if os.path.exists(config_path_or_content) and os.path.isfile(config_path_or_content):
        logger.info(f"Generating database from config file: {config_path_or_content}")
        config = parse_db_config(config_path_or_content)
    else:
        logger.info("Generating database from config content string")
        config = parse_db_config_from_string(config_path_or_content)
    
    # Make sure output_dir is an absolute path
    if not os.path.isabs(output_dir):
        output_dir = os.path.abspath(output_dir)
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    logger.info(f"Output directory (absolute path): {output_dir}")
    
    generator = DatabaseGenerator(config, output_dir, db_name)
    db_path = generator.generate()
    
    # Ensure the returned path is absolute
    if not os.path.isabs(db_path):
        db_path = os.path.abspath(db_path)
    
    logger.info(f"Generated database at absolute path: {db_path}")
    return db_path

def generate_database_for_simulation(db_config_path, sim_config_path, output_dir='output', db_name=None):
    """
    [DEPRECATED] Generate a database with only resource tables, suitable for dynamic simulation.
    
    This function is deprecated and will be removed in a future version.
    Please use generate_database() instead for better reliability with table relationships.
    
    Args:
        db_config_path (str): Path to the database configuration file
        sim_config_path (str): Path to the simulation configuration file
        output_dir (str): Directory to store the generated database
        db_name (str, optional): Name of the database (without extension)
        
    Returns:
        Path: Path to the generated database file
    """
    logger.warning("generate_database_for_simulation is deprecated and will be removed in a future version. " +
                   "Please use generate_database() instead for better reliability.")
    
    db_config = parse_db_config(db_config_path)
    sim_config = parse_sim_config(sim_config_path)
    
    # Only include resource tables
    resource_table = None
    if sim_config.event_simulation and sim_config.event_simulation.table_specification:
        resource_table = sim_config.event_simulation.table_specification.resource_table
    
    # Filter entities to only include resource tables
    if resource_table:
        db_config.entities = [e for e in db_config.entities if e.name == resource_table]
    
    # Generate the database with filtered entities
    generator = DatabaseGenerator(db_config, output_dir, db_name)
    return generator.generate()

__all__ = [
    'generate_database',
    'generate_database_for_simulation',
    'DatabaseGenerator'
] 