from src.sim_engine.engine import SimulationEngine

def main():
    config_path = 'config/example_simulation_config.yaml'
    engine = SimulationEngine(config_path)
    engine.run()

if __name__ == "__main__":
    main()