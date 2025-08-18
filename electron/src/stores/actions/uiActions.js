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
   * Toggle selection mode between pan and selection
   */
  toggleSelectionMode: () => {
    set((state) => {
      state.selectionMode = !state.selectionMode;
    });
  },

  /**
   * Set dragging state for module drag-and-drop
   * @param {boolean} isDragging - Whether a module is being dragged
   * @param {string|null} moduleType - Type of module being dragged
   */
  setDragState: (isDragging, moduleType = null) => {
    set((state) => {
      state.isDragging = isDragging;
      state.draggedModuleType = moduleType;
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
   * Update selected nodes array based on current node selection states
   */
  updateSelectedNodes: () => {
    set((state) => {
      const selectedNodes = state.nodes.filter(node => node.selected);
      state.selectedNodes = selectedNodes;
      
      // Keep selectedNode for backward compatibility (use first selected)
      state.selectedNode = selectedNodes.length > 0 ? selectedNodes[0] : null;
    });
  },

  /**
   * Handle node click event (deprecated - use ReactFlow's native multiselection)
   * @param {Object} event - React event
   * @param {Object} node - Clicked node
   */
  handleNodeClick: (_event, node) => {
    // This function is kept for backward compatibility
    // but should be avoided in favor of ReactFlow's native selection
    set((state) => {
      state.selectedNode = node;
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
  },

  /**
   * Copy selected nodes to clipboard
   */
  copyNodes: () => {
    const { selectedNodes, canonicalSteps } = get();
    if (selectedNodes.length === 0) return;

    // Get full node data from canonical steps
    const nodesToCopy = selectedNodes.map(node => {
      const canonicalStep = canonicalSteps.find(step => step.step_id === node.id);
      return canonicalStep || {
        step_id: node.id,
        step_type: node.data?.stepType,
        ...node.data?.stepConfig
      };
    });

    set((state) => {
      state.clipboard = nodesToCopy;
    });
  },

  /**
   * Paste nodes from clipboard at specified position
   * @param {Object} position - Position to paste nodes {x, y}
   */
  pasteNodes: (position = { x: 100, y: 100 }) => {
    const { clipboard, pasteCounter, canonicalSteps } = get();
    if (clipboard.length === 0) return;

    // Generate unique names for pasted nodes
    const pastedNodes = clipboard.map((step, index) => {
      const baseId = step.step_id;
      let newId = `${baseId}_${pasteCounter + index}`;
      
      // Ensure the ID is unique
      let counter = pasteCounter + index;
      while (canonicalSteps.some(s => s.step_id === newId)) {
        counter++;
        newId = `${baseId}_${counter}`;
      }

      return {
        ...step,
        step_id: newId,
        // Offset position for each pasted node
        position: {
          x: position.x + (index * 50),
          y: position.y + (index * 30)
        }
      };
    });

    // Add each pasted node using the canvas action
    pastedNodes.forEach(step => {
      get().addNode(step, step.position);
    });

    // Update paste counter
    set((state) => {
      state.pasteCounter = state.pasteCounter + clipboard.length;
    });
  },

  /**
   * Show context menu
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  showContextMenu: (x, y) => {
    set((state) => {
      state.contextMenu = { visible: true, x, y };
    });
  },

  /**
   * Hide context menu
   */
  hideContextMenu: () => {
    set((state) => {
      state.contextMenu = { visible: false, x: 0, y: 0 };
    });
  }
});