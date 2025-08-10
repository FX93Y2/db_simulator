/**
 * Workflow-related actions for the simulation config store
 * Handles state transitions, loading states, and error management
 */
export const createWorkflowActions = (set, get) => ({
  /**
   * Set the current workflow state
   * @param {string} newState - New state ('idle', 'loading', 'importing', 'editing', 'saving')
   */
  setCurrentState: (newState) => {
    
    set((state) => {
      state.currentState = newState;
    });
  },

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading: (isLoading) => {
    
    set((state) => {
      state.isLoading = isLoading;
    });
  },

  /**
   * Set error state
   * @param {string|null} error - Error message or null to clear
   */
  setError: (error) => {
    if (error) {
      console.error('[WorkflowActions] Setting error:', error);
    }
    
    set((state) => {
      state.error = error;
    });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    
    set((state) => {
      state.error = null;
    });
  },

  /**
   * Begin import workflow
   */
  beginImport: () => {
    
    set((state) => {
      state.currentState = 'importing';
      state.isLoading = true;
      state.error = null;
    });
  },

  /**
   * Complete import workflow
   * @param {boolean} success - Whether import was successful
   * @param {string} message - Success/error message
   */
  completeImport: (success, message) => {
    
    set((state) => {
      state.currentState = 'idle';
      state.isLoading = false;
      
      if (success) {
        state.error = null;
      } else {
        state.error = message;
      }
    });
  },

  /**
   * Begin editing workflow
   */
  beginEdit: () => {
    
    set((state) => {
      state.currentState = 'editing';
    });
  },

  /**
   * Complete editing workflow
   */
  completeEdit: () => {
    
    set((state) => {
      state.currentState = 'idle';
    });
  },

  /**
   * Begin saving workflow
   */
  beginSave: () => {
    
    set((state) => {
      state.currentState = 'saving';
      state.isLoading = true;
      state.error = null;
    });
  },

  /**
   * Complete saving workflow
   * @param {boolean} success - Whether save was successful
   * @param {string} message - Success/error message
   */
  completeSave: (success, message) => {
    
    set((state) => {
      state.currentState = 'idle';
      state.isLoading = false;
      
      if (success) {
        state.error = null;
      } else {
        state.error = message;
      }
    });
  },

  /**
   * Reset workflow to idle state
   */
  resetWorkflow: () => {
    
    set((state) => {
      state.currentState = 'idle';
      state.isLoading = false;
      state.error = null;
    });
  },

  /**
   * Check if current state allows certain operations
   */
  canImport: () => {
    const currentState = get().currentState;
    return currentState === 'idle';
  },

  canEdit: () => {
    const currentState = get().currentState;
    return currentState === 'idle' || currentState === 'editing';
  },

  canSave: () => {
    const currentState = get().currentState;
    return currentState === 'idle' || currentState === 'editing';
  }
});