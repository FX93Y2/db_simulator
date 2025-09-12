# DB Simulator

Database education tool for creating realistic synthetic data across various teaching scenarios.

## Table of Contents

- [Database Configuration](#database-configuration)
- [Data Generation Methods](#data-generation-methods)
- [Special Tables and Columns](#special-tables-and-columns)
- [Simulation Components](#simulation-components)
- [Simulation Steps](#simulation-steps)
- [Result Viewer](#result-viewer)

## Database Configuration

Configure database schemas through an interface:

![Database Configuration Interface](doc/database/database_config_dashboard.png)

Create entities with attributes, relationships, and data generators. Define table types (entity, event, resource, inventory, bridging) and configure column properties.

## Data Generation Methods

**Database Entity Editor**

Double click on any table to access the database entity editor

![Data Table Editor](doc/database/data_table_editor.png)

**Faker.js**: Generate realistic synthetic data

```yaml
#Example
name: last_name
type: string
generator:
  type: faker
  method: person.lastName
```

![Data Generator: Faker](doc/database/faker.png)

**Distributions**: Statistical data generation

```yaml
#Example
generator:
  type: distribution
  formula: UNIF(1, 100)  # NORM, EXPO, DISC
```

![Distribution Generator](doc/database/distribution_generator.png)

**SQL Formulas**: Relationship-aware data

```yaml
#Example
generator:
  type: formula
  expression: MIN(SELECT created_at FROM Order WHERE customer_id = @id) + DAYS(30)
```

![SQL Formula Generator](doc/database/sql_formula_expression.png)
## Special Tables and Columns

### Table Types
- **entity**: Primary business objects (Customer, Order)
- **event**: Event tracking tables  
- **resource**: Resource pools (Staff, Equipment)
- **inventory**: Item inventory management
- **bridging**: Many-to-many relationships

### Column Types
- **event_type**: Event classification column
- **entity_type**: Entity classification column
- **resource_type**: Resource classification column
- **entity_id**: Links to entity tables (fk)
- **event_id**: Event identifier (fk)
- **resource_id**: Resource identifier (fk)
- **inv_req**: Inventory requirement specification
- **inv_qty**: Inventory quantity tracking

## Simulation Components
Modular designed discrete event simulation

![Simulation Dashboard](doc/simulation/simulation_dashboard.png)

### Termination Conditions
Navigate to Simulation Setting button in float tool bar

![Simulation Setting Button](doc/simulation/simulation_setting_in_toolbar.png)
Control when simulation ends:

![Simulation Setting](doc/simulation/simulation_setting.png)
- `TIME(200)` - Run for 200 time units
- `ENTITIES(Order, 100)` - Stop after 100 entities


### Resource Configuration
Set resource capacity constraints:

![Resource Editor](doc/simulation/resource_editor.png)

Resource settings: Currently only support configuring fixed resource capacity

![Resource Editor Modal](doc/simulation/resource_editor_modal.png)
```yaml
#Example
resources:
  Staff:
    capacity: 10
```

### Entity Configuration
Configure entity inventory requirements:

![Entity Editor](doc/simulation/entity_editor.png)

Entity settings: Currently only support configuring consumable/inventory cost

![Entity Editor Modal](doc/simulation/entity_editor_modal.png)

```yaml
#Example
entities:
  Order:
    inventory_requirements:
      - item: Book
        quantity: 1
```

## Simulation Steps
Double click on nodes to open editor

### Create
Generate entities with arrival patterns:

![Create Editor](doc/simulation/create_module.png)

```yaml
#Example
step_type: create
create_config:
  entity_table: Order
  interarrival_time:
    formula: EXPO(2)
```

### Event  
Process events with duration and resources:

![Event Editor](doc/simulation/event_module.png)

```yaml
#Example
step_type: event
event_config:
  duration:
    formula: NORM(1, 0.1)
  resource_requirements:
    - resource: Staff
      count: 1
```

### Assign
Assign new attributes or update database tables during simulation:

**Assignment Types:**
- **Attribute assignment**: Set entity attributes with custom names and values

![Assign Module](doc/simulation/assign_module.png)

- **SQL updates**: Execute UPDATE statements to modify any table in the database

![Assign SQL Example](doc/simulation/assign_sql_backorder.png)

- **Dynamic values**: Use templates like `{{current_time}}` or `{{entity_id}}` for runtime values

```yaml
#Example: Attribute assignment
step_type: assign
assign_config:
  assignments:
    - assignment_type: attribute
      attribute_name: status
      value: processed
    - assignment_type: attribute
      attribute_name: completion_time
      value: "{{current_time}}"
```

### Decide
Route entities using 4 decision types:



**Decision Types:**
- `2way-chance` - Two-path probability routing (70% approve, 30% reject)
- `2way-condition` - Two-path based on attribute values (if quality_score >= 8)
- `nway-chance` - Multiple paths with explicit probabilities (60%/30%/10%)
- `nway-condition` - Multiple paths based on different attribute conditions

**Conditional Decisions:**
Conditional decisions (`2way-condition`, `nway-condition`) support:
- **Attribute conditions**: Compare entity attributes (`status == "complete"`)

![Decision Module Modal](doc/simulation/decision_module_condition.png)

- **SQL query conditions**: Compare against database results

Bookstore Inventory check example:

![Decision Module SQL](doc/simulation/decision_sql_result,png.png)

- **Operators**: `==`, `!=`, `>`, `>=`, `<`, `<=`



```yaml
#Example: Probability-based
step_type: decide
decide_config:
  decision_type: 2way-chance
  outcomes:
    - outcome_id: approve
      next_step_id: process_approval
      conditions:
        - if: Probability
          is: ==
          value: 0.8
    - outcome_id: reject
      next_step_id: handle_rejection
      conditions: []  # else case

#Example: Attribute-based
step_type: decide
decide_config:
  decision_type: 2way-condition
  outcomes:
    - outcome_id: high_priority
      next_step_id: fast_track
      conditions:
        - if: Attribute
          name: priority_level
          is: ==
          value: critical
    - outcome_id: normal_priority
      next_step_id: standard_queue
      conditions: []  # else case
```

### Release
Dispose entity and free allocated resources:
```yaml
#Example
step_type: release
```

## Result Viewer
Review generated database tables and navigate between tables on project sidebar

![Results Interface](doc/simulation/result_viewer.png)


---

**Installation**: `pip install -r python/requirements.txt && cd electron && npm install`
**Run**: `cd electron && npm run dev`