"""
Database generator module
"""

from pathlib import Path
from typing import Optional, Union, List

from src.generator.db_generator import DatabaseGenerator
from src.config_parser import parse_db_config, parse_sim_config

def generate_database(config_path: Union[str, Path], output_dir: str = "output", db_name: Optional[str] = None, 
                     dynamic_entity_tables: Optional[List[str]] = None) -> str:
    """
    Generate a database from a configuration file
    
    Args:
        config_path: Path to the database configuration file
        output_dir: Directory to store the generated database
        db_name: Name of the database file (without path or extension)
        dynamic_entity_tables: List of table names to skip (will be generated dynamically)
        
    Returns:
        Path to the generated database file
    """
    # Parse database configuration
    db_config = parse_db_config(config_path)
    
    # Create and run generator
    generator = DatabaseGenerator(db_config, output_dir, dynamic_entity_tables)
    db_path = generator.generate(db_name)
    
    return db_path

def generate_database_for_simulation(db_config_path: Union[str, Path], sim_config_path: Union[str, Path], 
                                    output_dir: str = "output", db_name: Optional[str] = None) -> str:
    """
    Generate a database for simulation, skipping entity and event tables
    
    Args:
        db_config_path: Path to the database configuration file
        sim_config_path: Path to the simulation configuration file
        output_dir: Directory to store the generated database
        db_name: Name of the database file (without path or extension)
        
    Returns:
        Path to the generated database file
    """
    # Parse simulation configuration to identify entity and event tables
    sim_config = parse_sim_config(sim_config_path)
    
    dynamic_entity_tables = []
    if sim_config.event_simulation:
        # Add entity table
        if sim_config.event_simulation.entity_table:
            dynamic_entity_tables.append(sim_config.event_simulation.entity_table)
        
        # Add event table
        if sim_config.event_simulation.event_table:
            dynamic_entity_tables.append(sim_config.event_simulation.event_table)
    
    # Generate database, skipping entity and event tables
    return generate_database(db_config_path, output_dir, db_name, dynamic_entity_tables)

__all__ = ['DatabaseGenerator', 'generate_database', 'generate_database_for_simulation'] 