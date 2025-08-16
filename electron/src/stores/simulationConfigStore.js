import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import { createYamlActions } from './actions/yamlActions.js';
import { createCanvasActions } from './actions/canvasActions.js';
import { createWorkflowActions } from './actions/workflowActions.js';
import { createUIActions } from './actions/uiActions.js';
import { createConfigActions } from './actions/configActions.js';
import { createSimulationActions } from './actions/simulationActions.js';
import { performUndo, performRedo, canUndo, canRedo } from './middleware/historyActions.js';

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

// Store instances cache - one store per project
const storeInstances = new Map();

/**
 * Create a project-scoped simulation configuration store
 * Each project gets its own isolated store instance
 * @param {string} projectId - Project identifier for store isolation
 * @returns {Function} - Zustand store hook for the project
 */
const createProjectStore = (projectId = 'default') => {
  const storeName = projectId ? `simulation-config-${projectId}` : 'simulation-config-default';
  
  return create()(
    devtools(
      immer((set, get) => {
        // Create all actions immediately
        const yamlActions = createYamlActions(set, get);
        const canvasActions = createCanvasActions(set, get);
        const workflowActions = createWorkflowActions(set, get);
        const uiActions = createUIActions(set, get);
        const configActions = createConfigActions(set, get);
        const simulationActions = createSimulationActions(set, get);

        return {
          // ===== CORE DATA =====
          yamlContent: '',
          parsedSchema: null,
          canonicalSteps: [],
          flowSchema: null,
          
          // ===== VISUAL STATE (ReactFlow) =====
          nodes: [],
          edges: [],
          
          // ===== UI STATE =====
          activeTab: 'event-flow', // 'event-flow' | 'resources' | 'simulation'
          selectedNode: null,
          selectedNodes: [],
          selectionMode: false,
          showEditModal: false,
          
          // ===== CLIPBOARD & CONTEXT MENU STATE =====
          clipboard: [], // Store copied nodes for paste functionality
          pasteCounter: 1, // Counter for generating unique names for pasted nodes
          contextMenu: { visible: false, x: 0, y: 0 }, // Context menu visibility and position
          
          // ===== WORKFLOW STATE =====
          currentState: 'idle', // 'idle' | 'loading' | 'importing' | 'editing' | 'saving'
          isLoading: false,
          error: null,
          
          // ===== CANVAS STATE =====
          positions: new Map(),
          viewportState: { x: 0, y: 0, zoom: 1 },
          
          // ===== CONFIG METADATA =====
          config: null,
          name: '',
          description: '',
          
          // ===== PROJECT STATE =====
          projectId: projectId,
          isProjectTab: false,
          
          // ===== DATABASE CONFIG =====
          dbConfigContent: null,
          theme: 'light',
          
          // ===== SIMULATION STATE =====
          simulationData: {
            duration_days: 30,
            start_date: '2024-01-01',
            random_seed: 42
          },
          pendingSimulationChanges: {},
          hasUnsavedSimulation: false,
          
          // ===== HISTORY STATE (Undo/Redo) =====
          nodeHistory: {
            past: [],    // Array of previous states
            future: [],  // Array of states for redo
            lastAction: null
          },
          
          // ===== ACTIONS (available immediately) =====
          ...yamlActions,
          ...canvasActions,
          ...workflowActions,
          ...uiActions,
          ...configActions,
          ...simulationActions,
          
          // ===== UNDO/REDO ACTIONS =====
          undo: () => performUndo(set, get, 'simulation'),
          redo: () => performRedo(set, get, 'simulation'),
          canUndo: () => canUndo(get()),
          canRedo: () => canRedo(get()),
        };
      }),
      {
        name: storeName, // Project-specific name for Redux DevTools
        partialize: (state) => ({
          // Only persist certain parts of state
          yamlContent: state.yamlContent,
          activeTab: state.activeTab,
          positions: Array.from(state.positions.entries()), // Convert Map to array for persistence
          viewportState: state.viewportState,
          canonicalSteps: state.canonicalSteps // Persist steps for position restoration
        }),
        // Custom serializer to handle Map
        serialize: (state) => JSON.stringify({
          ...state,
          positions: state.positions ? Array.from(state.positions.entries()) : []
        }),
        // Custom deserializer to restore Map
        deserialize: (str) => {
          const state = JSON.parse(str);
          return {
            ...state,
            positions: new Map(state.positions || [])
          };
        }
      }
    )
  );
};

