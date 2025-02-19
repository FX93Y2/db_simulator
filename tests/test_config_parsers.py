from pathlib import Path
from src.config.db_config import DatabaseConfigParser
from src.config.sim_config import SimulationConfigParser
from pprint import pprint

def test_parsers():
    print("\n=== Testing Configuration Parsers ===")
    
    # Test Database Configuration
    print("\n--- Database Configuration ---")
    db_config = DatabaseConfigParser.parse(Path("config/db_config/demo_db.yaml"))
    
    for entity in db_config.entities:
        print(f"\nEntity: {entity.name}")
        print(f"Type: {entity.type}")
        print(f"Rows: {entity.rows if entity.rows != 'n/a' else 'Dynamic'}")
        print("Attributes:")
        for attr in entity.attributes:
            print(f"  - {attr.name} ({attr.type})")
            if attr.generator:
                print(f"    Generator: {attr.generator.type}")
                if hasattr(attr.generator, 'simulation_override') and attr.generator.simulation_override:
                    print(f"    Simulation override enabled")
    
    # Test Simulation Configurations
    print("\n--- Simulation Configurations ---")
    
    # Parse general simulation settings
    general_config = SimulationConfigParser.parse(Path("config/sim_config/general_sim.yaml"))
    print("\nGeneral Simulation Settings:")
    print(f"Duration: {general_config.simulation.duration} {general_config.simulation.time_unit}")
    print(f"Time window: {general_config.simulation.timing.start_time} to {general_config.simulation.timing.end_time}")
    
    # Parse and verify process sequence
    if general_config.process_sequence:
        print("\nProcess Sequence:")
        for proc in general_config.process_sequence:
            print(f"\n  Process: {proc.name}")
            print(f"  Config file: {proc.config_file}")
            if proc.dependencies:
                print(f"  Dependencies: {', '.join(proc.dependencies)}")
            else:
                print("  Dependencies: None")
    
    # Parse and verify individual process configurations
    process_configs = {}
    process_files = [
        ("design", "config/sim_config/design_sim.yaml"),
        ("coding", "config/sim_config/coding_sim.yaml"),
        ("testing", "config/sim_config/testing_sim.yaml")
    ]
    
    print("\nProcess Configurations:")
    for name, file_path in process_files:
        config = SimulationConfigParser.parse(Path(file_path))
        process_configs[name] = config.process
        
        print(f"\n  {name.capitalize()} Process:")
        print(f"  Name: {config.process.name}")
        print(f"  Description: {config.process.description}")
        
        # Entity tables
        print("  Entity Tables:")
        print(f"    Parent: {config.process.entity_table.parent_table.name}")
        print(f"    Child: {config.process.entity_table.child_table.name}")
        
        # Arrival patterns
        parent_arrival = config.process.entity_table.parent_table.arrival_pattern
        if parent_arrival:
            print(f"    Parent arrival: {parent_arrival.type} (rate: {parent_arrival.rate})")
            
        child_arrival = config.process.entity_table.child_table.arrival_pattern
        if child_arrival:
            print(f"    Child arrival: delay={child_arrival.delay}, count={child_arrival.count}")
        
        # Resource requirements
        print("  Requirements:")
        for req in config.process.requirements:
            print(f"    Entity type: {req['entity_type']}")
            for need in req['needs']:
                print(f"      Needs: {need['quantity']} {need['resource_type']}")
        
        # Duration
        print(f"  Duration: {config.process.duration['distribution']}")

if __name__ == "__main__":
    test_parsers() 