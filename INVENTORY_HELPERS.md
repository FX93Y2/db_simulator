# Inventory Management System - Helper Functions & Special Indicators

This document outlines all helper functions, special naming conventions, indicators, and pointers used in the inventory management system for the DB Simulator.

## Overview

The inventory management system extends the simulation framework to support non-reusable resources (inventory items) that have quantity tracking and selection strategies. Unlike traditional resources that are allocated and released, inventory items are consumed and their quantities are decremented.

## Helper Functions

### Inventory Verification Functions

#### `CHECK_INVENTORY(Entity.selected_inventory, Entity.inventory_quantities)`
**Purpose**: Verify that all selected inventory items have sufficient quantity available.

**Parameters**:
- `Entity.selected_inventory`: JSON array of inventory item IDs carried by the entity
- `Entity.inventory_quantities`: JSON array of quantities needed for each inventory item

**Returns**: `true` if all inventory items have sufficient stock, `false` otherwise

**Usage**:
```yaml
conditions:
  - if: expression
    is: ==
    value: "CHECK_INVENTORY(Entity.selected_inventory, Entity.inventory_quantities)"
```

### Inventory Access Functions

#### `INVENTORY_IDS(Entity.selected_inventory)`
**Purpose**: Extract the list of inventory item IDs from an entity's selected inventory.

**Parameters**:
- `Entity.selected_inventory`: JSON array of inventory item IDs

**Returns**: Array of inventory item IDs for use in SQL WHERE clauses

**Usage**:
```sql
WHERE Book.id IN INVENTORY_IDS(Entity.selected_inventory)
```

#### `INVENTORY_QUANTITY(Entity.selected_inventory, Entity.inventory_quantities, item_id)`
**Purpose**: Get the required quantity for a specific inventory item from an entity's requirements.

**Parameters**:
- `Entity.selected_inventory`: JSON array of inventory item IDs
- `Entity.inventory_quantities`: JSON array of quantities for each item
- `item_id`: The specific inventory item ID to look up

**Returns**: Integer quantity needed for the specified item

**Usage**:
```sql
SET quantity = quantity - INVENTORY_QUANTITY(Entity.selected_inventory, Entity.inventory_quantities, Book.id)
```

### Utility Functions

#### `RANDOM_INT(min, max)`
**Purpose**: Generate a random integer within the specified range (inclusive).

**Parameters**:
- `min`: Minimum value (inclusive)
- `max`: Maximum value (inclusive)

**Returns**: Random integer between min and max

**Usage**:
```sql
SET quantity = quantity + RANDOM_INT(10, 50)
```

## Entity Property Accessors

### Standard Entity Properties
- `Entity.id` - Entity's primary key ID
- `Entity.<attribute_name>` - Access any entity attribute by name

### Inventory-Specific Properties
- `Entity.selected_inventory` - JSON array of selected inventory item IDs
- `Entity.inventory_quantities` - JSON array of quantities for each selected inventory item

These properties are automatically populated when an entity is created with `inventory_requirements` defined.

## Special Indicators & Configuration

### Database Configuration Indicators

#### `type: inventory`
**Purpose**: Mark a database table as an inventory resource table.

**Usage**:
```yaml
entities:
  - name: Book
    type: inventory  # Marks this as an inventory table
    rows: 100
```

**Requirements**: 
- Must have a numeric `quantity` field to track available stock
- Items are selected and consumed rather than allocated/released

#### `type: json`
**Purpose**: Store complex data structures (arrays, objects) in database fields.

**Usage**:
```yaml
- name: selected_inventory
  type: json
```

### Simulation Configuration Indicators

#### `inventory_requirements`
**Purpose**: Define what inventory items an entity type requires upon creation.

**Usage**:
```yaml
entities:
  - entity_table: Order
    inventory_requirements:
      - inventory_table: Book
        selection_strategy: random
        quantity_formula: DISC(0.5, 1, 0.3, 2, 0.15, 3, 0.05, 4)
        quantity_per_item_formula: DISC(0.8, 1, 0.15, 2, 0.05, 3)
```

