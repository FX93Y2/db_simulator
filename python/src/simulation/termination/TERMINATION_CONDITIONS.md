# Termination Conditions Reference

This document describes the formula-based termination conditions system for the DB Simulator. This system allows you to specify complex stopping criteria using a simple formula language.

## Overview

Termination conditions determine when a simulation should stop running. Instead of running for a fixed duration, you can specify logical conditions that make simulations stop when meaningful milestones are reached.

## Formula Syntax

### Basic Structure
```
condition_formula := expression
expression := term (OR term)*
term := factor (AND factor)*
factor := condition | '(' expression ')'
condition := function_call
```

### Supported Functions

#### TIME(value)
Stops simulation when simulation time reaches the specified value (in base time units).

**Syntax:** `TIME(value)`
**Parameters:**
- `value`: Numeric value representing time in the simulation's base time unit

**Examples:**
```yaml
# Stop after 720 hours (if base_time_unit is hours)
terminating_conditions: TIME(720)

# Stop after 30 days (if base_time_unit is days)  
terminating_conditions: TIME(30)
```

#### ENTITIES(table_name, count)
Stops simulation when the specified number of entities have been created in a table.

**Syntax:** `ENTITIES(table_name, count)` or `ENTITIES(*, count)`
**Parameters:**
- `table_name`: Name of entity table to count, or `*` for all entity tables
- `count`: Number of entities that triggers termination

**Examples:**
```yaml
# Stop after 1000 Order entities
terminating_conditions: ENTITIES(Order, 1000)
# Stop after 500 Customer entities  
terminating_conditions: ENTITIES(Customer, 500)
# Stop after 2000 total entities (any type)
terminating_conditions: ENTITIES(*, 2000)```

#### EVENTS(count) or EVENTS(table_name, count)
Stops simulation when the specified number of events have been processed.

**Syntax:** `EVENTS(count)` or `EVENTS(table_name, count)`
**Parameters:**
- `table_name`: Name of event table to count (optional)
- `count`: Number of events that triggers termination

**Examples:**
```yaml
# Stop after 10000 total events
terminating_conditions: EVENTS(10000)
# Stop after 5000 Order_Event events
terminating_conditions: EVENTS(Order_Event, 5000)```

### Logical Operators

#### AND
Both conditions must be true for termination.

**Example:**
```yaml
# Stop when we have 1000 orders AND simulation time exceeds 480 hours
terminating_conditions: ENTITIES(Order, 1000) AND TIME(480)```

#### OR  
Either condition can trigger termination.

**Example:**
```yaml
# Stop after 720 hours OR when we have 1000 orders
terminating_conditions: TIME(720) OR ENTITIES(Order, 1000)```

#### Parentheses
Use parentheses to group conditions and control evaluation order.

**Example:**
```yaml
# Stop when (1000 orders OR 500 customers) AND time > 480 hours
terminating_conditions: (ENTITIES(Order, 1000) OR ENTITIES(Customer, 500)) AND TIME(480)```

## Complex Examples

### Multiple Entity Sources
```yaml
# E-commerce simulation: stop when any product line reaches capacity
terminating_conditions: ENTITIES(OnlineOrder, 2000) OR ENTITIES(PhoneOrder, 1000) OR ENTITIES(WalkInOrder, 500)```

### Time-bounded with Entity Limits
```yaml
# Hospital simulation: run full day but stop early if capacity reached
terminating_conditions: TIME(1440) OR ENTITIES(Patient, 200)"  # 1440 minutes = 24 hours
```

### Complex Business Rules
```yaml  
# Manufacturing: stop when daily quota met OR end of shift reached
terminating_conditions: (ENTITIES(Product, 1000) AND TIME(480)) OR TIME(600)```

### Multi-stage Termination
```yaml
# Call center: stop when daily call volume processed OR long idle period
terminating_conditions: ENTITIES(CallTicket, 5000) OR (TIME(540) AND ENTITIES(CallTicket, 100))```

## Configuration Format

### Simple Format
You can specify formulas directly as a string value:

```yaml
terminating_conditions: TIME(720) OR ENTITIES(Order, 1000)
```

### Dictionary Format
Alternatively, use a dictionary with a formula field:

```yaml
terminating_conditions:
  formula: TIME(720) OR ENTITIES(Order, 1000)
```

Both formats are equivalent and produce the same result.

## Best Practices

### 1. Start Simple
Begin with single conditions and add complexity as needed:
```yaml
# Good for testing
terminating_conditions: TIME(100)
# Add complexity gradually  
terminating_conditions: TIME(720) OR ENTITIES(Order, 1000)```

### 2. Use Meaningful Names
Entity table names should be descriptive:
```yaml
# Clear intent
terminating_conditions: ENTITIES(CustomerOrder, 500) OR ENTITIES(SupportTicket, 100)```

### 3. Consider Your Base Time Unit
Make sure your TIME() values match your base_time_unit:
```yaml
simulation:
  base_time_unit: hours
  terminating_conditions:
    formula: "TIME(24)"  # 24 hours, not 24 days
```

### 4. Parentheses for Clarity
Use parentheses even when not strictly necessary:
```yaml
# More readable
terminating_conditions: (TIME(480) OR ENTITIES(Order, 1000)) AND EVENTS(5000)```

## Common Patterns

### Daily Operations
```yaml
base_time_unit: hours
terminating_conditions: TIME(8)"  # 8-hour workday
```

### Capacity-based Manufacturing
```yaml
base_time_unit: minutes  
terminating_conditions: ENTITIES(Product, 1000) OR TIME(480)"  # 1000 products or 8 hours
```

### Service Industry
```yaml
base_time_unit: hours
terminating_conditions: 
  formula: "ENTITIES(Customer, 200) OR TIME(12)"  # 200 customers or 12 hours
```

### Multi-location Business
```yaml
base_time_unit: hours
terminating_conditions: ENTITIES(Store1Order, 100) OR ENTITIES(Store2Order, 150) OR TIME(24)```

## Error Handling

### Invalid Formulas
If a formula contains syntax errors, the simulation will:
1. Log an error message
2. Fall back to a very long time limit (`TIME(999999)`)
3. Continue running

### Common Syntax Errors
```yaml
# ❌ Missing parentheses
terminating_conditions: ENTITIES Order, 1000

# ✅ Correct  
terminating_conditions: ENTITIES(Order, 1000)

# ❌ Invalid operator
terminating_conditions: TIME(720) AND OR ENTITIES(Order, 1000)

# ✅ Correct
terminating_conditions: TIME(720) AND ENTITIES(Order, 1000)
```

### Table Name Validation
- Entity table names are not validated at parse time
- If a table doesn't exist, entity count will be 0
- Use exact table names as defined in your database configuration

## Performance Notes

### Efficient Conditions
- `TIME()` conditions are very fast to evaluate
- `ENTITIES(*)` uses a cached counter (fast)  
- `ENTITIES(specific_table)` requires database query (slower)
- `EVENTS()` uses a cached counter (fast)

### Condition Evaluation Order
- OR conditions evaluate left to right, stopping at first true condition
- AND conditions evaluate left to right, stopping at first false condition
- Place faster/more likely conditions first for better performance

**Example - Optimized Order:**
```yaml
# Fast condition first
terminating_conditions: TIME(720) OR ENTITIES(Order, 1000)
```

This comprehensive reference should help you create effective termination conditions for any simulation scenario!