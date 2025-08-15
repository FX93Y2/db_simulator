/**
 * UI-related actions for the simulation config store
 * Handles tab switching, modals, selections, and UI state
 */
export const createUIActions = (set, get) => ({
  /**
   * Set the active visualization tab
   * @param {string} tab - Tab name ('event-flow', 'resources', 'simulation')
   */
  setActiveTab: (tab) => {
    
    set((state) => {
      state.activeTab = tab;
    });
  },

  /**
   * Set the currently selected node
   * @param {Object|null} node - Selected node or null to clear selection
   */
  setSelectedNode: (node) => {
    
    set((state) => {
      state.selectedNode = node;
    });
  },

  /**
   * Clear node selection
   */
  clearSelection: () => {
    
    set((state) => {
      state.selectedNode = null;
      
      // Clear all node selections
      state.nodes = state.nodes.map(node => ({
        ...node,
        selected: false
      }));
      
      // Clear all edge selections
      state.edges = state.edges.map(edge => ({
        ...edge,
        selected: false
      }));
    });
  },

  /**
   * Set modal visibility state
   * @param {boolean} show - Whether to show the edit modal
   */
  setShowEditModal: (show) => {
    
    set((state) => {
      state.showEditModal = show;
    });
  },

  /**
   * Open edit modal for the currently selected node
   */
  openEditModal: () => {
    const { selectedNode } = get();
    
    if (!selectedNode) {
      console.warn('[UIActions] Cannot open edit modal: no node selected');
      return;
    }
    
    
    set((state) => {
      state.showEditModal = true;
    });
  },

  /**
   * Close edit modal
   */
  closeEditModal: () => {
    
    set((state) => {
      state.showEditModal = false;
    });
  },

  /**
   * Handle node click event
   * @param {Object} event - React event
   * @param {Object} node - Clicked node
   */
  handleNodeClick: (_event, node) => {
    
    set((state) => {
      state.selectedNode = node;
      
      // Update node selection state in ReactFlow
      state.nodes = state.nodes.map(n => ({
        ...n,
        selected: n.id === node?.id
      }));
      
      // Highlight connected edges when node is selected
      if (node) {
        state.edges = state.edges.map(edge => ({
          ...edge,
          selected: edge.source === node.id || edge.target === node.id
        }));
      } else {
        // Clear all edge selections when no node is selected
        state.edges = state.edges.map(edge => ({
          ...edge,
          selected: false
        }));
      }
    });
  },

  /**
   * Handle node double click event
   * @param {Object} event - React event
   * @param {Object} node - Double-clicked node
   */
  handleNodeDoubleClick: (_event, node) => {
    
    set((state) => {
      state.selectedNode = node;
      state.showEditModal = true;
    });
  },

  /**
   * Handle pane click event (clicking on canvas background)
   * @param {Object} event - React event
   */
  handlePaneClick: (_event) => {
    
    // Clear selection when clicking on the canvas
    get().clearSelection();
  },

  /**
   * Update viewport state
   * @param {Object} viewport - New viewport state {x, y, zoom}
   */
  updateViewport: (viewport) => {
    set((state) => {
      state.viewportState = viewport;
    });
  },

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyboard: (event) => {
    const { selectedNode } = get();
    
    if (event.key === 'Escape') {
      if (get().showEditModal) {
        get().closeEditModal();
      } else if (selectedNode) {
        get().clearSelection();
      }
      event.preventDefault();
    }
    
    // Enter: Open edit modal for selected node
    if (event.key === 'Enter' && selectedNode && !get().showEditModal) {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );
      
      if (!isTyping) {
        get().openEditModal();
        event.preventDefault();
      }
    }
  }
});