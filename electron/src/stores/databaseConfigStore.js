import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import { createEntityActions } from './actions/entityActions.js';
import { createEntityYamlActions } from './actions/entityYamlActions.js';
import { createEntityUIActions } from './actions/entityUIActions.js';
import { createDatabaseConfigActions } from './actions/databaseConfigActions.js';
import { performUndo, performRedo, canUndo, canRedo } from './middleware/historyActions.js';

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

// Store instances cache - one store per project
const storeInstances = new Map();

/**
 * Create a project-scoped database configuration store
 * Each project gets its own isolated store instance for database/entity management
 * @param {string} projectId - Project identifier for store isolation
 * @returns {Function} - Zustand store hook for the project
 */
const createProjectStore = (projectId = 'default') => {
  const storeName = projectId ? `database-config-${projectId}` : 'database-config-default';
  
  return create()(
    devtools(
      immer((set, get) => {
        // Create all actions immediately
        const entityActions = createEntityActions(set, get);
        const entityYamlActions = createEntityYamlActions(set, get);
        const entityUIActions = createEntityUIActions(set, get);
        const databaseConfigActions = createDatabaseConfigActions(set, get);

        return {
          // ===== PROJECT STATE =====
          projectId: projectId,
          
          // ===== ENTITY STATE (ER Diagram) =====
          canonicalEntities: [],
          entityNodes: [],
          entityEdges: [],
          selectedEntity: null,
          selectedEntities: [],
          selectedEdges: [],
          selectionMode: false,
          showEntityModal: false,
          dbSchema: null,
          entityViewportState: { x: 0, y: 0, zoom: 1 },
          onEntityDiagramChange: null,
          
          // ===== CLIPBOARD & CONTEXT MENU STATE =====
          clipboard: [],
          pasteCounter: 1,
          contextMenu: { visible: false, x: 0, y: 0 },
          
          // ===== WORKFLOW STATE =====
          currentState: 'idle', // 'idle' | 'loading' | 'importing' | 'editing' | 'saving'
          isLoading: false,
          error: null,
          
          // ===== DATABASE CONFIG CONTENT =====
          yamlContent: '',
          parsedSchema: null,
          config: null,
          name: '',
          description: '',
          isProjectTab: false,
          theme: 'light',
          
          // ===== HISTORY STATE (Undo/Redo) =====
          nodeHistory: {
            past: [],    // Array of previous states
            future: [],  // Array of states for redo
            lastAction: null
          },
          
          // ===== ACTIONS (available immediately) =====
          ...entityActions,
          ...entityYamlActions,
          ...entityUIActions,
          ...databaseConfigActions,
          
          // ===== UNDO/REDO ACTIONS =====
          undo: () => performUndo(set, get, 'database'),
          redo: () => performRedo(set, get, 'database'),
          canUndo: () => canUndo(get()),
          canRedo: () => canRedo(get()),
        };
      }),
      {
        name: storeName, // Project-specific name for Redux DevTools
        partialize: (state) => ({
          // Only persist certain parts of state
          yamlContent: state.yamlContent,
          entityViewportState: state.entityViewportState,
          canonicalEntities: state.canonicalEntities // Persist entities for position restoration
        }),
      }
    )
  );
};

/**
 * Get or create a project-scoped database store
 * @param {string} projectId - Project identifier
 * @returns {Function} - Zustand store hook for the project
 */
export const useDatabaseConfigStore = (projectId = 'default') => {
  // Create store key
  const storeKey = projectId || 'default';
  
  // Get or create store instance for this project
  if (!storeInstances.has(storeKey)) {
    console.log(`[DatabaseStore] Creating new store instance for project: ${storeKey}`);
    storeInstances.set(storeKey, createProjectStore(projectId));
  }
  
  return storeInstances.get(storeKey);
};

/**
 * Project-scoped selector hooks for specific parts of the database store
 * Prevents unnecessary re-renders by subscribing only to needed data
 * @param {string} projectId - Project identifier for store isolation
 */
export const useCanonicalEntities = (projectId) => useDatabaseConfigStore(projectId)(state => state.canonicalEntities);
export const useEntityNodes = (projectId) => useDatabaseConfigStore(projectId)(state => state.entityNodes);
export const useEntityEdges = (projectId) => useDatabaseConfigStore(projectId)(state => state.entityEdges);
export const useSelectedEntity = (projectId) => useDatabaseConfigStore(projectId)(state => state.selectedEntity);
export const useSelectedEntities = (projectId) => useDatabaseConfigStore(projectId)(state => state.selectedEntities);
export const useSelectedEdges = (projectId) => useDatabaseConfigStore(projectId)(state => state.selectedEdges);
export const useSelectionMode = (projectId) => useDatabaseConfigStore(projectId)(state => state.selectionMode);
export const useShowEntityModal = (projectId) => useDatabaseConfigStore(projectId)(state => state.showEntityModal);
export const useDbSchema = (projectId) => useDatabaseConfigStore(projectId)(state => state.dbSchema);
export const useEntityViewportState = (projectId) => useDatabaseConfigStore(projectId)(state => state.entityViewportState);
export const useDatabaseCurrentState = (projectId) => useDatabaseConfigStore(projectId)(state => state.currentState);
export const useDatabaseIsLoading = (projectId) => useDatabaseConfigStore(projectId)(state => state.isLoading);
export const useClipboard = (projectId) => useDatabaseConfigStore(projectId)(state => state.clipboard);
export const usePasteCounter = (projectId) => useDatabaseConfigStore(projectId)(state => state.pasteCounter);
export const useContextMenu = (projectId) => useDatabaseConfigStore(projectId)(state => state.contextMenu);
export const useDatabaseError = (projectId) => useDatabaseConfigStore(projectId)(state => state.error);
export const useDatabaseYamlContent = (projectId) => useDatabaseConfigStore(projectId)(state => state.yamlContent);
export const useDatabaseConfig = (projectId) => useDatabaseConfigStore(projectId)(state => state.config);
export const useDatabaseName = (projectId) => useDatabaseConfigStore(projectId)(state => state.name);
export const useDatabaseDescription = (projectId) => useDatabaseConfigStore(projectId)(state => state.description);

