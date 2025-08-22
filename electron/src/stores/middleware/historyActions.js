/**
 * Shared history management for undo/redo functionality
 * Used by both database and simulation configuration stores
 */

import positionService from '../../services/PositionService.js';

/**
 * Create history state snapshot for saving
 * @param {Object} state - Current store state
 * @param {string} storeType - Type of store ('database' | 'simulation')
 * @returns {Object} - State snapshot for history
 */
export const createStateSnapshot = (state, storeType) => {
  if (storeType === 'database') {
    // Get all positions from PositionService
    const projectId = state.projectId;
    const positions = projectId ? positionService.getAllPositions(projectId) : new Map();
    
    return {
      canonicalEntities: [...state.canonicalEntities],
      entityNodes: [...state.entityNodes],
      entityEdges: [...state.entityEdges],
      positions: new Map(positions) // Save current positions
    };
  } else if (storeType === 'simulation') {
    return {
      canonicalSteps: [...state.canonicalSteps],
      nodes: [...state.nodes],
      edges: [...state.edges],
      positions: new Map(state.positions)
    };
  }
  
  throw new Error(`Unknown store type: ${storeType}`);
};

/**
 * Restore state from history snapshot
 * @param {Function} set - Zustand set function
 * @param {Function} get - Zustand get function
 * @param {Object} snapshot - History snapshot to restore
 * @param {string} storeType - Type of store ('database' | 'simulation')
 */
export const restoreStateSnapshot = (set, get, snapshot, storeType) => {
  if (storeType === 'database') {
    set((state) => {
      state.canonicalEntities = [...snapshot.canonicalEntities];
      state.entityNodes = [...snapshot.entityNodes];
      state.entityEdges = [...snapshot.entityEdges];
    });
    
    // Restore positions to PositionService
    const projectId = get().projectId;
    if (projectId) {
      if (snapshot.positions) {
        // First, get all current positions to identify what needs to be removed
        const currentPositions = positionService.getAllPositions(projectId);
        const currentEntityPositions = new Set();
        
        // Identify current entity positions (no underscores/hyphens)
        for (const nodeId of currentPositions.keys()) {
          if (!nodeId.includes('_') && !nodeId.includes('-')) {
            currentEntityPositions.add(nodeId);
          }
        }
        
        // Remove positions for entities that are no longer in the snapshot
        const snapshotEntityIds = new Set();
        for (const nodeId of snapshot.positions.keys()) {
          if (!nodeId.includes('_') && !nodeId.includes('-')) {
            snapshotEntityIds.add(nodeId);
          }
        }
        
        // Remove orphaned entity positions
        for (const nodeId of currentEntityPositions) {
          if (!snapshotEntityIds.has(nodeId)) {
            positionService.removePosition(projectId, nodeId);
          }
        }
        
        // Restore positions from snapshot to PositionService
        snapshot.positions.forEach((position, nodeId) => {
          positionService.setPosition(projectId, nodeId, position);
        });
      } else {
        // No positions in snapshot, remove all entity positions
        const currentPositions = positionService.getAllPositions(projectId);
        for (const nodeId of currentPositions.keys()) {
          if (!nodeId.includes('_') && !nodeId.includes('-')) {
            positionService.removePosition(projectId, nodeId);
          }
        }
      }
    }
    
    // Trigger YAML regeneration after restoring state
    // This ensures the YAML content stays in sync with the visual state
    get().updateEntityVisualState();
  } else if (storeType === 'simulation') {
    set((state) => {
      state.canonicalSteps = [...snapshot.canonicalSteps];
      state.nodes = [...snapshot.nodes];
      state.edges = [...snapshot.edges];
      state.positions = new Map(snapshot.positions);
    });
    
    // Also clean up step positions in PositionService for consistency
    const projectId = get().projectId;
    if (projectId) {
      // Get all current positions to identify what needs to be removed
      const currentPositions = positionService.getAllPositions(projectId);
      const currentStepPositions = new Set();
      
      // Identify current step positions (contain underscores/hyphens)
      for (const nodeId of currentPositions.keys()) {
        if (nodeId.includes('_') || nodeId.includes('-')) {
          currentStepPositions.add(nodeId);
        }
      }
      
      // Remove positions for steps that are no longer in the snapshot
      const snapshotStepIds = new Set();
      for (const nodeId of snapshot.positions.keys()) {
        if (nodeId.includes('_') || nodeId.includes('-')) {
          snapshotStepIds.add(nodeId);
        }
      }
      
      // Remove orphaned step positions
      for (const nodeId of currentStepPositions) {
        if (!snapshotStepIds.has(nodeId)) {
          positionService.removePosition(projectId, nodeId);
        }
      }
      
      // Restore step positions to PositionService for consistency
      snapshot.positions.forEach((position, nodeId) => {
        if (nodeId.includes('_') || nodeId.includes('-')) {
          positionService.setPosition(projectId, nodeId, position);
        }
      });
    }
    
    // Trigger YAML regeneration after restoring state
    // This ensures the YAML content stays in sync with the visual state
    get().updateVisualState();
    get().syncCanvasToYaml();
  } else {
    throw new Error(`Unknown store type: ${storeType}`);
  }
};

