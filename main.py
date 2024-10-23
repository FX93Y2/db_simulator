import argparse
import os
import logging
from src.sim_engine.engine import SimulationEngine

def main():
    # Set up logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    parser = argparse.ArgumentParser(description="Run business process simulation.")
    parser.add_argument("-c", "--config", required=True,
                       help="Name of the YAML configuration file under the config directory")
    args = parser.parse_args()
    
    config_dir = os.path.join(os.path.dirname(__file__), 'config')
    config_path = os.path.join(config_dir, args.config)

    if not os.path.exists(config_path):
        print(f"Error: Configuration file '{args.config}' not found in the config directory.")
        return

    engine = SimulationEngine(config_path)
    engine.run()

    print(f"Simulation completed successfully using configuration: {args.config}")

if __name__ == "__main__":
    main()