# DB Simulator

A simulation framework for generating synthetic databases and running discrete event simulations with configurable resource allocation and work shift patterns.

## Overview

DB Simulator models systems where entities (like projects) arrive over time, generate events (like deliverables) that need processing, and consume resources (like consultants) that may operate on specific work schedules.

The framework provides:
- Synthetic database generation with configurable schemas
- Event-based simulation using SimPy
- Resource allocation with optional work shift patterns
- Detailed tracking of simulation events and resource utilization
- Electron-based GUI for easy interaction
- Configuration management via SQLite database

## Project Structure

```
db_simulator/
├── electron/                # Electron application
├── python/                  # Python backend
│   ├── api/                 # API layer for Electron integration
│   ├── config_storage/      # Configuration database management
│   ├── src/                 # Source code
│   │   ├── config_parser/   # Configuration parsers
│   │   ├── generator/       # Database generator
│   │   ├── simulation/      # Simulation engine
│   │   └── utils/           # Utility functions
│   └── main.py              # Entry point for Python code
├── config/                  # Default configuration templates
├── output/                  # Output directory for simulation results
└── package.json             # Project metadata
```

## Key Features

- **Database Generation**: Create synthetic databases with configurable entities and relationships
- **Dynamic Entity Generation**: Entities arrive according to configurable patterns during simulation
- **Resource Allocation**: Allocate resources to events based on requirements
- **Work Shifts**: Optional work patterns for different resource types
- **Simulation Tracking**: Record entity arrivals, event processing, and resource allocations
- **GUI**: Electron-based graphical interface for easier management
- **Configuration Storage**: Persistent storage of configurations in SQLite

## Installation

### Prerequisites
- Python 3.8+
- Node.js 14+ and npm
- Electron

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/db-simulator.git
cd db-simulator
```

2. Install Python dependencies:
```bash
npm run python-setup
# or directly:
pip install -r python/requirements.txt
```

3. Install JavaScript dependencies:
```bash
npm install
```

## Usage

### Running the application

```bash
npm run dev
```

This will start both the Electron frontend and Python API server.

### Running just the Python backend

```bash
python -m python.main api
```

### Command Line Usage

You can still use the CLI for certain operations:

```bash
python -m python.main generate config/db_config/demo_db.yaml --output-dir output
python -m python.main simulate config/sim_config/event_simulation.yaml output/demo_db.sqlite
```

## Configuration

### Key Configuration Parameters

#### Entity Arrival
The entity arrival configuration significantly impacts simulation performance:
```yaml
entity_arrival:
  interarrival_time:
    distribution:
      type: exponential
      scale: 15  # Mean time between arrivals (days)
      min: 0.5   # Minimum interarrival time
```

Setting appropriate interarrival times is crucial - too short times create too many entities that overwhelm available resources.

#### Work Shifts
Work shifts can be enabled/disabled to control resource availability:
```yaml
work_shifts:
  enabled: false  # Set to true to enable work shift restrictions
  shift_patterns:
    - name: "Regular Weekday"
      days: [0, 1, 2, 3, 4]  # Monday to Friday
      start_time: "07:00"
      end_time: "19:00"
```

#### Resource Requirements
Each event requires specific resources:
```yaml
resource_requirements:
  - resource_table: Consultant
    type_column: role
    requirements:
      - resource_type: Developer
        count:
          distribution:
            type: normal
            mean: 2
            min: 1
            max: 3
```

## Building for Distribution

To build the application for distribution:

```bash
npm run build
```

This will create platform-specific distributables in the `electron/dist` directory.

## Troubleshooting

For large simulations, you may encounter SQLAlchemy connection pool errors. Use the provided fix script:
```bash
python scripts/fix_connection_pool.py
```

## Detailed Explanation

see [doc/simulation_workflow.md](doc/simulation_workflow.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details. 