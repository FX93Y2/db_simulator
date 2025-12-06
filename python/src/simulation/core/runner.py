"""
Simulation runner module.

This module provides functions to run simulations from configuration files.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Union

from ...config_parser import parse_sim_config, parse_sim_config_from_string
from ...config_parser import parse_db_config, parse_db_config_from_string # Import db config parsers
from .simulator import EventSimulator

logger = logging.getLogger(__name__)

def ensure_simulation_tables(sim_config, db_path: Union[str, Path], db_config=None):
    """
    Ensure that the necessary tables for simulation exist in the database
    
    Args:
        sim_config: Simulation configuration
        db_path: Path to the SQLite database
        db_config: Optional database configuration
    """
    if not sim_config.event_simulation:
        return
    
    # Get table names from simulation config or database config
    entity_table = None
    event_table = None
    
    # Try to get from simulation config first
    if sim_config.event_simulation.table_specification:
        table_spec = sim_config.event_simulation.table_specification
        entity_table = table_spec.entity_table
        event_table = table_spec.event_table
    # If not available, try to derive from database config
    elif db_config:
        for entity in db_config.entities:
            if entity.type == 'entity':
                entity_table = entity.name
            elif entity.type == 'event':
                event_table = entity.name
    
    # Check if we have the necessary table names
    if not entity_table:
        logger.error("Could not determine entity table name. Cannot ensure simulation tables.")
        return

    if not event_table:
        logger.info("No event table specified; skipping event table provisioning.")
        return
    
    # Connect to the database
    from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, ForeignKey, inspect
    from sqlalchemy.pool import NullPool
    
    engine = create_engine(
        f"sqlite:///{db_path}?journal_mode=WAL",
        poolclass=NullPool
    )
    
    # Check if tables exist
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    metadata = MetaData()
    
    # Create entity table if it doesn't exist
    if entity_table not in tables:
        logger.info(f"Creating entity table: {entity_table}")
        entity_table_obj = Table(
            entity_table, metadata,
            Column('id', Integer, primary_key=True),
            Column('name', String, nullable=False)
        )
        entity_table_obj.create(engine)
    
    # Create event table if it doesn't exist
    if event_table not in tables:
        # Find the relationship column name (defaults to entity_table_id)
        # Try to determine the relationship column from inspector
        relationship_column = f"{entity_table.lower()}_id"  # Default fallback
        
        # Look for existing foreign keys
        try:
            fk_constraints = inspector.get_foreign_keys(event_table)
            for fk in fk_constraints:
                # Check if this FK references the entity table
                if fk['referred_table'] == entity_table:
                    # Assume there's only one column per FK
                    if len(fk['constrained_columns']) > 0:
                        relationship_column = fk['constrained_columns'][0]
                        break
        except Exception as e:
            logger.warning(f"Could not determine relationship column from schema: {e}")
        
        # If no FK found, try common naming patterns
        if relationship_column == f"{entity_table.lower()}_id":
            # Try common naming patterns
            table_name_singular = entity_table.rstrip('s')  # Remove trailing 's' if any
            common_patterns = [
                f"{entity_table}_id",
                f"{entity_table}Id",
                f"{table_name_singular}_id",
                f"{table_name_singular}Id"
            ]
            
            event_columns = [col['name'] for col in inspector.get_columns(event_table)]
            
            for pattern in common_patterns:
                if pattern in event_columns:
                    relationship_column = pattern
                    break
        
        logger.info(f"Creating event table: {event_table} with relationship column: {relationship_column}")
        event_table_obj = Table(
            event_table, metadata,
            Column('id', Integer, primary_key=True),
            Column(relationship_column, Integer, ForeignKey(f"{entity_table}.id")),
            Column('name', String, nullable=False),
            Column('type', String, nullable=False)
        )
        event_table_obj.create(engine)
    
    # Dispose of the engine
    engine.dispose()

# Add a call to ensure_simulation_tables in run_simulation
def run_simulation(sim_config_path_or_content: Union[str, Path],
                   db_config_path_or_content: Union[str, Path],
                   db_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Run a simulation based on configuration, ensuring required tables exist.
    
    Args:
        sim_config_path_or_content: Path to the simulation configuration file or YAML content string
        db_config_path_or_content: Path to the database configuration file or YAML content string.
        db_path: Path to the SQLite database
        
    Returns:
        Dictionary with simulation results
    """
    # Parse database configuration first
    db_config = None
    if isinstance(db_config_path_or_content, (str, Path)) and os.path.exists(db_config_path_or_content) and os.path.isfile(db_config_path_or_content):
        logger.info(f"Parsing database config file: {db_config_path_or_content}")
        db_config = parse_db_config(db_config_path_or_content)
    elif isinstance(db_config_path_or_content, str):
        logger.info("Parsing database config from content string")
        db_config = parse_db_config_from_string(db_config_path_or_content)
    else:
        raise ValueError("Invalid db_config_path_or_content provided.")
        
    # Parse simulation configuration with database config
    sim_config = None
    if isinstance(sim_config_path_or_content, (str, Path)) and os.path.exists(sim_config_path_or_content) and os.path.isfile(sim_config_path_or_content):
        logger.info(f"Parsing simulation config file: {sim_config_path_or_content}")
        sim_config = parse_sim_config(sim_config_path_or_content, db_config)
    elif isinstance(sim_config_path_or_content, str):
        logger.info("Parsing simulation config from content string")
        sim_config = parse_sim_config_from_string(sim_config_path_or_content, db_config)
    else:
        raise ValueError("Invalid sim_config_path_or_content provided.")
    
    # Ensure necessary tables exist
    ensure_simulation_tables(sim_config, db_path, db_config)
    
    # Create and run simulator
    logger.info("Initializing EventSimulator...")
    simulator = EventSimulator(config=sim_config, db_config=db_config, db_path=db_path)
    results = simulator.run()
    
    logger.info(f"Simulation completed: {results}")
    return results

def run_simulation_from_config_dir(sim_config_dir: Union[str, Path],
                                   db_config_path_or_content: Union[str, Path],
                                   db_path: Union[str, Path]) -> Dict[str, Dict[str, Any]]:
    """
    Run simulations for all configuration files in a directory
    
    Args:
        sim_config_dir: Directory containing simulation configuration files
        db_config_path_or_content: Path to the database configuration file or YAML content string.
        db_path: Path to the SQLite database
        
    Returns:
        Dictionary mapping configuration names to simulation results
    """
    if isinstance(sim_config_dir, str):
        sim_config_dir = Path(sim_config_dir)
        
    results = {}
    
    # Find all YAML files in the directory
    for config_file in sim_config_dir.glob("*.yaml"):
        config_name = config_file.stem
        logger.info(f"Running simulation for configuration: {config_name}")
        
        try:
            # Pass db_config_path_or_content to run_simulation
            sim_results = run_simulation(config_file, db_config_path_or_content, db_path)
            results[config_name] = sim_results
        except Exception as e:
            logger.error(f"Error running simulation for {config_name}: {e}")
            results[config_name] = {"error": str(e)}
    
    return results 