/**
 * Entity action hooks
 * @param {string} projectId - Project identifier for store isolation
 */
export const useEntityActions = (projectId) => {
  return useDatabaseConfigStore(projectId)(state => ({
    addEntity: state.addEntity,
    updateEntity: state.updateEntity,
    deleteEntity: state.deleteEntity,
    updateEntityPosition: state.updateEntityPosition,
    updateEntityVisualState: state.updateEntityVisualState,
    connectEntities: state.connectEntities,
    deleteEntityConnections: state.deleteEntityConnections,
    deleteEntities: state.deleteEntities,
    setEntityDiagramChangeCallback: state.setEntityDiagramChangeCallback
  }));
};

export const useEntityYamlActions = (projectId) => {
  return useDatabaseConfigStore(projectId)(state => ({
    generateEntityYaml: state.generateEntityYaml,
    importEntityYaml: state.importEntityYaml,
    exportEntityYaml: state.exportEntityYaml,
    parseEntityYaml: state.parseEntityYaml,
    validateEntityYaml: state.validateEntityYaml,
    detectEntityChanges: state.detectEntityChanges,
    loadEntitiesFromYaml: state.loadEntitiesFromYaml,
    clearEntities: state.clearEntities
  }));
};

export const useEntityUIActions = (projectId) => {
  return useDatabaseConfigStore(projectId)(state => ({
    setSelectedEntity: state.setSelectedEntity,
    toggleSelectionMode: state.toggleSelectionMode,
    updateEntityNodes: state.updateEntityNodes,
    updateEntityEdges: state.updateEntityEdges,
    updateSelectedEntities: state.updateSelectedEntities,
    setSelectedEdges: state.setSelectedEdges,
    deleteSelectedEdge: state.deleteSelectedEdge,
    openEntityModal: state.openEntityModal,
    closeEntityModal: state.closeEntityModal,
    handleEntityClick: state.handleEntityClick,
    handleEdgeClick: state.handleEdgeClick,
    handleEntityDoubleClick: state.handleEntityDoubleClick,
    handleEntityDragStop: state.handleEntityDragStop,
    handleEntitiesDelete: state.handleEntitiesDelete,
    handleEntityUpdate: state.handleEntityUpdate,
    handleEntityDelete: state.handleEntityDelete,
    clearEntitySelection: state.clearEntitySelection,
    handleEntityKeyboard: state.handleEntityKeyboard,
    handleEntityNodesChange: state.handleEntityNodesChange,
    handleEntityEdgesChange: state.handleEntityEdgesChange,
    handleEntityConnect: state.handleEntityConnect,
    copyEntities: state.copyEntities,
    pasteEntities: state.pasteEntities,
    showContextMenu: state.showContextMenu,
    hideContextMenu: state.hideContextMenu,
    handleEntityEdgesDelete: state.handleEntityEdgesDelete,
    resetEntityUI: state.resetEntityUI,
    setEntityViewport: state.setEntityViewport,
    toggleEntityModal: state.toggleEntityModal
  }));
};

export const useDatabaseConfigActions = (projectId) => {
  return useDatabaseConfigStore(projectId)(state => ({
    loadDatabaseConfig: state.loadDatabaseConfig,
    saveDatabaseConfig: state.saveDatabaseConfig,
    initializeDatabaseConfig: state.initializeDatabaseConfig,
    updateConfigMetadata: state.updateConfigMetadata,
    clearDatabaseConfig: state.clearDatabaseConfig,
    getCurrentYamlContent: state.getCurrentYamlContent,
    updateYamlAndNotify: state.updateYamlAndNotify,
    hasContent: state.hasContent,
    // Undo/redo functions
    undo: state.undo,
    redo: state.redo,
    canUndo: state.canUndo,
    canRedo: state.canRedo
  }));
};

/**
 * Store cleanup utility for project switching
 * @param {string} projectId - Project to clean up (optional, cleans all if not provided)
 */
export const cleanupDatabaseStore = (projectId = null) => {
  if (projectId) {
    const storeKey = projectId || 'default';
    if (storeInstances.has(storeKey)) {
      console.log(`[DatabaseStore] Cleaning up store instance for project: ${storeKey}`);
      storeInstances.delete(storeKey);
    }
  } else {
    console.log('[DatabaseStore] Cleaning up all store instances');
    storeInstances.clear();
  }
};

// Export the store factory for advanced usage
export const getProjectDatabaseStore = useDatabaseConfigStore;