# Decide Module Improvements - Arena-Style Enhancement

## Overview
Enhanced the Decide module to match Arena's design with cascading handles and support for multiple event connections, similar to Arena's N-way decision module.

## Key Improvements

### 1. **Cascading Handle Layout**
- **Before**: 2-3 fixed handles positioned on the right side of the diamond
- **After**: Dynamic cascading handles positioned vertically below the diamond
- Handles start below the diamond and cascade downward with 25px spacing
- Supports unlimited number of outcomes (vs previous limit of 3)

### 2. **Always-Available Handle**
- Added a special "+" handle at the bottom of the cascade
- Users can directly connect new events through the canvas without opening the modal
- Automatically creates new outcomes when connected
- Distinguished by red color and dashed border

### 3. **Visual Enhancements**
- **Color Coding**: Each outcome handle has a unique color (green, red, blue, purple, yellow)
- **Clean Layout**: Simplified design without labels or connecting lines
- **Dynamic Sizing**: Node height adjusts based on number of outcomes
- **Proper Positioning**: Handles positioned at diamond's right edge, cascading downward

### 4. **Automatic Outcome Management**
- When connecting to the always-available handle, automatically creates new outcomes
- Auto-balances probabilities (equal distribution among all outcomes)
- Seamless integration with existing NodeEditModal for detailed editing

## Technical Implementation

### Files Modified:
1. **`FlowNodeComponents.jsx`**: Enhanced DecideNode component with cascading handles
2. **`ModularEventFlow.jsx`**: Updated connection logic for dynamic outcome creation
3. **`_modular-event-flow.scss`**: Added styling for cascading layout and visual enhancements

### Key Features:
- **Dynamic Handle Rendering**: Generates handles based on outcome count + always-available handle
- **Smart Positioning**: Calculates optimal spacing and node height
- **Connection Intelligence**: Distinguishes between existing and new outcome connections
- **Visual Feedback**: Clear labels, colors, and hover effects

### CSS Enhancements:
- Cascading handle styles with proper positioning
- Color-coded handles for easy identification
- Clean, minimal design without clutter
- Proper z-indexing for layered elements

## Result
The Decide module now provides:
- ✅ **Arena-like appearance** with cascading handles
- ✅ **Unlimited outcomes** (previously limited to 3)
- ✅ **Direct canvas connections** via always-available handle
- ✅ **Visual clarity** with color coding and clean layout
- ✅ **Automatic outcome creation** and probability balancing
- ✅ **Backward compatibility** with existing decide nodes

This enhancement significantly improves the user experience by making decision modeling more intuitive and visually similar to Arena's established patterns.