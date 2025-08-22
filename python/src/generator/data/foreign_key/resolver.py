"""
Foreign key relationship handling for database generation.

This module provides utilities for selecting foreign key values using formula-based 
distributions. The key concept is that formulas work with POSITIONAL INDICES into 
the parent ID list, not the actual ID values themselves.

## How Foreign Key Selection Works:

When a child table references a parent table via foreign key, the resolver:
1. Gets all available parent IDs from the referenced table
2. Uses the distribution formula to select positions within that list
3. Returns the actual ID at the selected position

## Formula Interpretation:

Formulas like UNIF(1, 20) mean "select uniformly from the 1st through 20th parent records",
NOT "select parent records with IDs between 1 and 20".

## Examples:

### Example 1: Sequential Numeric IDs
```python
# Parent table has IDs: [1, 2, 3, 4, 5, ..., 100]
# Formula: UNIF(1, 20)
# Result: Selects from positions 1-20 → IDs 1-20

parent_ids = [1, 2, 3, 4, 5, ..., 100]
UNIF(1, 20) generates 15 → selects parent_ids[14] → returns ID 15
```

### Example 2: UUID String IDs
```python
# Parent table has UUIDs: ['abc-123', 'def-456', 'ghi-789', ...]
# Formula: UNIF(1, 5)
# Result: Selects from positions 1-5 → first 5 UUIDs

parent_ids = ['abc-123', 'def-456', 'ghi-789', 'jkl-012', 'mno-345', ...]
UNIF(1, 5) generates 3 → selects parent_ids[2] → returns 'ghi-789'
```

### Example 3: Non-Sequential Numeric IDs
```python
# Parent table has sparse IDs: [10, 25, 33, 77, 99, 150, ...]
# Formula: UNIF(1, 4)
# Result: Selects from positions 1-4 → IDs [10, 25, 33, 77]

parent_ids = [10, 25, 33, 77, 99, 150, ...]
UNIF(1, 4) generates 2 → selects parent_ids[1] → returns ID 25
```

### Example 4: Weighted Selection with DISC
```python
# Parent table: ['user-1', 'user-2', 'user-3']
# Formula: DISC(0.5, 'user-1', 0.3, 'user-2', 0.2, 'user-3')
# Result: Direct selection by actual ID value (50% user-1, 30% user-2, 20% user-3)
```

## Benefits:

- Works consistently regardless of ID type (numeric, string, UUID)
- Enables predictable selection patterns (first N records, weighted selection, etc.)
- Allows control over which subset of parent records receive child records
- Independent of actual ID values or sequence gaps
"""

import logging
import random
from typing import List, Any, Optional

logger = logging.getLogger(__name__)


class ForeignKeyResolver:
    """Handles foreign key selection using formula-based distributions."""
    
    def __init__(self):
        """Initialize the foreign key resolver."""
        pass
    
    def select_parent_id(self, parent_ids: List[Any], formula: Optional[str] = None) -> Any:
        """
        Select a parent ID from available options using distribution formula.
        
        Args:
            parent_ids: List of available parent IDs
            formula: Distribution formula for selection (optional)
        
        Returns:
            Selected parent ID, or None if no parent_ids available
        
        Examples:
            # Random selection if no formula
            resolver.select_parent_id([1, 2, 3])  # Returns random ID
            
            # Uniform selection from range
            resolver.select_parent_id([1, 2, 3], "UNIF(1, 3)")  # Uniform over IDs
            
            # Discrete weighted selection
            resolver.select_parent_id([1, 2], "DISC(0.7, 1, 0.3, 2)")  # 70% chance of ID 1
        """
        if not parent_ids:
            return None
            
        if not formula:
            # Simple random selection if no formula
            return random.choice(parent_ids)
        
        try:
            from ....distributions import generate_from_distribution
            
            # Check formula type for appropriate handling
            formula_upper = formula.upper().strip()
            
            if formula_upper.startswith('UNIF('):
                # For uniform distributions, map generated value to parent IDs
                value = generate_from_distribution(formula)
                
                # If the value is in the range of parent_ids indices (0-based or 1-based)
                if isinstance(value, (int, float)):
                    # Assume formula generates values in range [1, len(parent_ids)] (1-based)
                    # Map to 0-based index
                    index = max(0, min(len(parent_ids) - 1, int(value) - 1))
                    return parent_ids[index]
                else:
                    # If somehow not numeric, fall back to random
                    return random.choice(parent_ids)
                    
            elif formula_upper.startswith('DISC('):
                # For discrete distributions, the formula should specify actual parent IDs as values
                # e.g., DISC(0.7, 1, 0.3, 2) where 1 and 2 are actual parent IDs
                value = generate_from_distribution(formula)
                
                # Check if the generated value is in our parent_ids list
                if value in parent_ids:
                    return value
                else:
                    # If generated value not in parent_ids, fall back to random
                    logger.warning(f"Generated FK value {value} not in parent_ids {parent_ids}. Using random selection.")
                    return random.choice(parent_ids)
            
            else:
                # For other distribution types (NORM, POIS, etc.), map to indices
                value = generate_from_distribution(formula)
                
                if isinstance(value, (int, float)):
                    # Map numeric value to index using modulo to ensure valid range
                    index = int(abs(value)) % len(parent_ids)
                    return parent_ids[index]
                else:
                    # Non-numeric value, use random
                    return random.choice(parent_ids)
                    
        except Exception as e:
            logger.warning(f"Error using formula '{formula}' for FK selection: {e}. Using random selection.")
            return random.choice(parent_ids)