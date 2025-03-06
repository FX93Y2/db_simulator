# Event Sequences in DB Simulator

This document explains the event sequence feature in DB Simulator, which allows for more controlled and realistic simulations by defining specific event types and their transitions.

## Overview

The event sequence feature enhances the DB Simulator by allowing users to define:

1. Specific event types with their own durations and resource requirements
2. Probabilistic transitions between event types (similar to Markov chains)
3. Initial event types for each entity

This creates more realistic simulations by modeling actual workflow processes rather than just random events.

## Configuration

Event sequences are configured in the simulation configuration YAML file:

```yaml
event_simulation:
  # ... other configuration ...
  
  # Event sequence configuration
  event_sequence:
    enabled: true
    
    # Define event types
    event_types:
      - name: "Requirements"
        duration:
          distribution:
            type: normal
            mean: 3
            stddev: 0.5
            min: 2
            max: 5
        resource_requirements:
          - resource_type: "Business Analyst"
            count: 1
          - resource_type: "Tech Lead"
            count: 1
      
      # ... more event types ...
    
    # Define transitions between event types
    transitions:
      - from: "Requirements"
        to:
          - event_type: "Design"
            probability: 1.0
      
      - from: "Design"
        to:
          - event_type: "Development"
            probability: 0.7
          - event_type: "Design_Revision"
            probability: 0.3
      
      # ... more transitions ...
    
    # The initial event type for each entity
    initial_event: "Requirements"
```

## Key Components

### Event Types

Each event type has:

- A unique name
- A duration distribution (how long the event takes to process)
- Resource requirements (what resources are needed to process the event)

Example:

```yaml
- name: "Design"
  duration:
    distribution:
      type: normal
      mean: 5
      stddev: 1
      min: 3
      max: 8
  resource_requirements:
    - resource_type: "Tech Lead"
      count: 1
    - resource_type: "Developer"
      count: 2
```

### Transitions

Transitions define how entities move from one event type to another:

- `from`: The source event type
- `to`: A list of possible destination event types with probabilities

Example:

```yaml
- from: "Design"
  to:
    - event_type: "Development"
      probability: 0.7
    - event_type: "Design_Revision"
      probability: 0.3
```

In this example, after a "Design" event is completed:
- 70% of the time, the next event will be "Development"
- 30% of the time, the next event will be "Design_Revision"

### Initial Event

The `initial_event` parameter defines the first event type for each entity:

```yaml
initial_event: "Requirements"
```

## Example Workflow

With the configuration shown above, entities would follow this workflow:

1. All entities start with a "Requirements" event
2. After "Requirements" is completed, all entities move to "Design"
3. After "Design" is completed:
   - 70% of entities move to "Development"
   - 30% of entities move to "Design_Revision"
4. After "Design_Revision" is completed, all entities move to "Development"
5. After "Development" is completed, all entities move to "Testing"
6. After "Testing" is completed:
   - 80% of entities move to "Deployment"
   - 20% of entities move to "Extended_Testing"
7. After "Extended_Testing" is completed, all entities move to "Deployment"
8. "Deployment" is a terminal event (no further transitions)

## Running a Simulation with Event Sequences

To run a simulation with event sequences:

```bash
python -m src.cli dynamic-simulate config/db_config/demo_db.yaml config/sim_config/event_sequence_simulation.yaml
```

## Output

The simulation will generate a database with:

- Entities (Projects) created according to the arrival pattern
- Events (Deliverables) created according to the defined sequences
- Resource allocations based on event type-specific requirements

The event table will look like:

| Project_id | Deliverable_id | Event_type      |
|------------|----------------|-----------------|
| PRJ001     | DEL001         | Requirements    |
| PRJ001     | DEL002         | Design          |
| PRJ001     | DEL003         | Development     |
| PRJ001     | DEL004         | Testing         |
| PRJ001     | DEL005         | Deployment      |
| PRJ002     | DEL006         | Requirements    |
| PRJ002     | DEL007         | Design          |
| PRJ002     | DEL008         | Design_Revision |
| PRJ002     | DEL009         | Development     |
| PRJ002     | DEL010         | Testing         |
| PRJ002     | DEL011         | Extended_Testing|
| PRJ002     | DEL012         | Deployment      | 