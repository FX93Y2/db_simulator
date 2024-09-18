from src.engine.simulation_engine import SimulationEngine
from src.generators.schema_generator import SchemaGenerator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def main():
    # Initialize and run simulation
    engine = SimulationEngine('config/simulation_config.yaml')
    engine.load_config()
    engine.run_simulation()
    simulated_data = engine.get_simulated_data()

    # Generate SQLAlchemy models
    schema_gen = SchemaGenerator(engine.config)
    models = schema_gen.generate_models()

    # Create database and tables
    db_engine = create_engine('sqlite:///project_tracking.db')
    for model in models.values():
        model.__table__.create(db_engine)

    # Insert simulated data
    Session = sessionmaker(bind=db_engine)
    session = Session()

    for entity_name, instances in simulated_data.items():
        model = models[entity_name]
        for instance in instances:
            db_instance = model(**instance)
            session.add(db_instance)

    session.commit()
    session.close()

    print("Simulation completed and data inserted into the database.")

if __name__ == "__main__":
    main()