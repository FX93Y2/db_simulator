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
    console.log('[UIActions] Switching to tab:', tab);
    
    set((state) => {
      state.activeTab = tab;
    });
  },

  /**
   * Set the currently selected node
   * @param {Object|null} node - Selected node or null to clear selection
   */
  setSelectedNode: (node) => {
    console.log('[UIActions] Setting selected node:', node?.id || 'none');
    
    set((state) => {
      state.selectedNode = node;
    });
  },

  /**
   * Clear node selection
   */
  clearSelection: () => {
    console.log('[UIActions] Clearing node selection');
    
    set((state) => {
      state.selectedNode = null;
    });
  },

  /**
   * Set modal visibility state
   * @param {boolean} show - Whether to show the edit modal
   */
  setShowEditModal: (show) => {
    console.log('[UIActions] Setting edit modal visibility:', show);
    
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
    
    console.log('[UIActions] Opening edit modal for node:', selectedNode.id);
    
    set((state) => {
      state.showEditModal = true;
    });
  },

  /**
   * Close edit modal
   */
  closeEditModal: () => {
    console.log('[UIActions] Closing edit modal');
    
    set((state) => {
      state.showEditModal = false;
    });
  },

  /**
   * Handle node click event
   * @param {Object} event - React event
   * @param {Object} node - Clicked node
   */
  handleNodeClick: (event, node) => {
    console.log('[UIActions] Node clicked:', node.id);
    
    set((state) => {
      state.selectedNode = node;
    });
  },

  /**
   * Handle node double click event
   * @param {Object} event - React event
   * @param {Object} node - Double-clicked node
   */
  handleNodeDoubleClick: (event, node) => {
    console.log('[UIActions] Node double-clicked:', node.id);
    
    set((state) => {
      state.selectedNode = node;
      state.showEditModal = true;
    });
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
    
    // Delete/Backspace: Delete selected node
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
      // Check if user is not typing in an input field
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );
      
      if (!isTyping) {
        console.log('[UIActions] Deleting selected node via keyboard:', selectedNode.id);
        get().deleteNodes([selectedNode.id]);
        get().clearSelection();
        event.preventDefault();
      }
    }
    
    // Escape: Clear selection or close modal
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