**Parameters**:
- `inventory_table`: Name of the inventory table to select from
- `selection_strategy`: How to choose items (`random`, `distribution`, `weighted`)
- `quantity_formula`: Distribution for number of different items to select
- `quantity_per_item_formula`: Distribution for quantity of each selected item

### Assignment Type Indicators

#### `assignment_type: update`
**Purpose**: Perform SQL UPDATE operations in assign modules.

**Usage**:
```yaml
- assignment_type: update
  target_table: Book
  expression: |
    UPDATE Book 
    SET quantity = quantity - INVENTORY_QUANTITY(Entity.selected_inventory, Entity.inventory_quantities, Book.id)
    WHERE Book.id IN INVENTORY_IDS(Entity.selected_inventory)
```

#### `assignment_type: sql_calculation`
**Purpose**: Calculate attribute values using SQL queries.

**Usage**:
```yaml
- assignment_type: sql_calculation
  attribute_name: total_amount
  expression: |
    SELECT SUM(Book.price * INVENTORY_QUANTITY(Entity.selected_inventory, Entity.inventory_quantities, Book.id))
    FROM Book 
    WHERE Book.id IN INVENTORY_IDS(Entity.selected_inventory)
```

### Condition Type Indicators

#### `if: expression`
**Purpose**: Evaluate SQL queries or helper functions in decide modules.

**Usage**:
```yaml
conditions:
  - if: expression
    is: ==
    value: "CHECK_INVENTORY(Entity.selected_inventory, Entity.inventory_quantities)"
```

## Selection Strategies

### `random`
Randomly select inventory items from the available pool.

### `distribution` (Future)
Select items based on statistical distributions (e.g., weighted by popularity).

### `weighted` (Future)
Select items based on custom weighting factors.

### `template` (Future)
Select items based on template expressions or rules.

## SQL Expression Support

### Entity Variable Substitution
In SQL expressions, entity properties can be referenced using the `Entity.` prefix:
- `Entity.id` - Entity ID
- `Entity.selected_inventory` - Inventory selection
- `Entity.inventory_quantities` - Quantity requirements

### Helper Function Integration
Helper functions can be embedded directly in SQL expressions:
```sql
UPDATE inventory_table 
SET quantity = quantity - INVENTORY_QUANTITY(Entity.selected_inventory, Entity.inventory_quantities, inventory_table.id)
WHERE inventory_table.id IN INVENTORY_IDS(Entity.selected_inventory)
```

### Conditional SQL
Use helper functions in conditional expressions:
```yaml
value: "CHECK_INVENTORY(Entity.selected_inventory, Entity.inventory_quantities)"
```

## Implementation Notes

### Database Schema Requirements
1. Inventory tables must have a `quantity` field (numeric type)
2. Entity tables with inventory requirements need JSON fields for metadata storage
3. Primary keys must support the INVENTORY_IDS() function

### Simulation Flow Requirements
1. Inventory selection occurs during entity creation
2. Inventory verification happens in decide modules before consumption
3. Inventory updates occur in assign modules using SQL UPDATE
4. Backorder handling requires restock and retry logic

### Performance Considerations
1. Inventory checks involve database queries - consider caching strategies
2. JSON field operations may have performance implications
3. Complex inventory selections may require optimization

### Error Handling
1. Insufficient inventory should be handled gracefully with backorder flows
2. Invalid inventory selections should trigger appropriate error responses
3. SQL expression errors need comprehensive logging

## Future Extensions

### Planned Helper Functions
- `INVENTORY_AVAILABLE(inventory_table, item_id)` - Check available quantity
- `SELECT_INVENTORY_BY_CATEGORY(inventory_table, category, count)` - Category-based selection
- `INVENTORY_VALUE(Entity.selected_inventory, Entity.inventory_quantities)` - Calculate total value

### Planned Features
- Multi-table inventory requirements
- Inventory reservation systems
- Batch inventory operations
- Inventory forecasting and planning

This documentation serves as the definitive reference for implementing and extending the inventory management system while maintaining generic, reusable patterns that don't hardcode specific database schemas.