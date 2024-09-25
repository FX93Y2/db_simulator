from src.engine.simulation_engine import SimulationEngine
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

def main():
    # Initialize
    engine = SimulationEngine('config/simulation_config.yaml')
    engine.load_config()
    engine.run_simulation()
    simulated_data = engine.get_simulated_data()

    # Create database
    db_engine = create_engine('sqlite:///project_tracking.db')
    engine.Base.metadata.create_all(db_engine)

    # Insert simulated data
    Session = sessionmaker(bind=db_engine)
    session = Session()

    try:
        for entity_name, instances in simulated_data.items():
            print(f"Inserting {len(instances)} {entity_name} instances...")
            for instance in instances:
                session.add(instance)
            session.flush()

        session.commit()
        print("Simulation completed and data inserted into the database.")
    except SQLAlchemyError as e:
        session.rollback()
        print(f"An error occurred while inserting data: {str(e)}")
    finally:
        session.close()

if __name__ == "__main__":
    main()