/**
 * Get or create a project-scoped store
 * @param {string} projectId - Project identifier
 * @returns {Function} - Zustand store hook for the project
 */
export const useSimulationConfigStore = (projectId = 'default') => {
  // Create store key
  const storeKey = projectId || 'default';
  
  // Get or create store instance for this project
  if (!storeInstances.has(storeKey)) {
    console.log(`[Store] Creating new store instance for project: ${storeKey}`);
    storeInstances.set(storeKey, createProjectStore(projectId));
  }
  
  return storeInstances.get(storeKey);
};

/**
 * Project-scoped selector hooks for specific parts of the store
 * Prevents unnecessary re-renders by subscribing only to needed data
 * @param {string} projectId - Project identifier for store isolation
 */
export const useYamlContent = (projectId) => useSimulationConfigStore(projectId)(state => state.yamlContent);
export const useParsedSchema = (projectId) => useSimulationConfigStore(projectId)(state => state.parsedSchema);
export const useCanonicalSteps = (projectId) => useSimulationConfigStore(projectId)(state => state.canonicalSteps);
export const useNodes = (projectId) => useSimulationConfigStore(projectId)(state => state.nodes);
export const useEdges = (projectId) => useSimulationConfigStore(projectId)(state => state.edges);
export const useSelectedNode = (projectId) => useSimulationConfigStore(projectId)(state => state.selectedNode);
export const useSelectedNodes = (projectId) => useSimulationConfigStore(projectId)(state => state.selectedNodes);
export const useSimulationSelectionMode = (projectId) => useSimulationConfigStore(projectId)(state => state.selectionMode);
export const useShowEditModal = (projectId) => useSimulationConfigStore(projectId)(state => state.showEditModal);
export const useCurrentState = (projectId) => useSimulationConfigStore(projectId)(state => state.currentState);
export const useIsLoading = (projectId) => useSimulationConfigStore(projectId)(state => state.isLoading);
export const useError = (projectId) => useSimulationConfigStore(projectId)(state => state.error);
export const useSimulationClipboard = (projectId) => useSimulationConfigStore(projectId)(state => state.clipboard);
export const useSimulationPasteCounter = (projectId) => useSimulationConfigStore(projectId)(state => state.pasteCounter);
export const useSimulationContextMenu = (projectId) => useSimulationConfigStore(projectId)(state => state.contextMenu);
export const useActiveTab = (projectId) => useSimulationConfigStore(projectId)(state => state.activeTab);

/**
 * Project-scoped action hooks for specific operations
 * @param {string} projectId - Project identifier for store isolation
 */
export const useYamlActions = (projectId) => {
  return useSimulationConfigStore(projectId)(state => ({
    importYaml: state.importYaml,
    exportYaml: state.exportYaml,
    updateYamlContent: state.updateYamlContent,
    parseYaml: state.parseYaml,
    generateYaml: state.generateYaml,
    validateYaml: state.validateYaml
  }));
};

export const useCanvasActions = (projectId) => {
  return useSimulationConfigStore(projectId)(state => ({
    updateNodes: state.updateNodes,
    updateEdges: state.updateEdges,
    updateNodePosition: state.updateNodePosition,
    deleteNodes: state.deleteNodes,
    addNode: state.addNode,
    updateStep: state.updateStep,
    updateVisualState: state.updateVisualState,
    syncCanvasToYaml: state.syncCanvasToYaml,
    connectNodes: state.connectNodes
  }));
};

