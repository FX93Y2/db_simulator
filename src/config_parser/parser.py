import yaml

def parse_config(config_path):
    with open(config_path, 'r') as file:
        config = yaml.safe_load(file)
    
    # Validate config structure
    required_keys = ['entities', 'events', 'simulation_parameters', 'initial_population']
    for key in required_keys:
        if key not in config:
            raise ValueError(f"Missing required key in configuration: {key}")
    
    return config