/**
 * Push current state to history before making changes
 * @param {Function} set - Zustand set function
 * @param {Function} get - Zustand get function
 * @param {string} storeType - Type of store ('database' | 'simulation')
 * @param {string} actionType - Type of action being performed ('ADD' | 'DELETE')
 * @param {*} actionData - Additional data about the action
 */
export const pushToHistory = (set, get, storeType, actionType, actionData = null) => {
  const state = get();
  const snapshot = createStateSnapshot(state, storeType);
  
  set((state) => {
    // Limit history to 20 entries to prevent memory bloat
    if (state.nodeHistory.past.length >= 20) {
      state.nodeHistory.past.shift();
    }
    
    // Save current state to history
    state.nodeHistory.past.push({
      snapshot,
      actionType,
      actionData,
      timestamp: Date.now()
    });
    
    // Clear future when new action is performed
    state.nodeHistory.future = [];
    state.nodeHistory.lastAction = actionType;
  });
};


/**
 * Perform undo operation
 * @param {Function} set - Zustand set function
 * @param {Function} get - Zustand get function
 * @param {string} storeType - Type of store ('database' | 'simulation')
 * @returns {boolean} - Success status
 */
export const performUndo = (set, get, storeType) => {
  const state = get();
  
  if (state.nodeHistory.past.length === 0) {
    return false;
  }
  
  // Save current state to future stack
  const currentSnapshot = createStateSnapshot(state, storeType);
  const lastHistoryEntry = state.nodeHistory.past[state.nodeHistory.past.length - 1];
  
  set((state) => {
    // Move current state to future
    state.nodeHistory.future.push({
      snapshot: currentSnapshot,
      actionType: state.nodeHistory.lastAction,
      timestamp: Date.now()
    });
    
    // Remove last entry from past
    const historyEntry = state.nodeHistory.past.pop();
    
    // Update last action
    state.nodeHistory.lastAction = historyEntry.actionType;
  });
  
  // Restore previous state
  restoreStateSnapshot(set, get, lastHistoryEntry.snapshot, storeType);
  
  return true;
};

/**
 * Perform redo operation
 * @param {Function} set - Zustand set function
 * @param {Function} get - Zustand get function
 * @param {string} storeType - Type of store ('database' | 'simulation')
 * @returns {boolean} - Success status
 */
export const performRedo = (set, get, storeType) => {
  const state = get();
  
  if (state.nodeHistory.future.length === 0) {
    return false;
  }
  
  // Save current state to past stack
  const currentSnapshot = createStateSnapshot(state, storeType);
  const nextHistoryEntry = state.nodeHistory.future[state.nodeHistory.future.length - 1];
  
  set((state) => {
    // Move current state to past
    state.nodeHistory.past.push({
      snapshot: currentSnapshot,
      actionType: state.nodeHistory.lastAction,
      timestamp: Date.now()
    });
    
    // Remove last entry from future
    const historyEntry = state.nodeHistory.future.pop();
    
    // Update last action
    state.nodeHistory.lastAction = historyEntry.actionType;
  });
  
  // Restore future state
  restoreStateSnapshot(set, get, nextHistoryEntry.snapshot, storeType);
  
  return true;
};

/**
 * Clear history stacks
 * @param {Function} set - Zustand set function
 */
export const clearHistory = (set) => {
  set((state) => {
    state.nodeHistory.past = [];
    state.nodeHistory.future = [];
    state.nodeHistory.lastAction = null;
  });
};

/**
 * Check if undo is available
 * @param {Object} state - Current store state
 * @returns {boolean} - Whether undo is available
 */
export const canUndo = (state) => {
  return state.nodeHistory && state.nodeHistory.past.length > 0;
};

/**
 * Check if redo is available
 * @param {Object} state - Current store state
 * @returns {boolean} - Whether redo is available
 */
export const canRedo = (state) => {
  return state.nodeHistory && state.nodeHistory.future.length > 0;
};