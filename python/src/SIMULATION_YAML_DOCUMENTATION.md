# Simulation YAML Configuration Documentation

This document provides comprehensive documentation for the DB Simulator's simulation YAML configuration structure. It serves as the definitive reference for understanding and creating simulation configurations, with particular focus on the flow_id section as entry points to the discrete event simulation system.

## Table of Contents

1. [Overall YAML Structure](#overall-yaml-structure)
2. [Simulation Settings Section](#simulation-settings-section)
3. [Event Flows Configuration](#event-flows-configuration)
4. [Step Types Documentation](#step-types-documentation)
5. [Resource Management](#resource-management)
6. [Distribution Formulas](#distribution-formulas)
7. [Complete Working Examples](#complete-working-examples)

## Overall YAML Structure

The simulation YAML configuration is divided into two main sections:

```yaml
simulation:
  # Global simulation parameters
  base_time_unit: hours
  terminating_conditions: TIME(200)
  start_date: 2024-01-01
  random_seed: 42
  resources:
    # Resource capacity configuration (optional)

event_simulation:
  # Event flow definitions and table specifications
  event_flows:
    # List of discrete event flows (each with unique flow_id)
```

### Flow ID as Entry Points

Each **flow_id** serves as a unique entry point to the simulation system. The simulation engine uses these identifiers to:

- Initialize separate discrete event processes
- Track entities through different workflow paths
- Manage resource allocation across concurrent flows
- Generate flow-specific event logs and metrics

**Key Characteristics of flow_id:**
- Must be globally unique across all event flows
- Acts as the primary identifier for the entire workflow
- Required for every event flow definition
- Used in simulation results and event tracking

## Simulation Settings Section

The `simulation` section contains global parameters that affect the entire simulation run:

### Required Parameters

```yaml
simulation:
  base_time_unit: hours              # Required: seconds | minutes | hours | days
  terminating_conditions: TIME(200)  # Required: Simulation termination formula
```

### Optional Parameters

```yaml
simulation:
  start_date: 2024-01-01            # Optional: Start date (YYYY-MM-DD format)
  random_seed: 42                   # Optional: Seed for reproducible results
  resources:                        # Optional: Resource capacity configuration
    - resource_table: Staff         # Table containing resource records
      capacities:                   # Type-specific capacities
        SRE: 1                      # Resource type: capacity count
        "Tech Support": 1           # Use quotes for multi-word types
        Dev: 1
        Security: 1
```

### Base Time Units

Supported time units with their conversion factors:

| Unit | String | Conversion to Minutes |
|------|--------|--------------------|
| Seconds | `seconds` | 1/60 |
| Minutes | `minutes` | 1 (base unit) |
| Hours | `hours` | 60 |
| Days | `days` | 1440 |

### Terminating Conditions

Terminating conditions define when the simulation should stop. Multiple formula types are supported:

#### Time-Based Termination
```yaml
terminating_conditions: TIME(200)        # Stop after 200 time units
terminating_conditions: TIME(720)        # Stop after 720 time units (12 hours if base_time_unit is minutes)
```

#### Entity Count Termination
```yaml
terminating_conditions: ENTITIES(Order, 100)      # Stop when Order table has 100 entities
terminating_conditions: ENTITIES(Customer, 50)    # Stop when Customer table has 50 entities
```

#### Combined Conditions (Logical Operations)
```yaml
terminating_conditions: TIME(720) OR ENTITIES(Order, 1000)    # Stop at either condition
terminating_conditions: TIME(480) AND ENTITIES(Ticket, 200)   # Stop when both conditions met
```

## Event Flows Configuration

Event flows define the discrete event processes that drive the simulation. Each flow represents a complete workflow from entity creation to completion.

### Flow Structure

```yaml
event_simulation:
  event_flows:
    - flow_id: flow_1_Create_Ticket        # Required: Unique identifier
      event_table: Online_Ticket           # Required: Table for event logging
      steps:                               # Required: List of workflow steps
        # Step definitions...
```

### Flow Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `flow_id` | string | Yes | Unique identifier for the entire workflow |
| `event_table` | string | Yes | Database table for logging events from this flow |
| `steps` | array | Yes | Ordered list of steps that define the workflow |

### Step Interconnection Model

Steps are connected using the `next_steps` property, creating a directed graph of workflow paths:

```yaml
steps:
  - step_id: Create_Ticket
    step_type: create
    # ... config ...
    next_steps:
      - Event_Ticket_Assignment    # Single next step
  
  - step_id: complexity_decision
    step_type: decide
    # ... config ...
    # No next_steps - connections defined in decide_config outcomes
  
  - step_id: process_ticket
    step_type: event
    # ... config ...
    next_steps:
      - assign_status
      - send_notification         # Multiple next steps (parallel execution)
```

## Step Types Documentation

The simulation system supports five core step types, each serving a specific purpose in the workflow:

### 1. Create Step - Entity Generation

**Purpose**: Generate new entities with specified arrival patterns (entry point for flows)

```yaml
- step_id: Create_Ticket
  step_type: create
  create_config:
    entity_table: Online_Ticket          # Required: Target entity table
    interarrival_time:                    # Required: Time between arrivals
      formula: EXPO(2)                    # Exponential distribution with mean 2
    max_entities: n/a                     # Optional: Limit (n/a = unlimited)
    entities_per_arrival: 1               # Optional: Entities per arrival event
  next_steps:
    - Event_Ticket_Assignment
```

**Create Configuration Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `entity_table` | string | Yes | Database table to create entities in |
| `interarrival_time` | distribution | Yes | Time between entity arrivals |
| `max_entities` | int/string | No | Maximum entities to create (n/a = unlimited) |
| `entities_per_arrival` | int/distribution | No | Number of entities per arrival event |

### 2. Event Step - Processing with Resources

**Purpose**: Process entities with duration and optional resource requirements

```yaml
- step_id: Event_Ticket_Assignment
  step_type: event
  event_config:
    duration:                             # Required: Processing duration
      formula: NORM(5, 1)                 # Normal distribution: mean=5, stddev=1
    resource_requirements:                # Optional: Required resources
      - resource_table: Staff             # Resource table name
        value: "Tech Support"             # Resource type value
        count: 1                          # Number of resources needed
        capacity_per_resource: 1          # Capacity required per resource
  next_steps:
    - ticket_complexity_decision
```

**Event Configuration Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `duration` | distribution | Yes | Time to complete the processing |
| `resource_requirements` | array | No | List of required resources |

**Resource Requirement Structure:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `resource_table` | string | Yes | Table containing resource records |
| `value` | string | Yes | Value in the resource_type column |
| `count` | integer | Yes | Number of resources needed |
| `capacity_per_resource` | integer | No | Capacity needed per resource (default: 1) |

### 3. Decide Step - Conditional Branching

**Purpose**: Route entities based on probability or conditional logic

#### 3a. Two-Way Chance Decision (2way-chance)

Routes entities between two paths based on probability:

```yaml
- step_id: ticket_complexity_decision
  step_type: decide
  decide_config:
    decision_type: 2way-chance
    outcomes:
      - outcome_id: simple_ticket
        next_step_id: simple_ticket_processing
        conditions:
          - if: Probability
            is: ==
            value: 0.7                    # 70% probability
      - outcome_id: complex_ticket        # Automatically gets remaining 30%
        next_step_id: complex_ticket_processing
        conditions: []                    # Empty conditions = else case
```

#### 3b. Two-Way Conditional Decision (2way-condition)

Routes entities based on attribute values:

```yaml
- step_id: quality_check
  step_type: decide
  decide_config:
    decision_type: 2way-condition
    outcomes:
      - outcome_id: high_quality
        next_step_id: deployment
        conditions:
          - if: Attribute
            name: quality_score           # Entity attribute name
            is: ">="                      # Comparison operator
            value: 8                      # Threshold value
      - outcome_id: needs_rework          # Else case
        next_step_id: rework_process
        conditions: []
```

#### 3c. N-Way Chance Decision (nway-chance)

Routes entities among multiple paths with explicit probabilities:

```yaml
- step_id: testing_outcome
  step_type: decide
  decide_config:
    decision_type: nway-chance
    outcomes:
      - outcome_id: success
        next_step_id: deployment
        conditions:
          - if: Probability
            is: ==
            value: 0.6                    # 60%
      - outcome_id: minor_issues
        next_step_id: bug_fixes
        conditions:
          - if: Probability
            is: ==
            value: 0.3                    # 30%
      - outcome_id: major_issues
        next_step_id: redesign
        conditions:
          - if: Probability
            is: ==
            value: 0.1                    # 10% (total must sum to 1.0)
```

#### 3d. N-Way Conditional Decision (nway-condition)

Routes entities among multiple paths based on different attribute conditions:

```yaml
- step_id: priority_routing
  step_type: decide
  decide_config:
    decision_type: nway-condition
    outcomes:
      - outcome_id: critical
        next_step_id: immediate_response
        conditions:
          - if: Attribute
            name: priority_level
            is: ==
            value: critical
      - outcome_id: high
        next_step_id: priority_queue
        conditions:
          - if: Attribute
            name: priority_level
            is: ==
            value: high
      - outcome_id: normal             # Default/else case
        next_step_id: standard_queue
        conditions: []
```

**Decide Configuration Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `decision_type` | string | Yes | `2way-chance`, `2way-condition`, `nway-chance`, `nway-condition` |
| `outcomes` | array | Yes | List of possible outcomes with routing rules |

**Outcome Structure:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `outcome_id` | string | Yes | Unique identifier for this outcome |
| `next_step_id` | string | Yes | Step to route to if conditions match |
| `conditions` | array | No | List of conditions (empty = else case) |

**Condition Structure:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `if` | string | Yes | `Probability` or `Attribute` |
| `name` | string | Conditional | Attribute name (required for Attribute conditions) |
| `is` | string | Yes | Comparison operator: `==`, `!=`, `>`, `>=`, `<`, `<=` |
| `value` | any | Yes | Value to compare against |

### 4. Assign Step - Attribute Assignment

**Purpose**: Assign values to entity attributes

```yaml
- step_id: assign_simple_complete
  step_type: assign
  assign_config:
    assignments:
      - assignment_type: attribute        # Currently only "attribute" supported
        attribute_name: status            # Entity attribute to modify
        value: complete                   # Value to assign
      - assignment_type: attribute
        attribute_name: completion_time
        value: "{{current_time}}"         # Template values supported
  next_steps:
    - release_resources
```

**Assign Configuration Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `assignments` | array | Yes | List of attribute assignments to perform |

**Assignment Operation Structure:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `assignment_type` | string | Yes | Currently only `attribute` supported |
| `attribute_name` | string | Yes | Name of entity attribute to modify |
| `value` | any | Yes | Value to assign (supports templates) |

### 5. Release Step - Flow Termination

**Purpose**: Final step to clean up resources and complete the entity's journey

```yaml
- step_id: release_1
  step_type: release
  # No additional configuration required
  # Automatically releases all allocated resources
  # Marks entity as completed in event logs
```

**Release Configuration Options:**

Release steps require no additional configuration. They automatically:
- Release all resources allocated to the entity
- Log completion events in the event table
- Terminate the entity's flow through the system

## Resource Management

Resources represent limited capacity constraints in the simulation (staff, equipment, etc.).

### Resource Definition in Simulation Section

```yaml
simulation:
  resources:
    - resource_table: Staff             # Database table containing resources
      capacities:                       # Type-specific capacity limits
        SRE: 1                          # Resource type: available count
        "Tech Support": 2               # Use quotes for multi-word types
        Developer: 3
        Manager: 1
```

### Resource Requirements in Event Steps

```yaml
event_config:
  resource_requirements:
    - resource_table: Staff             # Must match table in simulation.resources
      value: "Tech Support"             # Must match type in capacities
      count: 1                          # How many resources needed
      capacity_per_resource: 1          # Optional: capacity per resource unit
```

### Resource Allocation Rules

1. **Finite Capacity**: Resources have limited availability based on `capacities` configuration
2. **FIFO Allocation**: Resources are allocated first-come, first-served
3. **Blocking**: Entities wait if required resources are unavailable
4. **Automatic Release**: Resources are automatically released at release steps or flow completion
5. **Type Matching**: Resource `value` must exactly match a type in the capacity configuration

### Advanced Resource Configuration

#### Work Shifts (Optional)

Define time-based resource availability:

```yaml
event_simulation:
  work_shifts:
    enabled: true
    shift_patterns:
      - name: day_shift
        days: [0, 1, 2, 3, 4]           # Monday-Friday (0=Monday)
        start_time: "09:00"
        end_time: "17:00"
      - name: night_shift
        days: [0, 1, 2, 3, 4]
        start_time: "18:00"
        end_time: "02:00"
    resource_shifts:
      - resource_type: "Tech Support"
        shift_pattern: day_shift
      - resource_type: SRE
        shift_pattern: [day_shift, night_shift]  # Multiple shifts
```

#### Dynamic Resource Capacities

```yaml
event_simulation:
  resource_capacities:
    Staff:                              # Resource table name
      default_capacity: 1               # Default for unspecified types
      min_capacity: 1                   # Minimum capacity
      max_capacity: 10                  # Maximum capacity
      capacity_rules:                   # Type-specific rules
        - resource_type: "Developer"
          capacity: 5                   # Fixed capacity
        - resource_type: "Tester"
          capacity:                     # Distribution-based capacity
            formula: UNIF(2, 4)
```

## Distribution Formulas

The simulation system supports multiple formats for specifying statistical distributions:

### Format 1: Formula String (Recommended)

Direct formula syntax for common distributions:

```yaml
duration:
  formula: EXPO(2)                      # Exponential with mean 2
  
interarrival_time:
  formula: NORM(5, 1)                   # Normal with mean=5, stddev=1
  
processing_time:
  formula: UNIF(3, 10)                  # Uniform between 3 and 10
```

### Format 2: Dictionary with Formula

```yaml
duration:
  formula: EXPO(2)                      # Same as Format 1, wrapped in dict
```

### Format 3: Distribution Dictionary

Explicit distribution configuration:

```yaml
duration:
  distribution:
    type: exponential
    scale: 2                            # Mean = 2
    
processing_time:
  distribution:
    type: normal
    mean: 5
    stddev: 1
    
wait_time:
  distribution:
    type: uniform
    min: 3
    max: 10
```

### Supported Distributions

#### Exponential Distribution
- **Formula**: `EXPO(mean)`
- **Dictionary**: `{type: "exponential", scale: mean}`
- **Use Case**: Inter-arrival times, service times
- **Example**: `EXPO(2)` - exponential with mean 2

#### Normal Distribution
- **Formula**: `NORM(mean, stddev)`
- **Dictionary**: `{type: "normal", mean: X, stddev: Y}`
- **Use Case**: Processing times, human performance
- **Example**: `NORM(10, 2)` - normal with mean 10, standard deviation 2

#### Uniform Distribution
- **Formula**: `UNIF(min, max)`
- **Dictionary**: `{type: "uniform", min: X, max: Y}`
- **Use Case**: Random delays, equipment variation
- **Example**: `UNIF(1, 5)` - uniform between 1 and 5
- **Note**: Bounds are INCLUSIVE (includes both min and max values)

#### Lognormal Distribution
- **Formula**: `LOGNORM(mu, sigma)`
- **Dictionary**: `{type: "lognormal", mu: X, sigma: Y}`
- **Use Case**: Task completion times, failure rates
- **Example**: `LOGNORM(1, 0.5)` - lognormal distribution

#### Gamma Distribution
- **Formula**: `GAMMA(shape, scale)`
- **Dictionary**: `{type: "gamma", shape: X, scale: Y}`
- **Use Case**: Complex service times
- **Example**: `GAMMA(2, 1.5)` - gamma distribution

#### Constant Value
- **Formula**: `CONST(value)` or just the numeric value
- **Dictionary**: `{type: "constant", value: X}`
- **Use Case**: Fixed durations, deterministic processes
- **Example**: `CONST(5)` or `5` - constant value of 5

### Distribution Usage Examples

```yaml
# Entity creation with exponential inter-arrival times
create_config:
  interarrival_time:
    formula: EXPO(3)                    # Average 3 time units between arrivals

# Processing with normal duration
event_config:
  duration:
    formula: NORM(8, 1.5)               # Mean 8, std dev 1.5

# Resource capacity with uniform variation
resource_capacities:
  Equipment:
    capacity_rules:
      - resource_type: "Machine"
        capacity:
          formula: UNIF(2, 5)           # 2-5 machines available
```

## Complete Working Examples

### Example 1: Simple Single-Flow Configuration

A basic configuration with one flow for order processing:

```yaml
simulation:
  base_time_unit: hours
  terminating_conditions: ENTITIES(Order, 100)
  start_date: 2024-01-01
  random_seed: 42

event_simulation:
  event_flows:
    - flow_id: order_processing_flow
      event_table: Order_Event
      steps:
        - step_id: create_order
          step_type: create
          create_config:
            entity_table: Order
            interarrival_time:
              formula: EXPO(2)
            max_entities: n/a
          next_steps:
            - process_payment
        
        - step_id: process_payment
          step_type: event
          event_config:
            duration:
              formula: UNIF(0.15, 0.2)
            resource_requirements: []
          next_steps:
            - payment_decision
        
        - step_id: payment_decision
          step_type: decide
          decide_config:
            decision_type: 2way-chance
            outcomes:
              - outcome_id: payment_success
                next_step_id: fulfill_order
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.95
              - outcome_id: payment_failed
                next_step_id: retry_payment
                conditions: []
        
        - step_id: fulfill_order
          step_type: event
          event_config:
            duration:
              formula: NORM(1, 0.1)
            resource_requirements: []
          next_steps:
            - mark_complete
        
        - step_id: mark_complete
          step_type: assign
          assign_config:
            assignments:
              - assignment_type: attribute
                attribute_name: status
                value: completed
          next_steps:
            - release_order
        
        - step_id: release_order
          step_type: release
        
        - step_id: retry_payment
          step_type: event
          event_config:
            duration:
              formula: EXPO(0.5)
            resource_requirements: []
          next_steps:
            - process_payment
```

### Example 2: Multi-Flow Support Ticket System

Complex configuration with multiple flows and resource constraints:

```yaml
simulation:
  base_time_unit: hours
  terminating_conditions: TIME(200)
  start_date: 2024-01-01
  random_seed: 42
  resources:
    - resource_table: Staff
      capacities:
        SRE: 1
        "Tech Support": 2
        Developer: 1
        Security: 1

event_simulation:
  event_flows:
    # Flow 1: Online Ticket Processing
    - flow_id: online_ticket_flow
      event_table: Online_Ticket_Event
      steps:
        - step_id: create_online_ticket
          step_type: create
          create_config:
            entity_table: Online_Ticket
            interarrival_time:
              formula: EXPO(2)
            max_entities: n/a
          next_steps:
            - initial_assignment
        
        - step_id: initial_assignment
          step_type: event
          event_config:
            duration:
              formula: NORM(5, 1)
            resource_requirements:
              - resource_table: Staff
                value: "Tech Support"
                count: 1
          next_steps:
            - complexity_assessment
        
        - step_id: complexity_assessment
          step_type: decide
          decide_config:
            decision_type: 2way-chance
            outcomes:
              - outcome_id: simple_issue
                next_step_id: simple_resolution
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.7
              - outcome_id: complex_issue
                next_step_id: escalate_to_dev
                conditions: []
        
        - step_id: simple_resolution
          step_type: event
          event_config:
            duration:
              formula: NORM(10, 2)
            resource_requirements:
              - resource_table: Staff
                value: "Tech Support"
                count: 1
          next_steps:
            - mark_resolved
        
        - step_id: escalate_to_dev
          step_type: event
          event_config:
            duration:
              formula: NORM(30, 5)
            resource_requirements:
              - resource_table: Staff
                value: Developer
                count: 1
          next_steps:
            - mark_resolved
        
        - step_id: mark_resolved
          step_type: assign
          assign_config:
            assignments:
              - assignment_type: attribute
                attribute_name: status
                value: resolved
              - assignment_type: attribute
                attribute_name: resolution_time
                value: "{{current_time}}"
          next_steps:
            - release_ticket
        
        - step_id: release_ticket
          step_type: release
    
    # Flow 2: Phone Call Handling
    - flow_id: phone_call_flow
      event_table: Phone_Call_Event
      steps:
        - step_id: create_phone_call
          step_type: create
          create_config:
            entity_table: Phone_Call
            interarrival_time:
              formula: EXPO(3)
            max_entities: n/a
          next_steps:
            - handle_call
        
        - step_id: handle_call
          step_type: event
          event_config:
            duration:
              formula: NORM(8, 2)
            resource_requirements:
              - resource_table: Staff
                value: "Tech Support"
                count: 1
          next_steps:
            - call_outcome
        
        - step_id: call_outcome
          step_type: decide
          decide_config:
            decision_type: 3way-chance
            outcomes:
              - outcome_id: resolved_immediately
                next_step_id: mark_call_resolved
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.6
              - outcome_id: needs_followup
                next_step_id: create_followup_ticket
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.3
              - outcome_id: escalation_needed
                next_step_id: escalate_call
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.1
        
        - step_id: mark_call_resolved
          step_type: assign
          assign_config:
            assignments:
              - assignment_type: attribute
                attribute_name: status
                value: resolved
          next_steps:
            - release_call
        
        - step_id: create_followup_ticket
          step_type: assign
          assign_config:
            assignments:
              - assignment_type: attribute
                attribute_name: followup_required
                value: true
          next_steps:
            - release_call
        
        - step_id: escalate_call
          step_type: event
          event_config:
            duration:
              formula: NORM(15, 3)
            resource_requirements:
              - resource_table: Staff
                value: SRE
                count: 1
          next_steps:
            - mark_call_resolved
        
        - step_id: release_call
          step_type: release
    
    # Flow 3: Security Incident Response
    - flow_id: security_incident_flow
      event_table: Security_Event
      steps:
        - step_id: create_security_incident
          step_type: create
          create_config:
            entity_table: Security_Incident
            interarrival_time:
              formula: EXPO(24)           # Rare events - every 24 hours on average
            max_entities: n/a
          next_steps:
            - initial_triage
        
        - step_id: initial_triage
          step_type: event
          event_config:
            duration:
              formula: NORM(2, 0.5)
            resource_requirements:
              - resource_table: Staff
                value: Security
                count: 1
          next_steps:
            - severity_assessment
        
        - step_id: severity_assessment
          step_type: decide
          decide_config:
            decision_type: 3way-chance
            outcomes:
              - outcome_id: low_severity
                next_step_id: standard_response
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.5
              - outcome_id: medium_severity
                next_step_id: enhanced_response
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.4
              - outcome_id: high_severity
                next_step_id: emergency_response
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.1
        
        - step_id: standard_response
          step_type: event
          event_config:
            duration:
              formula: NORM(4, 1)
            resource_requirements:
              - resource_table: Staff
                value: Security
                count: 1
          next_steps:
            - document_incident
        
        - step_id: enhanced_response
          step_type: event
          event_config:
            duration:
              formula: NORM(8, 2)
            resource_requirements:
              - resource_table: Staff
                value: Security
                count: 1
              - resource_table: Staff
                value: SRE
                count: 1
          next_steps:
            - document_incident
        
        - step_id: emergency_response
          step_type: event
          event_config:
            duration:
              formula: NORM(12, 3)
            resource_requirements:
              - resource_table: Staff
                value: Security
                count: 1
              - resource_table: Staff
                value: SRE
                count: 1
              - resource_table: Staff
                value: Developer
                count: 1
          next_steps:
            - document_incident
        
        - step_id: document_incident
          step_type: assign
          assign_config:
            assignments:
              - assignment_type: attribute
                attribute_name: status
                value: documented
              - assignment_type: attribute
                attribute_name: resolution_time
                value: "{{current_time}}"
          next_steps:
            - release_security
        
        - step_id: release_security
          step_type: release
```

### Example 3: Manufacturing Process with Work Shifts

Advanced configuration with time-based resource availability:

```yaml
simulation:
  base_time_unit: hours
  terminating_conditions: TIME(168)      # One week simulation
  start_date: 2024-01-01
  random_seed: 42
  resources:
    - resource_table: Workers
      capacities:
        Operator: 4
        Supervisor: 1
        Maintenance: 2

event_simulation:
  work_shifts:
    enabled: true
    shift_patterns:
      - name: day_shift
        days: [0, 1, 2, 3, 4]           # Monday-Friday
        start_time: "08:00"
        end_time: "16:00"
      - name: evening_shift
        days: [0, 1, 2, 3, 4]
        start_time: "16:00"
        end_time: "00:00"
      - name: maintenance_shift
        days: [5]                       # Saturday only
        start_time: "09:00"
        end_time: "17:00"
    resource_shifts:
      - resource_type: Operator
        shift_pattern: [day_shift, evening_shift]
      - resource_type: Supervisor
        shift_pattern: day_shift
      - resource_type: Maintenance
        shift_pattern: maintenance_shift

  event_flows:
    - flow_id: production_line_flow
      event_table: Production_Event
      steps:
        - step_id: start_production
          step_type: create
          create_config:
            entity_table: Product
            interarrival_time:
              formula: EXPO(0.5)          # Every 30 minutes on average
            max_entities: n/a
          next_steps:
            - setup_station
        
        - step_id: setup_station
          step_type: event
          event_config:
            duration:
              formula: NORM(0.25, 0.05)   # 15 minutes ± 3 minutes
            resource_requirements:
              - resource_table: Workers
                value: Operator
                count: 1
          next_steps:
            - production_process
        
        - step_id: production_process
          step_type: event
          event_config:
            duration:
              formula: NORM(2, 0.3)       # 2 hours ± 18 minutes
            resource_requirements:
              - resource_table: Workers
                value: Operator
                count: 2
          next_steps:
            - quality_check
        
        - step_id: quality_check
          step_type: event
          event_config:
            duration:
              formula: UNIF(0.2, 0.4)     # 12-24 minutes
            resource_requirements:
              - resource_table: Workers
                value: Supervisor
                count: 1
          next_steps:
            - quality_decision
        
        - step_id: quality_decision
          step_type: decide
          decide_config:
            decision_type: 2way-chance
            outcomes:
              - outcome_id: quality_pass
                next_step_id: finish_product
                conditions:
                  - if: Probability
                    is: ==
                    value: 0.92
              - outcome_id: quality_fail
                next_step_id: rework_product
                conditions: []
        
        - step_id: finish_product
          step_type: assign
          assign_config:
            assignments:
              - assignment_type: attribute
                attribute_name: status
                value: completed
              - assignment_type: attribute
                attribute_name: quality_grade
                value: passed
          next_steps:
            - release_production
        
        - step_id: rework_product
          step_type: event
          event_config:
            duration:
              formula: NORM(1, 0.2)       # 1 hour rework
            resource_requirements:
              - resource_table: Workers
                value: Operator
                count: 1
          next_steps:
            - quality_check               # Loop back to quality check
        
        - step_id: release_production
          step_type: release
```

## Step Template Information for Frontend

The API provides step templates through `/api/step-types` endpoint. However, note that the current API template system only includes: `event`, `decide`, `assign`, `release` step types. The `create` step type is supported by the simulation parser but not included in the API template system.

### Create Step Template (Missing from API)

For frontend implementation, use this template for create steps:

```yaml
step_id: create_entities
step_type: create
create_config:
  entity_table: EntityName
  interarrival_time:
    formula: EXPO(2)
  max_entities: n/a
  entities_per_arrival: 1
next_steps:
  - next_step_id
```

## Frontend Integration Notes

When creating modules in the frontend, the system should:

### For Create Steps (Flow Entry Points)
1. **Auto-generate flow_id**: Use pattern `flow_{index}_{entity_name}` or user-defined naming
2. **Require event_table**: Link to appropriate event table from database schema
3. **Default interarrival_time**: Provide EXPO(2) as reasonable default
4. **Set max_entities**: Default to "n/a" for unlimited generation

### For All Step Types
1. **Generate unique step_id**: Use descriptive naming based on step type and purpose
2. **Validate next_steps**: Ensure referenced steps exist in the same flow
3. **Resource validation**: Verify resource_table and values match simulation.resources
4. **Distribution format**: Prefer formula strings for user-friendly input

### Flow Validation Rules
1. **Entry point requirement**: Each flow must have exactly one Create step
2. **Terminal requirement**: Each flow must have at least one Release step
3. **Connectivity**: All steps must be reachable from the Create step
4. **Unique IDs**: All step_ids must be unique within a flow
5. **Resource consistency**: Resource requirements must reference defined resource tables

This documentation provides the complete reference for understanding and generating valid simulation YAML configurations in the DB Simulator system.