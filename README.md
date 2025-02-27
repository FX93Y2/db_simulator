# DB Simulator

A simulation framework for generating synthetic databases and running discrete event simulations with configurable resource allocation and work shift patterns.

## Overview

DB Simulator models systems where entities (like projects) arrive over time, generate events (like deliverables) that need processing, and consume resources (like consultants) that may operate on specific work schedules.

The framework provides:
- Synthetic database generation with configurable schemas
- Event-based simulation using SimPy
- Resource allocation with optional work shift patterns
- Detailed tracking of simulation events and resource utilization

## Key Features

- **Database Generation**: Create synthetic databases with configurable entities and relationships
- **Dynamic Entity Generation**: Entities arrive according to configurable patterns during simulation
- **Resource Allocation**: Allocate resources to events based on requirements
- **Work Shifts**: Optional work patterns for different resource types
- **Simulation Tracking**: Record entity arrivals, event processing, and resource allocations

## Installation

### Prerequisites
- Python 3.8+
- SQLite


## Usage

### Running a Simulation
```bash
python -m src.cli dynamic-simulate config/db_config/demo_db.yaml config/sim_config/event_simulation.yaml
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

## Troubleshooting

For large simulations, you may encounter SQLAlchemy connection pool errors. Use the provided fix script:
```bash
python scripts/fix_connection_pool.py
```

## Detailed Explanation

see [doc/simulation_workflow.md](doc/simulation_workflow.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details. 