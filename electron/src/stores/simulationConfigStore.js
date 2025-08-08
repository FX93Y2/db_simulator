import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import { createYamlActions } from './actions/yamlActions.js';
import { createCanvasActions } from './actions/canvasActions.js';
import { createWorkflowActions } from './actions/workflowActions.js';
import { createUIActions } from './actions/uiActions.js';
import { createConfigActions } from './actions/configActions.js';

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

/**
 * Central Zustand store for simulation configuration editor
 * Single source of truth replacing all scattered React state
 */
export const useSimulationConfigStore = create()(
  devtools(
    immer((set, get) => {
      // Create all actions immediately
      const yamlActions = createYamlActions(set, get);
      const canvasActions = createCanvasActions(set, get);
      const workflowActions = createWorkflowActions(set, get);
      const uiActions = createUIActions(set, get);
      const configActions = createConfigActions(set, get);

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
        showEditModal: false,
        
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
        projectId: null,
        isProjectTab: false,
        
        // ===== DATABASE CONFIG =====
        dbConfigContent: null,
        theme: 'light',
        
        // ===== ACTIONS (available immediately) =====
        ...yamlActions,
        ...canvasActions,
        ...workflowActions,
        ...uiActions,
        ...configActions
      };
    }),
    {
      name: 'simulation-config-store', // For Redux DevTools
      partialize: (state) => ({
        // Only persist certain parts of state
        yamlContent: state.yamlContent,
        activeTab: state.activeTab,
        positions: Array.from(state.positions.entries()), // Convert Map to array for persistence
        viewportState: state.viewportState
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

/**
 * Selector hooks for specific parts of the store
 * Prevents unnecessary re-renders by subscribing only to needed data
 */
export const useYamlContent = () => useSimulationConfigStore(state => state.yamlContent);
export const useParsedSchema = () => useSimulationConfigStore(state => state.parsedSchema);
export const useCanonicalSteps = () => useSimulationConfigStore(state => state.canonicalSteps);
export const useNodes = () => useSimulationConfigStore(state => state.nodes);
export const useEdges = () => useSimulationConfigStore(state => state.edges);
export const useSelectedNode = () => useSimulationConfigStore(state => state.selectedNode);
export const useShowEditModal = () => useSimulationConfigStore(state => state.showEditModal);
export const useCurrentState = () => useSimulationConfigStore(state => state.currentState);
export const useIsLoading = () => useSimulationConfigStore(state => state.isLoading);
export const useError = () => useSimulationConfigStore(state => state.error);
export const useActiveTab = () => useSimulationConfigStore(state => state.activeTab);

/**
 * Action hooks for specific operations
 */
export const useYamlActions = () => {
  return useSimulationConfigStore(state => ({
    importYaml: state.importYaml,
    exportYaml: state.exportYaml,
    updateYamlContent: state.updateYamlContent,
    parseYaml: state.parseYaml,
    generateYaml: state.generateYaml,
    validateYaml: state.validateYaml
  }));
};

export const useCanvasActions = () => {
  return useSimulationConfigStore(state => ({
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

export const useWorkflowActions = () => {
  return useSimulationConfigStore(state => ({
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

export const useUIActions = () => {
  return useSimulationConfigStore(state => ({
    setActiveTab: state.setActiveTab,
    setSelectedNode: state.setSelectedNode,
    setShowEditModal: state.setShowEditModal,
    clearSelection: state.clearSelection,
    openEditModal: state.openEditModal,
    closeEditModal: state.closeEditModal,
    handleNodeClick: state.handleNodeClick,
    handleNodeDoubleClick: state.handleNodeDoubleClick,
    updateViewport: state.updateViewport,
    handleKeyboard: state.handleKeyboard
  }));
};

export const useConfigActions = () => {
  return useSimulationConfigStore(state => ({
    updateConfig: state.updateConfig,
    updateName: state.updateName,
    updateDescription: state.updateDescription,
    loadConfig: state.loadConfig,
    saveConfig: state.saveConfig,
    runSimulation: state.runSimulation,
    initializeConfig: state.initializeConfig,
    clearConfig: state.clearConfig
  }));
};

// Export the raw store for advanced usage
export const store = useSimulationConfigStore;