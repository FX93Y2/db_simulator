"""
Database generator module for the DB Simulator.
Provides functionality to generate synthetic SQLite databases
from configuration files.
"""

from .db_generator import DatabaseGenerator
from ..config_parser import parse_db_config, parse_sim_config

# Export the generate_database function
def generate_database(config_path, output_dir='output', db_name=None):
    """
    Generate a SQLite database from a configuration file.
    
    Args:
        config_path (str): Path to the database configuration file
        output_dir (str): Directory to store the generated database
        db_name (str, optional): Name of the database (without extension)
        
    Returns:
        Path: Path to the generated database file
    """
    config = parse_db_config(config_path)
    generator = DatabaseGenerator(config, output_dir, db_name)
    return generator.generate()

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
    import logging
    logger = logging.getLogger(__name__)
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