export const useWorkflowActions = (projectId) => {
  return useSimulationConfigStore(projectId)(state => ({
    setCurrentState: state.setCurrentState,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    beginImport: state.beginImport,
    completeImport: state.completeImport,
    beginEdit: state.beginEdit,
    completeEdit: state.completeEdit,
    beginSave: state.beginSave,
    completeSave: state.completeSave,
    resetWorkflow: state.resetWorkflow,
    canImport: state.canImport,
    canEdit: state.canEdit,
    canSave: state.canSave
  }));
};

export const useUIActions = (projectId) => {
  return useSimulationConfigStore(projectId)(state => ({
    setActiveTab: state.setActiveTab,
    setSelectedNode: state.setSelectedNode,
    updateSelectedNodes: state.updateSelectedNodes,
    toggleSelectionMode: state.toggleSelectionMode,
    setShowEditModal: state.setShowEditModal,
    clearSelection: state.clearSelection,
    openEditModal: state.openEditModal,
    closeEditModal: state.closeEditModal,
    handleNodeClick: state.handleNodeClick,
    handleNodeDoubleClick: state.handleNodeDoubleClick,
    updateViewport: state.updateViewport,
    handleKeyboard: state.handleKeyboard,
    copyNodes: state.copyNodes,
    pasteNodes: state.pasteNodes,
    showContextMenu: state.showContextMenu,
    hideContextMenu: state.hideContextMenu
  }));
};

export const useConfigActions = (projectId) => {
  return useSimulationConfigStore(projectId)(state => ({
    updateConfig: state.updateConfig,
    updateName: state.updateName,
    updateDescription: state.updateDescription,
    loadConfig: state.loadConfig,
    saveConfig: state.saveConfig,
    runSimulation: state.runSimulation,
    initializeConfig: state.initializeConfig,
    clearConfig: state.clearConfig,
    hasContent: state.hasContent,
    // Undo/redo functions
    undo: state.undo,
    redo: state.redo,
    canUndo: state.canUndo,
    canRedo: state.canRedo
  }));
};

/**
 * Simulation-specific selector hooks
 * @param {string} projectId - Project identifier for store isolation
 */
export const useSimulationData = (projectId) => useSimulationConfigStore(projectId)(state => state.simulationData);
export const usePendingSimulationChanges = (projectId) => useSimulationConfigStore(projectId)(state => state.pendingSimulationChanges);
export const useHasUnsavedSimulation = (projectId) => useSimulationConfigStore(projectId)(state => state.hasUnsavedSimulation);

export const useSimulationActions = (projectId) => {
  return useSimulationConfigStore(projectId)(state => ({
    updateSimulationField: state.updateSimulationField,
    applySimulationChanges: state.applySimulationChanges,
    resetSimulationChanges: state.resetSimulationChanges,
    loadSimulationFromYaml: state.loadSimulationFromYaml,
    getEffectiveSimulationData: state.getEffectiveSimulationData,
    syncSimulationToYaml: state.syncSimulationToYaml,
    hasFieldPendingChanges: state.hasFieldPendingChanges,
    getFieldValue: state.getFieldValue,
    updateResourceCapacity: state.updateResourceCapacity,
    getResourceCapacity: state.getResourceCapacity
  }));
};


/**
 * Store cleanup utility for project switching
 * @param {string} projectId - Project to clean up (optional, cleans all if not provided)
 */
export const cleanupStore = (projectId = null) => {
  if (projectId) {
    const storeKey = projectId || 'default';
    if (storeInstances.has(storeKey)) {
      console.log(`[Store] Cleaning up store instance for project: ${storeKey}`);
      storeInstances.delete(storeKey);
    }
  } else {
    console.log('[Store] Cleaning up all store instances');
    storeInstances.clear();
  }
};

// Export the store factory for advanced usage
export const getProjectStore = useSimulationConfigStore;