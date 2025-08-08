# Complete State Management Architecture Rebuild Plan

## Overview
This document outlines the complete rebuild of the simulation configuration editor's state management architecture. The current system suffers from circular dependencies, scattered state, and debugging difficulties. We will rebuild from scratch using modern patterns with Zustand + XState.

## Problem Analysis

### Current Architecture Issues
1. **Circular Dependencies**: YAML ↔ Canvas sync creates infinite loops
2. **Scattered State**: React useState spread across multiple components and hooks
3. **Prop Drilling**: Complex prop chains between SimConfigEditor → ModularEventFlow → hooks
4. **Debugging Difficulty**: No central state inspection, hard to trace bugs
5. **Performance Issues**: Unnecessary re-renders, flickering during imports

### Current Components to Replace
- `SimConfigEditor.jsx` (lines 32-45: scattered useState)
- `ModularEventFlow.jsx` (complex hook orchestration)
- `useFlowVisualState.js` (circular onDiagramChange calls)
- `useFlowYamlProcessor.js` (YAML sync logic)
- `useStepManager.js` (canonical steps management)
- `useFlowEventHandlers.js` (event handling with state updates)
- `useFlowConnections.js` (connection state management)

## New Architecture Design

### Phase 1: Complete Cleanup & Dependencies

#### Remove Current State Management
```bash
# Delete problematic hooks
rm -rf electron/src/hooks/event-flow/

# Clean up scattered state in components
# - Remove useState calls in SimConfigEditor.jsx
# - Remove hook dependencies in ModularEventFlow.jsx
```

#### Install Modern Dependencies
```json
{
  "zustand": "^4.4.7",           // Lightweight state management
  "@xstate/react": "^4.1.0",    // React integration for state machines  
  "xstate": "^5.0.0",            // Finite state machines
  "immer": "^10.0.3"             // Immutable updates (Zustand integration)
}
```

### Phase 2: Central Store Architecture

#### Main Zustand Store (`src/stores/simulationConfigStore.js`)
```javascript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export const useSimulationConfigStore = create()(
  devtools(
    immer((set, get) => ({
      // === CORE DATA ===
      yamlContent: '',
      parsedSchema: null,
      canonicalSteps: [],
      
      // === VISUAL STATE (ReactFlow) ===
      nodes: [],
      edges: [],
      
      // === UI STATE ===
      activeTab: 'event-flow',
      selectedNode: null,
      showEditModal: false,
      
      // === WORKFLOW STATE ===
      currentState: 'idle', // idle | loading | importing | editing | saving
      isLoading: false,
      error: null,
      
      // === CANVAS STATE ===
      positions: new Map(),
      viewportState: { x: 0, y: 0, zoom: 1 },
      
      // === ACTIONS ===
      // Will be populated by action modules
    }))
  )
)
```

#### Store Action Structure
```
src/stores/actions/
├── yamlActions.js           # YAML operations (import, export, parse, validate)
├── canvasActions.js         # Canvas operations (nodes, edges, positioning)  
├── workflowActions.js       # State machine transitions
└── index.js                # Combined action exports
```

### Phase 3: XState Workflow Machines

#### Main Config Machine (`src/machines/configWorkflowMachine.js`)
```javascript
import { createMachine } from 'xstate'

export const configWorkflowMachine = createMachine({
  id: 'configWorkflow',
  initial: 'idle',
  states: {
    idle: {
      on: {
        LOAD_CONFIG: 'loading',
        IMPORT_YAML: 'importing',
        EDIT_NODE: 'editing'
      }
    },
    loading: {
      on: {
        LOAD_SUCCESS: 'idle',
        LOAD_ERROR: 'error'
      }
    },
    importing: {
      // Prevents canvas updates during import
      on: {
        IMPORT_SUCCESS: 'idle',
        IMPORT_ERROR: 'error'
      }
    },
    editing: {
      on: {
        SAVE_CHANGES: 'saving',
        CANCEL_EDIT: 'idle'
      }
    },
    saving: {
      on: {
        SAVE_SUCCESS: 'idle',
        SAVE_ERROR: 'error'
      }
    },
    error: {
      on: {
        RETRY: 'idle',
        CLEAR_ERROR: 'idle'
      }
    }
  }
})
```

#### YAML Sync Machine (`src/machines/yamlSyncMachine.js`)
```javascript
export const yamlSyncMachine = createMachine({
  id: 'yamlSync',
  initial: 'synced',
  states: {
    synced: {
      // Both YAML and canvas are in sync
      on: {
        YAML_CHANGED: 'yaml_dirty',
        CANVAS_CHANGED: 'canvas_dirty'
      }
    },
    yaml_dirty: {
      // YAML changed, need to update canvas
      entry: 'updateCanvasFromYaml',
      on: {
        SYNC_COMPLETE: 'synced'
      }
    },
    canvas_dirty: {
      // Canvas changed, need to update YAML  
      entry: 'updateYamlFromCanvas',
      on: {
        SYNC_COMPLETE: 'synced'
      }
    }
  }
})
```

### Phase 4: Clean Component Architecture

