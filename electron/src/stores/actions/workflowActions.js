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
    console.log('[WorkflowActions] State transition:', get().currentState, '->', newState);
    
    set((state) => {
      state.currentState = newState;
    });
  },

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading: (isLoading) => {
    console.log('[WorkflowActions] Setting loading state:', isLoading);
    
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
    } else {
      console.log('[WorkflowActions] Clearing error');
    }
    
    set((state) => {
      state.error = error;
    });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    console.log('[WorkflowActions] Clearing error');
    
    set((state) => {
      state.error = null;
    });
  },

  /**
   * Begin import workflow
   */
  beginImport: () => {
    console.log('[WorkflowActions] Beginning import workflow');
    
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
    console.log('[WorkflowActions] Import completed:', success ? 'success' : 'failure');
    
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
    console.log('[WorkflowActions] Beginning edit workflow');
    
    set((state) => {
      state.currentState = 'editing';
    });
  },

  /**
   * Complete editing workflow
   */
  completeEdit: () => {
    console.log('[WorkflowActions] Edit completed');
    
    set((state) => {
      state.currentState = 'idle';
    });
  },

  /**
   * Begin saving workflow
   */
  beginSave: () => {
    console.log('[WorkflowActions] Beginning save workflow');
    
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
    console.log('[WorkflowActions] Save completed:', success ? 'success' : 'failure');
    
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
    console.log('[WorkflowActions] Resetting workflow to idle');
    
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