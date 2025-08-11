/**
 * Entity UI-related actions for the simulation config store
 * Handles modal management, selection state, and user interaction events
 */
export const createEntityUIActions = (set, get) => ({
  /**
   * Set the currently selected entity
   * @param {Object|null} entity - Entity object or null to clear selection
   */
  setSelectedEntity: (entity) => {
    set((state) => {
      state.selectedEntity = entity;
    });
  },

  /**
   * Open entity edit modal
   * @param {Object} entity - Entity to edit
   */
  openEntityModal: (entity) => {
    set((state) => {
      state.selectedEntity = entity;
      state.showEntityModal = true;
    });
  },

  /**
   * Close entity edit modal
   */
  closeEntityModal: () => {
    set((state) => {
      state.showEntityModal = false;
      state.selectedEntity = null;
    });
  },

  /**
   * Handle entity node click
   * @param {Event} event - Click event
   * @param {Object} node - Clicked node object
   */
  handleEntityClick: (event, node) => {
    set((state) => {
      state.selectedEntity = node;
    });
  },

  /**
   * Handle entity node double click (open editor)
   * @param {Event} event - Double click event
   * @param {Object} node - Double-clicked node object
   */
  handleEntityDoubleClick: (event, node) => {
    get().openEntityModal(node);
  },

  /**
   * Handle entity node drag stop (update position)
   * @param {Event} event - Drag event
   * @param {Object} node - Dragged node object
   */
  handleEntityDragStop: (event, node) => {
    // Update position in both visual and canonical state
    get().updateEntityPosition(node.id, node.position);
  },

  /**
   * Handle entity nodes delete
   * @param {Array} deletedNodes - Array of deleted node objects
   */
  handleEntitiesDelete: (deletedNodes) => {
    const deletedIds = deletedNodes.map(node => node.id);
    get().deleteEntities(deletedIds);
    
    // Clear selection if deleted entity was selected
    const { selectedEntity } = get();
    if (selectedEntity && deletedIds.includes(selectedEntity.id)) {
      get().setSelectedEntity(null);
    }
  },

  /**
   * Handle entity update from modal
   * @param {Object} updatedEntity - Updated entity data
   */
  handleEntityUpdate: (updatedEntity) => {
    const { selectedEntity } = get();
    if (selectedEntity) {
      get().updateEntity(selectedEntity.id, {
        name: updatedEntity.name,
        type: updatedEntity.type,
        rows: updatedEntity.rows,
        attributes: updatedEntity.attributes
      });
    }
    
    // Close modal after update
    get().closeEntityModal();
  },

  /**
   * Handle entity delete from modal
   * @param {Object} entity - Entity to delete
   */
  handleEntityDelete: (entity) => {
    const { selectedEntity } = get();
    if (selectedEntity) {
      get().deleteEntity(selectedEntity.id);
    }
    
    // Close modal after deletion
    get().closeEntityModal();
  },

  /**
   * Clear entity selection
   */
  clearEntitySelection: () => {
    set((state) => {
      state.selectedEntity = null;
    });
  },

  /**
   * Handle keyboard shortcuts (non-destructive only)
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleEntityKeyboard: (event) => {
    // Escape key - clear selection and close modals
    if (event.key === 'Escape') {
      get().clearEntitySelection();
      get().closeEntityModal();
    }
    
    // Note: Delete/Backspace shortcuts removed - entities can only be deleted via explicit button clicks
  },

  /**
   * Handle ReactFlow nodes change (for position updates)
   * @param {Array} changes - Array of node changes
   */
  handleEntityNodesChange: (changes) => {
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        // Update position immediately for visual feedback
        set((state) => {
          const nodeIndex = state.entityNodes.findIndex(node => node.id === change.id);
          if (nodeIndex !== -1) {
            state.entityNodes[nodeIndex].position = change.position;
          }
        });
        
        // Also update in canonical entities and PositionService
        get().updateEntityPosition(change.id, change.position);
      }
    });
  },

  /**
   * Handle ReactFlow edges change
   * @param {Array} changes - Array of edge changes
   */
  handleEntityEdgesChange: (changes) => {
    // Handle edge changes if needed
    // Currently most edge operations are handled by connection/deletion methods
  },

  /**
   * Handle entity connection (ReactFlow onConnect)
   * @param {Object} connection - Connection object from ReactFlow
   */
  handleEntityConnect: (connection) => {
    get().connectEntities(connection);
  },

  /**
   * Handle entity edges delete
   * @param {Array} deletedEdges - Array of deleted edge objects
   */
  handleEntityEdgesDelete: (deletedEdges) => {
    get().deleteEntityConnections(deletedEdges);
  },

  /**
   * Reset all entity UI state
   */
  resetEntityUI: () => {
    set((state) => {
      state.selectedEntity = null;
      state.showEntityModal = false;
    });
  },

  /**
   * Set entity viewport state (for ReactFlow viewport persistence)
   * @param {Object} viewport - Viewport state {x, y, zoom}
   */
  setEntityViewport: (viewport) => {
    set((state) => {
      state.entityViewportState = viewport;
    });
  },

  /**
   * Toggle entity modal visibility
   */
  toggleEntityModal: () => {
    const { showEntityModal } = get();
    if (showEntityModal) {
      get().closeEntityModal();
    } else if (get().selectedEntity) {
      get().openEntityModal(get().selectedEntity);
    }
  }
});