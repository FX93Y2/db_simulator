import { createMachine, assign } from 'xstate';

/**
 * YAML synchronization state machine
 * Coordinates bidirectional sync between YAML content and canvas representation
 * Prevents circular updates that cause flickering
 */
export const yamlSyncMachine = createMachine({
  id: 'yamlSync',
  initial: 'synced',
  context: {
    lastUpdateSource: null,
    updateCount: 0,
    syncInProgress: false
  },
  states: {
    synced: {
      entry: 'setSyncComplete',
      on: {
        YAML_CHANGED: {
          target: 'yaml_dirty',
          actions: assign({ 
            lastUpdateSource: 'yaml',
            updateCount: (context) => context.updateCount + 1
          })
        },
        CANVAS_CHANGED: {
          target: 'canvas_dirty', 
          actions: assign({
            lastUpdateSource: 'canvas',
            updateCount: (context) => context.updateCount + 1
          })
        }
      }
    },
    yaml_dirty: {
      entry: ['setSyncInProgress', 'updateCanvasFromYaml'],
      on: {
        SYNC_COMPLETE: {
          target: 'synced',
          actions: 'clearSyncInProgress'
        },
        SYNC_ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error })
        },
        // Ignore canvas changes while updating from YAML
        CANVAS_CHANGED: {
          actions: 'ignoreCanvasChange'
        }
      }
    },
    canvas_dirty: {
      entry: ['setSyncInProgress', 'updateYamlFromCanvas'],
      on: {
        SYNC_COMPLETE: {
          target: 'synced',
          actions: 'clearSyncInProgress'
        },
        SYNC_ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error })
        },
        // Ignore YAML changes while updating from canvas
        YAML_CHANGED: {
          actions: 'ignoreYamlChange'
        }
      }
    },
    error: {
      entry: 'setSyncError',
      on: {
        RETRY_SYNC: 'synced',
        RESET_SYNC: {
          target: 'synced',
          actions: 'resetSyncState'
        }
      }
    }
  }
}, {
  actions: {
    setSyncComplete: assign({ syncInProgress: false }),
    setSyncInProgress: assign({ syncInProgress: true }),
    clearSyncInProgress: assign({ syncInProgress: false }),
    setSyncError: (context, event) => {
      console.error('[YamlSync] Sync error:', event.error);
    },
    updateCanvasFromYaml: () => {
      console.log('[YamlSync] Updating canvas from YAML');
    },
    updateYamlFromCanvas: () => {
      console.log('[YamlSync] Updating YAML from canvas');
    },
    ignoreCanvasChange: () => {
      console.log('[YamlSync] Ignoring canvas change during YAML->Canvas sync');
    },
    ignoreYamlChange: () => {
      console.log('[YamlSync] Ignoring YAML change during Canvas->YAML sync');
    },
    resetSyncState: assign({
      lastUpdateSource: null,
      updateCount: 0,
      syncInProgress: false,
      error: null
    })
  },
  guards: {
    isNotSyncing: (context) => !context.syncInProgress,
    isSafeToUpdate: (context, event) => {
      // Prevent rapid updates that could cause loops
      return context.updateCount < 10;
    }
  }
});