from pathlib import Path
from src.config.db_config import DatabaseConfigParser
from src.config.sim_config import SimulationConfigParser
from pprint import pprint

def test_parsers():
    # Parse database config
    db_config = DatabaseConfigParser.parse(Path("config/demo_db.yaml"))
    
    print("\n=== Database Configuration ===")
    print(f"\nNumber of entities: {len(db_config.entities)}")
    
    for entity in db_config.entities:
        print(f"\nEntity: {entity.name}")
        print(f"Rows to generate: {entity.rows}")
        print("Attributes:")
        for attr in entity.attributes:
            print(f"  - {attr.name} ({attr.type})")
            if attr.ref:
                print(f"    Foreign key reference: {attr.ref}")
            if attr.generator:
                print(f"    Generator: {attr.generator}")
            if attr.simulation_arrival:
                print(f"    Simulation arrival: {attr.simulation_arrival}")
    
    # Parse simulation config
    sim_config = SimulationConfigParser.parse(Path("config/demo_sim.yaml"))
    
    print("\n=== Simulation Configuration ===")
    print(f"\nDuration: {sim_config.simulation.duration} {sim_config.simulation.time_unit}")
    print(f"Time window: {sim_config.simulation.timing.start_time} to {sim_config.simulation.timing.end_time}")
    
    print("\nProcesses:")
    for process in sim_config.processes:
        print(f"\nProcess: {process.name}")
        print(f"Description: {process.description}")
        print(f"Entity table: {process.entity_table}")
        print(f"Resource table: {process.resource_table}")
        print("Entity types:", process.entity_type)
        print("Resource types:", process.resource_type)
        print("\nRequirements:")
        for req in process.requirements:
            print(f"  Entity type: {req.entity_type}")
            for resource_need in req.needs:
                print(f"    Needs: {resource_need.quantity} x {resource_need.resource_type}")
        print(f"Duration config: {process.duration}")
        print(f"Capacity config: {process.capacity}")
    
    print("\nMetrics:")
    for metric in sim_config.metrics:
        print(f"\n- {metric.name}")
        print(f"  Description: {metric.description}")
        print(f"  Type: {metric.type}")
        print(f"  Unit: {metric.unit}")
        if metric.aggregation:
            print(f"  Aggregation: {metric.aggregation}")

if __name__ == "__main__":
    test_parsers() 