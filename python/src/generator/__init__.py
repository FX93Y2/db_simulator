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
def generate_database(config_path_or_content, output_dir='output', db_name=None, project_id=None):
    """
    Generate a SQLite database from a configuration file path or content string.
    
    Args:
        config_path_or_content (str): Path to the database configuration file or YAML content
        output_dir (str): Directory to store the generated database
        db_name (str, optional): Name of the database (without extension)
        project_id (str, optional): Project ID to organize output files
        
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
    
    # Check if we're in packaged mode (environment variable set by Electron)
    is_packaged = os.environ.get('DB_SIMULATOR_PACKAGED', 'false').lower() == 'true'
    logger.info(f"Running in {'packaged' if is_packaged else 'development'} mode")
    
    # Check if output directory is specified in environment
    if 'DB_SIMULATOR_OUTPUT_DIR' in os.environ:
        base_output_dir = os.environ['DB_SIMULATOR_OUTPUT_DIR']
        logger.info(f"Using output directory from environment: {base_output_dir}")
        
        # If project_id is provided, create a project-specific subdirectory
        if project_id:
            output_dir = os.path.join(base_output_dir, project_id)
            logger.info(f"Using project-specific output directory: {output_dir}")
        else:
            output_dir = base_output_dir
    else:
        # Fall back to the original logic for development mode
        if not os.path.isabs(output_dir):
            # Check if we're in a project environment
            # Try to find the project root (look for directories like 'python' and 'electron' as siblings)
            current_dir = os.path.dirname(os.path.abspath(__file__))
            project_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
            
            # Look for project structure indicators
            if os.path.isdir(os.path.join(project_dir, 'python')) and \
               os.path.isdir(os.path.join(project_dir, 'electron')):
                # Found project root, use it as base for output
                output_dir = os.path.join(project_dir, output_dir)
                logger.info(f"Using project root-based output directory: {output_dir}")
            else:
                # Can't find project root, use absolute path of current directory
                output_dir = os.path.abspath(output_dir)
                logger.info(f"Using absolute output directory: {output_dir}")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    logger.info(f"Output directory: {output_dir}")
    
    generator = DatabaseGenerator(config, output_dir, db_name)
    db_path = generator.generate()
    
    # Ensure the returned path is absolute
    if not os.path.isabs(db_path):
        db_path = os.path.abspath(db_path)
    
    logger.info(f"Generated database at path: {db_path}")
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