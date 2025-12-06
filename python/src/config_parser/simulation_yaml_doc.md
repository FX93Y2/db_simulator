# Simulation YAML Configuration (Concise)

Authoritative outline of required/optional sections and fields for the simulation YAML consumed by the engine. No examples; field lists only.

## Top-Level Sections
- `simulation` (required): global settings and resources.
- `event_simulation` (optional but required for flows): flow definitions, table mapping, queues/resources.

## simulation
- `base_time_unit` (required): `seconds | minutes | hours | days`.
- `terminating_conditions` (required): termination formula string (e.g., TIME/ENTITIES expressions).
- `start_date` (optional): ISO date.
- `random_seed` (optional): integer.
- `resources` (optional, list):
  - `resource_table` (required): table name.
  - `capacities` (required): map of resource_type → capacity.

## event_simulation
- `table_specification` (optional, derived from DB config if omitted):
  - `entity_table` (optional)
  - `resource_table` (optional)
- `queues` (optional, list):
  - `name` (required)
  - `type` (required): `FIFO | LIFO | LowAttribute | HighAttribute`
  - `attribute` (required for LowAttribute/HighAttribute)
- `work_shifts` (optional):
  - `enabled` (required)
  - `shift_patterns` (list): `name`, `days` (0=Mon), `start_time`, `end_time`
  - `resource_shifts` (list): `resource_type`, `shift_pattern` (name or list of names)
- `resource_capacities` (optional, map keyed by resource_table):
  - `default_capacity` (optional, int)
  - `capacity_formula` (optional, string)
  - `min_capacity` (optional, int)
  - `max_capacity` (optional, int)
  - `capacity_rules` (optional, list): `resource_type`, `capacity` (int or distribution spec)
- `event_flows` (required when simulating, list):
  - `flow_id` (required)
  - `event_flow` (optional label; defaults to `flow_id`)
  - `steps` (required, ordered list of step objects)

## Step Common Fields
- `step_id` (required): unique within flow.
- `step_type` (required): `create | event | decide | assign | release | trigger`.
- `next_steps` (optional, list of step_ids): routing (decide outcomes handle their own routing).

## Step Type Configs
- `create` → `create_config` (required):
  - `entity_table` (required)
  - `interarrival_time` (required): distribution spec
  - `max_entities` (optional, int or `n/a`)
  - `entities_per_arrival` (optional, int or distribution)
- `event` → `event_config` (required):
  - `duration` (required): distribution spec
  - `resource_requirements` (optional, list):
    - `resource_table` (required)
    - `value` (required): resource type/value
    - `count` (required, int)
    - `capacity_per_resource` (optional, int, default 1)
    - `queue` (optional): queue name to use
- `decide` → `decide_config` (required):
  - `decision_type` (required): `2way-chance | 2way-condition | nway-chance | nway-condition`
  - `outcomes` (required, list):
    - `outcome_id` (required)
    - `next_step_id` (required)
    - `conditions` (optional, list):
      - `if` (required): `Probability | Attribute`
      - `name` (required for `Attribute`)
      - `is` (required): `== | != | > | >= | < | <= | <>`
      - `value` (required)
- `assign` → `assign_config` (required):
  - `assignments` (required, list):
    - `assignment_type` (required): `attribute | sql` (handlers also support variable/variable_array if configured)
    - For `attribute`: `attribute_name` (required), `value` (required)
    - For `sql`: `expression` (required)
- `release`: no additional config; terminates flow and releases resources.
- `trigger` → `trigger_config` (required):
  - `target_table` (required): table to generate records for
  - `count` (required): integer or distribution formula string
  - `fk_column` (optional): explicit FK column for linking to the current entity
  - `timestamp_column` (optional): datetime column to stamp with simulation datetime (requires `start_date`)
  - `sim_time_column` (optional): numeric column to store simulation time in minutes

## Distribution Spec (used by duration/interarrival/capacity, etc.)
- Allowed formats:
  - `formula`: distribution string (EXPO/UNIF/NORM/CONST/LOGNORM/GAMMA, etc.)
  - `distribution`: dict with `type` (`exponential | normal | uniform | lognormal | gamma | constant`) and parameters (`scale | mean | stddev | min | max | mu | sigma | value`)
- Optional `time_unit` on any distribution: `seconds | minutes | hours | days` (defaults to `base_time_unit`).
