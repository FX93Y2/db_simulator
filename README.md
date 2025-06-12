# DB Simulator

A discrete event simulation tool for modeling and analyzing database workloads with advanced resource management capabilities.

## Overview

DB Simulator generates synthetic databases and simulates complex workloads to help analyze performance, resource utilization, and system behavior. The application combines a Python simulation engine with an Electron-based GUI for comprehensive database performance analysis.

## Key Features

- **Synthetic Database Generation**: Create realistic test databases with configurable schemas
- **Discrete Event Simulation**: Model entity arrivals, event processing, and resource allocation using SimPy
- **Advanced Resource Management**: FilterStore-based individual resource tracking with efficient pooling
- **Interactive Visualization**: Real-time results through charts, ER diagrams, and dashboards
- **YAML Configuration**: Easy-to-use configuration files for databases and simulations
- **Cross-Platform GUI**: Electron + React desktop application

## Architecture

### Backend (Python)
- **Flask API Server**: RESTful endpoints for frontend integration
- **SimPy Simulation Engine**: Discrete event simulation with FilterStore resource management
- **SQLAlchemy ORM**: Database abstraction and synthetic data generation
- **Configuration Parsers**: YAML-based database and simulation configuration
- **Resource Manager**: Individual resource tracking with utilization metrics

### Frontend (Electron + React)
- **Project Management**: Organize configurations and results
- **Configuration Editors**: YAML editors with syntax highlighting
- **Visualization Components**: Charts, ER diagrams, and result dashboards
- **Cross-Platform Desktop App**: Windows, macOS, and Linux support

### Storage
- **SQLite**: Configuration storage and generated databases
- **YAML Files**: Human-readable configuration format
- **CSV Export**: Results export for external analysis

## Technology Stack

**Backend**: Python 3.8+, SimPy 4.1+, Flask 3.1+, SQLAlchemy 2.0+, Faker 37+  
**Frontend**: Electron, React, Node.js 16+  
**Storage**: SQLite, YAML, CSV

## Quick Start

### Prerequisites
- Python 3.8+ with pip
- Node.js 16+ with npm

### Installation
```bash
# Install Python dependencies
pip install -r python/requirements.txt

# Install Electron dependencies
cd electron && npm install
```

### Run Application
```bash
# Development mode (starts both backend and frontend)
cd electron && npm run dev
```

### CLI Usage
```bash
cd python

# Generate database
python main.py generate path/to/db_config.yaml --output-dir output

# Run simulation
python main.py simulate path/to/sim_config.yaml path/to/db_config.yaml path/to/database.db

# Generate and simulate
python main.py generate-simulate path/to/db_config.yaml path/to/sim_config.yaml
```

## Configuration

### Database Schema (YAML)
```yaml
entities:
  - name: Project
    type: entity
    rows: 10
    attributes:
      - name: id
        type: pk
      - name: name
        type: string
        generator:
          type: faker
          method: company

  - name: Consultant
    type: resource
    rows: 30
    attributes:
      - name: id
        type: pk
      - name: role
        type: resource_type
        generator:
          type: distribution
          distribution:
            type: choice
            values: ["Developer", "Tester", "Tech Lead"]
```

### Simulation Parameters (YAML)
```yaml
simulation:
  duration_days: 60
  start_date: 2024-01-01
  random_seed: 42

event_simulation:
  entity_arrival:
    interarrival_time:
      distribution:
        type: exponential
        scale: 5

  event_sequence:
    event_types:
      - name: Requirements
        duration:
          distribution:
            type: normal
            mean: 3
            stddev: 0.5
        resource_requirements:
          - resource_table: Consultant
            value: Developer
            count: 1
```

## Workflow

1. **Create Project**: Set up workspace and define project parameters
2. **Design Database**: Configure entities, attributes, and relationships
3. **Configure Simulation**: Define event sequences and resource requirements
4. **Generate Database**: Create synthetic data based on schema
5. **Run Simulation**: Execute discrete event simulation
6. **Analyze Results**: View metrics, charts, and export data

## Resource Management

The system uses SimPy's FilterStore for advanced resource management:

- **Individual Tracking**: Each database row represents a unique resource
- **Efficient Allocation**: FilterStore provides optimal resource pooling
- **Flexible Filtering**: Resources filtered by type, skills, or any attribute
- **Utilization Metrics**: Real-time tracking of resource usage and performance

## Examples

Sample configurations available in `tests/test_config/`:
- `demo_db.yaml` - Basic database schema
- `demo_sim.yaml` - Simulation configuration
- `support_ticket_db.yaml` - Support system example

## Documentation

- **API Reference**: See `python/api/README.md`
- **Configuration Guide**: See `python/doc/`
- **Examples**: See `tests/test_config/`

## Development

```bash
# Install development dependencies
pip install -r python/requirements.txt
cd electron && npm install

# Run tests
python -m pytest tests/
npm test
```

## License

MIT License - see LICENSE file for details.

---

**DB Simulator** - Advanced discrete event simulation for database performance analysis.