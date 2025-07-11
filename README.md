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

## Workflow

1. **Create Project**: Set up workspace
2. **Design Database**: Configure entities, attributes, and relationships
3. **Configure Simulation**: Define discrete event simulation
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


## License

MIT License - see LICENSE file for details.

---

**DB Simulator** - Advanced discrete event simulation for database performance analysis.