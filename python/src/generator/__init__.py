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
def generate_database(config_path_or_content, output_dir='output', db_name=None, project_id=None, sim_config_path=None):
    """
    Generate a SQLite database from a configuration file path or content string.
    
    Args:
        config_path_or_content (str): Path to the database configuration file or YAML content
        output_dir (str): Directory to store the generated database
        db_name (str, optional): Name of the database (without extension)
        project_id (str, optional): Project ID to organize output files
        sim_config_path (str, optional): Path to simulation config for attribute column detection
        
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
    
    # Parse simulation config if provided
    sim_config = None
    if sim_config_path:
        if os.path.exists(sim_config_path) and os.path.isfile(sim_config_path):
            logger.info(f"Parsing simulation config from file: {sim_config_path}")
            sim_config = parse_sim_config(sim_config_path)
        else:
            logger.warning(f"Simulation config path does not exist: {sim_config_path}")
    else:
        logger.debug("No simulation config provided")
    
    # Check if we're in packaged mode (environment variable set by Electron)
    is_packaged = os.environ.get('DB_SIMULATOR_PACKAGED', 'false').lower() == 'true'
    logger.info(f"Running in {'packaged' if is_packaged else 'development'} mode")
    
    # Log environment variables for troubleshooting
    logger.info("Environment variables:")
    env_vars = ['DB_SIMULATOR_OUTPUT_DIR', 'DB_SIMULATOR_CONFIG_DB', 'DB_SIMULATOR_PACKAGED', 'PATH', 'TEMP', 'TMP']
    for var in env_vars:
        logger.info(f"  {var}: {os.environ.get(var, 'not set')}")
    
    # Log current working directory
    logger.info(f"Current working directory: {os.getcwd()}")
    
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
    
    # If project_id is provided but not yet in path, add it to the output path
    if project_id and not output_dir.endswith(project_id):
        project_path = os.path.join(output_dir, project_id)
        logger.info(f"Adding project_id to path: {project_path}")
        output_dir = project_path
    
    # Create output directory if it doesn't exist
    try:
        os.makedirs(output_dir, exist_ok=True)
        logger.info(f"Created/verified output directory: {output_dir}")
        
        # Check if directory is writable
        if os.access(output_dir, os.W_OK):
            logger.info(f"Output directory is writable: {output_dir}")
        else:
            logger.warning(f"Output directory is NOT writable: {output_dir}")
            
            # Try to use a temporary directory as fallback
            import tempfile
            temp_dir = tempfile.gettempdir()
            fallback_dir = os.path.join(temp_dir, 'db_simulator', 'output')
            if project_id:
                fallback_dir = os.path.join(fallback_dir, project_id)
                
            logger.info(f"Trying fallback directory: {fallback_dir}")
            os.makedirs(fallback_dir, exist_ok=True)
            
            if os.access(fallback_dir, os.W_OK):
                logger.info(f"Using fallback directory: {fallback_dir}")
                output_dir = fallback_dir
            else:
                logger.error(f"Fallback directory is also not writable: {fallback_dir}")
    except Exception as e:
        logger.error(f"Error creating output directory {output_dir}: {e}")
        
        # Try a fallback to temp directory
        import tempfile
        temp_dir = os.path.join(tempfile.gettempdir(), 'db_simulator', 'output')
        if project_id:
            temp_dir = os.path.join(temp_dir, project_id)
        
        logger.info(f"Using temporary directory as fallback: {temp_dir}")
        os.makedirs(temp_dir, exist_ok=True)
        output_dir = temp_dir
    
    logger.info(f"Final output directory: {output_dir}")
    
    # Generate a database name if not provided
    if not db_name:
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        db_name = f"generated_db_{timestamp}"
        logger.info(f"Generated database name: {db_name}")
    else:
        logger.info(f"Using provided database name: {db_name}")
    
    # Make sure db_name doesn't have .db extension already
    if db_name.endswith('.db'):
        db_name = db_name[:-3]
        logger.info(f"Removed .db extension from database name: {db_name}")
    
    generator = DatabaseGenerator(config, output_dir, None, sim_config)
    db_path = generator.generate(db_name)
    
    # Ensure the returned path is absolute
    if not os.path.isabs(db_path):
        db_path = os.path.abspath(db_path)
    
    # Verify the database file exists
    if os.path.exists(db_path):
        file_size = os.path.getsize(db_path)
        logger.info(f"Generated database at path: {db_path} (size: {file_size} bytes)")
        
        # Verify content by making sure the file is not empty
        if file_size == 0:
            logger.warning(f"Generated database file is empty (0 bytes)")
        
        # Try to open the database to verify it's valid
        try:
            import sqlite3
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            logger.info(f"Database contains {len(tables)} tables: {[t[0] for t in tables]}")
            conn.close()
        except Exception as e:
            logger.error(f"Error verifying database: {e}")
    else:
        logger.error(f"Database file does not exist at expected path: {db_path}")
        
        # List files in output directory to help troubleshoot
        try:
            logger.info(f"Files in output directory {output_dir}:")
            for f in os.listdir(output_dir):
                file_path = os.path.join(output_dir, f)
                if os.path.isfile(file_path):
                    logger.info(f"  - {f} ({os.path.getsize(file_path)} bytes)")
                else:
                    logger.info(f"  - {f} (directory)")
        except Exception as dir_error:
            logger.error(f"Error listing directory contents: {dir_error}")
    
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