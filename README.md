# Database Simulator

A Python-based system for generating synthetic databases and running discrete event simulations on the generated data.

## Features

- Synthetic database generation using Faker
- Configurable entity and resource definitions via YAML
- Discrete event simulation using SimPy
- Resource allocation and tracking
- Detailed simulation logs and metrics

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd db_simulator
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

The system can be used in two modes:

### Database Generation Mode

To generate synthetic data based on a database configuration:

```bash
python src/main.py --db-config config/demo_db.yaml
```

### Simulation Mode

To run a simulation using both database and simulation configurations:

```bash
python src/main.py --db-config config/demo_db.yaml --sim-config config/demo_sim.yaml
```

## Configuration

### Database Configuration (demo_db.yaml)

The database configuration defines entities and their attributes:

```yaml
entities:
  - name: Consultant
    type: resource
    rows: 50
    attributes:
      - name: id
        type: pk
      - name: name
        type: string
        generator:
          type: faker
          method: name
```

### Simulation Configuration (demo_sim.yaml)

The simulation configuration defines simulation parameters and behaviors:

```yaml
simulation:
  duration: 100
  resources:
    capacity: 1
  entities:
    behavior:
      request_interval: 5
      usage_duration: 10
```

## Output

The simulation generates a mapping table in the database that tracks:
- Entity-Resource relationships
- Allocation and release timestamps
- Event types

## License

MIT License