#### New SimConfigEditor Structure
```javascript
// No local state - everything from store
import { useSimulationConfigStore } from '../stores/simulationConfigStore'

const SimConfigEditor = ({ projectId, isProjectTab, theme }) => {
  // Selective subscriptions - no unnecessary re-renders
  const yamlContent = useSimulationConfigStore(state => state.yamlContent)
  const currentState = useSimulationConfigStore(state => state.currentState)
  const error = useSimulationConfigStore(state => state.error)
  
  // Actions from store
  const { importYaml, exportYaml, saveConfig } = useSimulationConfigStore()
  
  // Clean event handlers - dispatch to store
  const handleImport = useCallback((content) => {
    importYaml(content)
  }, [importYaml])
  
  // No more circular dependencies!
  return (/* Clean JSX */)
}
```

#### New ModularEventFlow Structure  
```javascript
import { useSimulationConfigStore } from '../stores/simulationConfigStore'

const ModularEventFlow = ({ theme }) => {
  // Direct store subscriptions
  const nodes = useSimulationConfigStore(state => state.nodes)
  const edges = useSimulationConfigStore(state => state.edges)
  const selectedNode = useSimulationConfigStore(state => state.selectedNode)
  
  // Canvas actions from store
  const { updateNodePosition, deleteNodes, connectNodes } = useSimulationConfigStore()
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeDragStop={(event, node) => updateNodePosition(node.id, node.position)}
      onNodesDelete={(nodes) => deleteNodes(nodes.map(n => n.id))}
      // Clean, simple event handling
    />
  )
}
```

### Phase 5: Enhanced Developer Experience

#### Debugging Tools (`src/utils/storeDevtools.js`)
```javascript
export const setupDevtools = () => {
  if (process.env.NODE_ENV === 'development') {
    // Zustand Redux DevTools integration
    window.__ZUSTAND_STORE__ = useSimulationConfigStore
    
    // XState visualizer integration
    window.__XSTATE_MACHINES__ = {
      configWorkflow: configWorkflowMachine,
      yamlSync: yamlSyncMachine
    }
    
    // Enhanced logging
    console.log('🛠️ Store debugging tools enabled')
  }
}
```

#### Error Boundaries & Recovery
```javascript
// Comprehensive error handling for malformed YAML, network issues, etc.
// Graceful fallbacks and user-friendly error messages
// State recovery mechanisms
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Remove all existing state management code
- [ ] Install new dependencies  
- [ ] Create base Zustand store structure
- [ ] Set up development tools

### Week 2: Core Logic
- [ ] Implement XState machines
- [ ] Build store actions (YAML, canvas, workflow)
- [ ] Create pure utility functions
- [ ] Add comprehensive error handling

### Week 3: Component Rebuild
- [ ] Rebuild SimConfigEditor with store integration
- [ ] Clean component structure, remove prop drilling
- [ ] Implement selective subscriptions
- [ ] Add loading states and error handling

### Week 4: Canvas Integration  
- [ ] Rebuild ModularEventFlow with simplified architecture
- [ ] Direct ReactFlow integration with store
- [ ] Clean event handling without circular dependencies
- [ ] Position management integration

### Week 5: Polish & Testing
- [ ] Add debugging tools and DevTools integration
- [ ] Comprehensive testing of all workflows
- [ ] Performance optimization
- [ ] Documentation and code comments

## Success Metrics

### Eliminated Issues
- ✅ **No Circular Dependencies** - XState prevents invalid state transitions
- ✅ **No Flickering** - Controlled state updates via state machines
- ✅ **No Prop Drilling** - Direct component-store connections  
- ✅ **Clear Data Flow** - Unidirectional state updates

### Enhanced Capabilities  
- ✅ **Superior Debugging** - Full state inspection via Redux DevTools
- ✅ **State Machine Visualization** - XState visualizer for workflow debugging
- ✅ **Better Performance** - Selective subscriptions, optimized re-renders
- ✅ **Enhanced Testing** - Predictable state transitions, pure functions
- ✅ **Future-Proof Architecture** - Modern patterns, easy to extend

## File Structure (After Rebuild)

```
electron/src/
├── stores/
│   ├── simulationConfigStore.js     # Main Zustand store
│   └── actions/
│       ├── yamlActions.js           # YAML operations
│       ├── canvasActions.js         # Canvas operations  
│       ├── workflowActions.js       # State transitions
│       └── index.js                 # Combined exports
├── machines/
│   ├── configWorkflowMachine.js     # Main workflow state machine
│   └── yamlSyncMachine.js           # YAML ↔ Canvas sync coordination
├── components/
│   ├── pages/
│   │   └── SimConfigEditor.jsx      # Rebuilt, store-connected
│   └── shared/
│       └── ModularEventFlow.jsx     # Rebuilt, simplified
├── utils/
│   ├── storeDevtools.js             # Enhanced debugging tools
│   ├── yamlProcessor.js             # Pure YAML functions
│   └── canvasUtils.js               # Pure canvas utilities
└── hooks/ 
    └── shared/                       # Keep only shared utilities
        ├── useCanvasPositions.js     # Enhanced for store integration
        └── useResourceDefinitions.js # Keep as-is
```

## Migration Strategy

1. **Backup Current State** - Create branch `backup/old-state-management`
2. **Progressive Replacement** - Replace components one by one
3. **Feature Parity** - Ensure all existing functionality works
4. **Enhanced Features** - Add new debugging and error handling capabilities
5. **Performance Testing** - Verify no regressions, improved performance
6. **Documentation** - Update README and component docs

This rebuild will provide a rock-solid foundation for future development while solving all current architectural issues.