import os
from src.engine.simulation_engine import SimulationEngine
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def main():
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)

    engine = SimulationEngine('config/library_example.yaml')
    engine.load_config()
    engine.run_simulation()
    simulated_data = engine.get_simulated_data()

    # Create database and tables
    db_path = os.path.join(output_dir, 'library_example.db')
    db_engine = create_engine(f'sqlite:///{db_path}')
    engine.Base.metadata.create_all(db_engine)

    # Insert simulated data
    Session = sessionmaker(bind=db_engine)
    session = Session()

    for instances in simulated_data.values():
        for instance in instances:
            session.add(instance)

    session.commit()
    session.close()

    print("Simulation completed and data inserted into the database.")

if __name__ == "__main__":
    main()