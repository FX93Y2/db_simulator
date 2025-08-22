# Formula Generator - Supported Calculations

## Overview
The Formula Generator enables complex data generation using SQL queries and expressions that reference existing database values. Formulas execute after simulation completion when all referenced data exists.

## Supported Functions and Operations

### SQL Aggregate Functions
| Function | Description | Example |
|----------|-------------|---------|
| `MIN()` | Minimum value | `MIN(SELECT created_at FROM Tickets WHERE user_id = @id)` |
| `MAX()` | Maximum value | `MAX(SELECT updated_at FROM Orders WHERE customer_id = @id)` |
| `AVG()` | Average value | `AVG(SELECT price FROM Products WHERE category_id = @id)` |
| `COUNT()` | Count records | `COUNT(SELECT * FROM Reviews WHERE product_id = @id)` |
| `SUM()` | Sum values | `SUM(SELECT amount FROM Payments WHERE user_id = @id)` |

### Date/Time Functions
| Function | Description | Example |
|----------|-------------|---------|
| `DAYS(n)` | Add/subtract days | `created_at - DAYS(30)` |
| `HOURS(n)` | Add/subtract hours | `timestamp + HOURS(2)` |
| `MINUTES(n)` | Add/subtract minutes | `start_time - MINUTES(15)` |

### Random Number Generation
| Function | Description | Example |
|----------|-------------|---------|
| `RANDOM(min, max)` | Random integer in range | `DAYS(RANDOM(30, 365))` |

### Arithmetic Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `AVG(...) + 10` |
| `-` | Subtraction | `MAX(...) - MIN(...)` |
| `*` | Multiplication | `COUNT(...) * 100` |
| `/` | Division | `SUM(...) / COUNT(...)` |

### Variable References
- Use `@column_name` to reference any column from the current row
- Examples: `@id`, `@user_id`, `@category_name`
- Variables are automatically escaped based on data type

## Expression Syntax

### Basic SQL Query
```yaml
expression: "SELECT MAX(order_date) FROM Orders WHERE customer_id = @id"
```

### Aggregate with Subquery
```yaml
expression: "MIN(SELECT created_at FROM Events WHERE user_id = @id)"
```

### Date Arithmetic
```yaml
expression: "MIN(SELECT created_at FROM Tickets WHERE user_id = @id) - DAYS(RANDOM(30, 365))"
```

### Calculated Field
```yaml
expression: "AVG(SELECT price FROM Products WHERE category_id = @id) * 1.2"
```

### Count with Conditions
```yaml
expression: "COUNT(SELECT * FROM Orders WHERE customer_id = @id AND status = 'completed')"
```

## Configuration Example

```yaml
entities:
  - name: Users
    attributes:
      - name: registration_date
        type: datetime
        generator:
          type: formula
          expression: "MIN(SELECT created_at FROM Activities WHERE user_id = @id) - DAYS(RANDOM(30, 365))"
          
      - name: total_purchases
        type: integer
        generator:
          type: formula
          expression: "COUNT(SELECT * FROM Orders WHERE customer_id = @id)"
          
      - name: average_order_value
        type: decimal
        generator:
          type: formula
          expression: "AVG(SELECT amount FROM Orders WHERE customer_id = @id)"
```

## Important Rules

1. **Execution Timing**: Formulas execute after simulation completion
2. **Return Value**: Must return a single scalar value
3. **Variable Scope**: Can only reference columns from the current row using `@column_name`
4. **NULL Handling**: NULL results are preserved (no defaults applied)
5. **Type Matching**: Result type must match the attribute's declared type

## Common Use Cases

### Temporal Consistency
Ensure dates are logically ordered:
```yaml
# User registered before first activity
expression: "MIN(SELECT created_at FROM Activities WHERE user_id = @id) - DAYS(RANDOM(30, 365))"
```

### Aggregated Metrics
Calculate summary statistics:
```yaml
# Total customer spending
expression: "SUM(SELECT amount FROM Purchases WHERE customer_id = @id)"

# Order count
expression: "COUNT(SELECT * FROM Orders WHERE customer_id = @id)"
```

### Derived Timestamps
Set dates based on related data:
```yaml
# Last activity date
expression: "MAX(SELECT timestamp FROM Events WHERE user_id = @id)"
```

### Business Calculations
Implement business logic:
```yaml
# Average with 20% markup
expression: "AVG(SELECT price FROM Products WHERE category_id = @id) * 1.2"

# Conditional count
expression: "COUNT(SELECT * FROM Tickets WHERE user_id = @id AND priority = 'high')"
```

## SQLite Compatibility Notes

The following conversions are applied automatically:
- `MIN(SELECT ...)` → `(SELECT MIN(...))`
- `MAX(SELECT ...)` → `(SELECT MAX(...))`
- `AVG(SELECT ...)` → `(SELECT AVG(...))`
- `COUNT(SELECT ...)` → `(SELECT COUNT(...))`
- `SUM(SELECT ...)` → `(SELECT SUM(...))`

## Quick Reference

### Supported SQL Elements
- ✅ SELECT statements
- ✅ WHERE clauses with AND/OR
- ✅ Comparison operators: `=`, `!=`, `<`, `>`, `<=`, `>=`
- ✅ LIKE operator for pattern matching
- ✅ All SQLite aggregate functions
- ✅ Single table queries (JOINs supported but not recommended)

### Not Supported
- ❌ INSERT, UPDATE, DELETE statements
- ❌ Recursive formulas (referencing own column)
- ❌ Multi-row results (must return scalar)
- ❌ Formula referencing other formula columns
- ❌ User-defined functions