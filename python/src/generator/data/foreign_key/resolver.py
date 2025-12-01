"""
Foreign key relationship handling for database generation.

This module provides utilities for selecting foreign key values using formula-based 
distributions.
## Formula Interpretation:

Formulas like UNIF(1, 20) mean "select uniformly from the 1st through 20th parent records",
NOT "select parent records with IDs between 1 and 20".

## Example:

### Example: UUID String IDs
```python
# Parent table has UUIDs: ['abc-123', 'def-456'...]
# Formula: UNIF(1, 5)
# Result: Selects from positions 1-5 → first 5 UUIDs

parent_ids = ['abc-123', 'def-456', 'ghi-789', 'jkl-012', 'mno-345', ...]
UNIF(1, 5) generates 3 → selects parent_ids[2] → returns 'ghi-789'
```
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
        if not parent_ids:
            return None
            
        if not formula:
            # Simple random selection if no formula
            return random.choice(parent_ids)
        
        try:
            from ....distributions import generate_from_distribution
            formula_upper = formula.upper().strip()
            
            if formula_upper.startswith('UNIF('):    
                # Generate position value (1-based, inclusive)
                value = generate_from_distribution(formula)
                
                if isinstance(value, (int, float)):
                    # Convert position to 0-based index
                    # Position 1 -> index 0, Position N -> index N-1
                    position_1based = int(round(value))
                    index_0based = position_1based - 1
                    
                    # Clamp to valid range
                    index_0based = max(0, min(len(parent_ids) - 1, index_0based))
                    
                    # Return the ID at this position
                    return parent_ids[index_0based]
                else:
                    return random.choice(parent_ids)
                    
            elif formula_upper.startswith('DISC('):
                value = generate_from_distribution(formula)
                
                # Check if the generated value is in our parent_ids list
                if value in parent_ids:
                    return value
                else:
                    # If generated value not in parent_ids, fall back to random
                    logger.warning(f"Generated FK value {value} not in parent_ids {parent_ids}. Using random selection.")
                    return random.choice(parent_ids)
            
            else:
                value = generate_from_distribution(formula)
                
                if isinstance(value, (int, float)):
                    index = int(abs(value)) % len(parent_ids)
                    return parent_ids[index]
                else:
                    # Non-numeric value, use random
                    return random.choice(parent_ids)
                    
        except Exception as e:
            logger.warning(f"Error using formula '{formula}' for FK selection: {e}. Using random selection.")
            return random.choice(parent_ids)