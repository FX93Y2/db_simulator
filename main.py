import argparse
import os
from src.sim_engine.engine import SimulationEngine
from src.config_parser.parser import parse_config
from src.database.db_manager import DatabaseManager
from src.data_generator.entity_generator import generate_initial_entities

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Generate database from YAML configuration.")
    parser.add_argument("-c", "--config",
                        help="Name of the YAML configuration file under the config directory")
    args = parser.parse_args()
    
    config_dir = os.path.join(os.path.dirname(__file__), 'config')
    config_path = os.path.join(config_dir, args.config)

    if not os.path.exists(config_path):
        print(f"Error: Configuration file '{args.config}' not found in the config directory.")
        return

    config = parse_config(config_path)
    db_manager = DatabaseManager(config, args.config)
    
    initial_entities = generate_initial_entities(config)
    for entity_type, entities in initial_entities.items():
        db_manager.bulk_insert(entity_type, entities)

    print(f"Database setup completed successfully using configuration: {args.config}")

if __name__ == "__main__":
    main()