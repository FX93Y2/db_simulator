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
      // Update React Flow's selection state
      state.entityNodes = state.entityNodes.map(n => ({
        ...n,
        selected: n.id === node?.id
      }));
      
      // Highlight connected edges when node is selected
      if (node) {
        state.entityEdges = state.entityEdges.map(edge => ({
          ...edge,
          selected: edge.source === node.id || edge.target === node.id
        }));
      } else {
        // Clear all edge selections when no node is selected
        state.entityEdges = state.entityEdges.map(edge => ({
          ...edge,
          selected: false
        }));
      }
    });
  },

  /**
   * Handle edge click (for selection)
   * @param {Event} event - Click event
   * @param {Object} edge - Clicked edge object
   */
  handleEdgeClick: (event, edge) => {
    set((state) => {
      // Clear node selection when edge is clicked
      state.selectedEntity = null;
      state.entityNodes = state.entityNodes.map(node => ({
        ...node,
        selected: false
      }));
      
      // Set only the clicked edge as selected
      state.entityEdges = state.entityEdges.map(e => ({
        ...e,
        selected: e.id === edge.id
      }));
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
      // Also clear React Flow's internal selection by setting all nodes to selected: false
      state.entityNodes = state.entityNodes.map(node => ({
        ...node,
        selected: false
      }));
      // Clear edge selection as well
      state.entityEdges = state.entityEdges.map(edge => ({
        ...edge,
        selected: false
      }));
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
   * Handle ReactFlow nodes change (for position updates and selection)
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
      } else if (change.type === 'select') {
        // Handle selection changes from React Flow
        set((state) => {
          const nodeIndex = state.entityNodes.findIndex(node => node.id === change.id);
          if (nodeIndex !== -1) {
            state.entityNodes[nodeIndex].selected = change.selected;
            // Sync with selectedEntity state
            if (change.selected) {
              state.selectedEntity = state.entityNodes[nodeIndex];
            } else if (state.selectedEntity?.id === change.id) {
              state.selectedEntity = null;
            }
          }
        });
      }
    });
  },

  /**
   * Handle ReactFlow edges change
   * @param {Array} changes - Array of edge changes
   */
  handleEntityEdgesChange: (changes) => {
    changes.forEach(change => {
      if (change.type === 'select') {
        // Handle edge selection changes from React Flow
        set((state) => {
          const edgeIndex = state.entityEdges.findIndex(edge => edge.id === change.id);
          if (edgeIndex !== -1) {
            state.entityEdges[edgeIndex].selected = change.selected;
            
            // If edge is being selected, clear node selection
            if (change.selected) {
              state.selectedEntity = null;
              state.entityNodes = state.entityNodes.map(node => ({
                ...node,
                selected: false
              }));
              // Also clear other edge selections (only one edge selected at a time)
              state.entityEdges = state.entityEdges.map(edge => ({
                ...edge,
                selected: edge.id === change.id
              }));
            }
          }
        });
      }
      // Handle other edge change types if needed in the future
    });
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