"""
Simulation runner

This module provides functions to run simulations on generated databases.
"""

import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional, Union

from src.config_parser import parse_sim_config
from .simulator import EventSimulator

logger = logging.getLogger(__name__)

def run_simulation(sim_config_path: Union[str, Path], db_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Run a simulation based on configuration
    
    Args:
        sim_config_path: Path to the simulation configuration file
        db_path: Path to the SQLite database
        
    Returns:
        Dictionary with simulation results
    """
    # Parse simulation configuration
    sim_config = parse_sim_config(sim_config_path)
    
    # Ensure entity and event tables exist
    ensure_simulation_tables(sim_config, db_path)
    
    # Create and run simulator
    simulator = EventSimulator(sim_config, db_path)
    results = simulator.run()
    
    logger.info(f"Simulation completed: {results}")
    return results

def ensure_simulation_tables(sim_config, db_path: Union[str, Path]):
    """
    Ensure that the necessary tables for simulation exist in the database
    
    Args:
        sim_config: Simulation configuration
        db_path: Path to the SQLite database
    """
    if not sim_config.event_simulation:
        return
        
    entity_table = sim_config.event_simulation.entity_table
    event_table = sim_config.event_simulation.event_table
    relationship_column = sim_config.event_simulation.relationship_column
    
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
        logger.info(f"Creating event table: {event_table}")
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

def run_simulation_from_config_dir(sim_config_dir: Union[str, Path], db_path: Union[str, Path]) -> Dict[str, Dict[str, Any]]:
    """
    Run simulations for all configuration files in a directory
    
    Args:
        sim_config_dir: Directory containing simulation configuration files
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
            sim_results = run_simulation(config_file, db_path)
            results[config_name] = sim_results
        except Exception as e:
            logger.error(f"Error running simulation for {config_name}: {e}")
            results[config_name] = {"error": str(e)}
    
    return results 