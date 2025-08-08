import { createMachine, assign } from 'xstate';

/**
 * Main workflow state machine for simulation configuration editor
 * Prevents invalid state transitions and coordinates complex workflows
 */
export const configWorkflowMachine = createMachine({
  id: 'configWorkflow',
  initial: 'idle',
  context: {
    error: null,
    progress: null,
    lastAction: null
  },
  states: {
    idle: {
      entry: 'clearError',
      on: {
        LOAD_CONFIG: {
          target: 'loading',
          actions: assign({ lastAction: 'LOAD_CONFIG' })
        },
        IMPORT_YAML: {
          target: 'importing',
          actions: assign({ lastAction: 'IMPORT_YAML' })
        },
        EDIT_NODE: {
          target: 'editing',
          actions: assign({ lastAction: 'EDIT_NODE' })
        },
        SAVE_CONFIG: {
          target: 'saving',
          actions: assign({ lastAction: 'SAVE_CONFIG' })
        }
      }
    },
    loading: {
      entry: 'setLoadingState',
      on: {
        LOAD_SUCCESS: {
          target: 'idle',
          actions: 'clearError'
        },
        LOAD_ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error })
        }
      }
    },
    importing: {
      entry: 'setImportingState',
      on: {
        IMPORT_SUCCESS: {
          target: 'idle',
          actions: ['clearError', 'notifyImportSuccess']
        },
        IMPORT_ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error })
        },
        // Prevent canvas updates during import
        CANVAS_UPDATE: {
          actions: 'ignoreCanvasUpdate'
        }
      }
    },
    editing: {
      entry: 'setEditingState',
      on: {
        SAVE_CHANGES: {
          target: 'saving',
          actions: assign({ lastAction: 'SAVE_CHANGES' })
        },
        CANCEL_EDIT: {
          target: 'idle',
          actions: 'cancelEdit'
        },
        // Allow canvas updates during editing
        CANVAS_UPDATE: {
          actions: 'handleCanvasUpdate'
        }
      }
    },
    saving: {
      entry: 'setSavingState',
      on: {
        SAVE_SUCCESS: {
          target: 'idle',
          actions: ['clearError', 'notifySaveSuccess']
        },
        SAVE_ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error })
        }
      }
    },
    error: {
      entry: 'setErrorState',
      on: {
        RETRY: {
          target: 'idle',
          actions: 'clearError'
        },
        CLEAR_ERROR: {
          target: 'idle',
          actions: 'clearError'
        }
      }
    }
  }
}, {
  actions: {
    clearError: assign({ error: null }),
    setLoadingState: () => {
      console.log('[ConfigWorkflow] Entering loading state');
    },
    setImportingState: () => {
      console.log('[ConfigWorkflow] Entering importing state - blocking canvas updates');
    },
    setEditingState: () => {
      console.log('[ConfigWorkflow] Entering editing state');
    },
    setSavingState: () => {
      console.log('[ConfigWorkflow] Entering saving state');
    },
    setErrorState: (context) => {
      console.error('[ConfigWorkflow] Error state:', context.error);
    },
    ignoreCanvasUpdate: () => {
      console.log('[ConfigWorkflow] Ignoring canvas update during import');
    },
    handleCanvasUpdate: () => {
      console.log('[ConfigWorkflow] Handling canvas update during editing');
    },
    cancelEdit: () => {
      console.log('[ConfigWorkflow] Edit cancelled');
    },
    notifyImportSuccess: () => {
      console.log('[ConfigWorkflow] Import completed successfully');
    },
    notifySaveSuccess: () => {
      console.log('[ConfigWorkflow] Save completed successfully');
    }
  },
  guards: {
    canEdit: (context, event) => {
      // Only allow editing in certain states
      return context.lastAction !== 'IMPORT_YAML';
    },
    canImport: (context, event) => {
      // Prevent import during other operations
      return context.lastAction !== 'SAVE_CONFIG';
    }
  }
});