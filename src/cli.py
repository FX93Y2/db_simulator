"""
Command-line interface for the DB Simulator
"""

import argparse
import logging
import sys
import sqlite3
from pathlib import Path

from src.generator import generate_database, generate_database_for_simulation
from src.simulation.runner import run_simulation, run_simulation_from_config_dir

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def count_bridging_records(db_path):
    """Count records in the Deliverable_Consultant bridging table"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM Deliverable_Consultant")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    except Exception as e:
        logger.error(f"Error counting bridging records: {e}")
        return 0

def main():
    """Main entry point for the CLI"""
    parser = argparse.ArgumentParser(description='Database Simulator')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Generate database command
    gen_parser = subparsers.add_parser('generate', help='Generate a synthetic database')
    gen_parser.add_argument('config', help='Path to database configuration file')
    gen_parser.add_argument('--output-dir', '-o', default='output', help='Output directory')
    gen_parser.add_argument('--name', '-n', help='Database name (without extension)')
    
    # Run simulation command
    sim_parser = subparsers.add_parser('simulate', help='Run a simulation')
    sim_parser.add_argument('config', help='Path to simulation configuration file')
    sim_parser.add_argument('database', help='Path to SQLite database file')
    
    # Run all simulations in a directory
    sim_all_parser = subparsers.add_parser('simulate-all', help='Run all simulations in a directory')
    sim_all_parser.add_argument('config_dir', help='Directory containing simulation configuration files')
    sim_all_parser.add_argument('database', help='Path to SQLite database file')
    
    # Generate resources and run simulation command
    dynamic_parser = subparsers.add_parser('dynamic-simulate', 
                                          help='Generate a database with only resource tables and run a simulation with dynamic entity generation')
    dynamic_parser.add_argument('db_config', help='Path to database configuration file')
    dynamic_parser.add_argument('sim_config', help='Path to simulation configuration file')
    dynamic_parser.add_argument('--output-dir', '-o', default='output', help='Output directory')
    dynamic_parser.add_argument('--name', '-n', help='Database name (without extension)')
    
    # Parse arguments
    args = parser.parse_args()
    
    if args.command == 'generate':
        try:
            db_path = generate_database(args.config, args.output_dir, args.name)
            logger.info(f"Database generated at: {db_path}")
        except Exception as e:
            logger.error(f"Error generating database: {e}")
            sys.exit(1)
    
    elif args.command == 'simulate':
        try:
            results = run_simulation(args.config, args.database)
            bridging_count = count_bridging_records(args.database)
            logger.info(f"Simulation results: {results}")
            logger.info(f"Created {bridging_count} records in the Deliverable_Consultant bridging table")
        except Exception as e:
            logger.error(f"Error running simulation: {e}")
            sys.exit(1)
    
    elif args.command == 'simulate-all':
        try:
            results = run_simulation_from_config_dir(args.config_dir, args.database)
            bridging_count = count_bridging_records(args.database)
            logger.info(f"Simulation results: {results}")
            logger.info(f"Created {bridging_count} records in the Deliverable_Consultant bridging table")
        except Exception as e:
            logger.error(f"Error running simulations: {e}")
            sys.exit(1)
    
    elif args.command == 'dynamic-simulate':
        try:
            # Generate database with only resource tables
            db_path = generate_database_for_simulation(args.db_config, args.sim_config, args.output_dir, args.name)
            logger.info(f"Resource database generated at: {db_path}")
            
            # Run simulation with dynamic entity generation
            results = run_simulation(args.sim_config, db_path)
            bridging_count = count_bridging_records(db_path)
            logger.info(f"Simulation results: {results}")
            logger.info(f"Created {bridging_count} records in the Deliverable_Consultant bridging table")
        except Exception as e:
            logger.error(f"Error in dynamic simulation: {e}")
            sys.exit(1)
    
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == '__main__':
    main() 