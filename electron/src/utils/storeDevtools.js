import { configWorkflowMachine } from '../machines/configWorkflowMachine.js';
import { yamlSyncMachine } from '../machines/yamlSyncMachine.js';

/**
 * Enhanced debugging tools for the new state management architecture
 * Provides store inspection, state machine visualization, and logging utilities
 */
export const setupDevtools = () => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.log('🛠️ Setting up development tools...');

  // Store debugging utilities
  const storeUtils = {
    // Get current store state
    getState: () => {
      const { useSimulationConfigStore } = require('../stores/simulationConfigStore.js');
      return useSimulationConfigStore.getState();
    },

    // Subscribe to store changes
    subscribe: (callback) => {
      const { useSimulationConfigStore } = require('../stores/simulationConfigStore.js');
      return useSimulationConfigStore.subscribe(callback);
    },

    // Pretty print store state
    printState: () => {
      const state = storeUtils.getState();
      console.table({
        yamlContentLength: state.yamlContent?.length || 0,
        canonicalStepsCount: state.canonicalSteps?.length || 0,
        nodesCount: state.nodes?.length || 0,
        edgesCount: state.edges?.length || 0,
        currentState: state.currentState,
        activeTab: state.activeTab,
        isLoading: state.isLoading,
        hasError: !!state.error,
        selectedNode: state.selectedNode?.id || 'none'
      });
    },

    // Export store state for debugging
    exportState: () => {
      const state = storeUtils.getState();
      const exportData = {
        ...state,
        positions: Array.from(state.positions.entries()) // Convert Map to array
      };
      
      console.log('📋 Store state exported to clipboard');
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      
      return exportData;
    },

    // Clear store state
    clearState: () => {
      const state = storeUtils.getState();
      state.clearConfig();
      console.log('🧹 Store state cleared');
    }
  };

  // State machine debugging utilities
  const machineUtils = {
    configWorkflow: configWorkflowMachine,
    yamlSync: yamlSyncMachine,

    // Visualize state machines (requires XState visualizer)
    visualize: () => {
      console.log('🎭 State machines available for visualization:');
      console.log('- configWorkflow:', configWorkflowMachine);
      console.log('- yamlSync:', yamlSyncMachine);
      console.log('Use XState visualizer: https://stately.ai/viz');
    }
  };

  // Enhanced logging utilities
  const loggingUtils = {
    // Enable detailed action logging
    enableActionLogging: () => {
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('[')) {
          const timestamp = new Date().toLocaleTimeString();
          originalConsoleLog(`[${timestamp}]`, ...args);
        } else {
          originalConsoleLog(...args);
        }
      };
      console.log('📝 Enhanced action logging enabled');
    },

    // Log state transitions
    logStateTransitions: () => {
      const unsubscribe = storeUtils.subscribe((state, prevState) => {
        if (state.currentState !== prevState?.currentState) {
          console.log(`🔄 State transition: ${prevState?.currentState || 'unknown'} → ${state.currentState}`);
        }
        
        if (state.activeTab !== prevState?.activeTab) {
          console.log(`📑 Tab changed: ${prevState?.activeTab || 'unknown'} → ${state.activeTab}`);
        }
        
        if (state.canonicalSteps?.length !== prevState?.canonicalSteps?.length) {
          console.log(`📊 Steps count changed: ${prevState?.canonicalSteps?.length || 0} → ${state.canonicalSteps?.length}`);
        }
      });

      console.log('📊 State transition logging enabled');
      return unsubscribe;
    },

    // Performance monitoring
    monitorPerformance: () => {
      const startTime = performance.now();
      let updateCount = 0;

      const unsubscribe = storeUtils.subscribe(() => {
        updateCount++;
        const elapsed = performance.now() - startTime;
        const updatesPerSecond = (updateCount / elapsed * 1000).toFixed(2);
        
        if (updateCount % 10 === 0) {
          console.log(`⚡ Performance: ${updateCount} updates in ${elapsed.toFixed(2)}ms (${updatesPerSecond} updates/sec)`);
        }
      });

      console.log('⚡ Performance monitoring enabled');
      return unsubscribe;
    }
  };

  // Attach to window for global access
  window.__DEV_TOOLS__ = {
    store: storeUtils,
    machines: machineUtils,
    logging: loggingUtils,
    
    // Quick access methods
    state: () => storeUtils.printState(),
    export: () => storeUtils.exportState(),
    clear: () => storeUtils.clearState(),
    
    // Help
    help: () => {
      console.log(`
🛠️ Available Development Tools:

Store Tools:
  __DEV_TOOLS__.store.getState() - Get current store state
  __DEV_TOOLS__.store.printState() - Pretty print state summary
  __DEV_TOOLS__.store.exportState() - Export state to clipboard
  __DEV_TOOLS__.store.clearState() - Clear store state
  __DEV_TOOLS__.state() - Quick state summary

Machine Tools:
  __DEV_TOOLS__.machines.visualize() - View state machines
  
Logging Tools:
  __DEV_TOOLS__.logging.enableActionLogging() - Enhanced logs
  __DEV_TOOLS__.logging.logStateTransitions() - Log state changes
  __DEV_TOOLS__.logging.monitorPerformance() - Performance metrics

Quick Access:
  __DEV_TOOLS__.state() - Show current state
  __DEV_TOOLS__.export() - Export state
  __DEV_TOOLS__.clear() - Clear state
  __DEV_TOOLS__.help() - Show this help
      `);
    }
  };

  // Auto-enable some debugging features
  loggingUtils.enableActionLogging();

  console.log('🛠️ Development tools initialized!');
  console.log('Run __DEV_TOOLS__.help() for available commands');

  return window.__DEV_TOOLS__;
};

/**
 * Production-safe logging utility
 * Only logs in development mode
 */
export const devLog = (category, message, ...args) => {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${category}] ${message}`, ...args);
  }
};

/**
 * Store state validator
 * Checks for common issues in the store state
 */
export const validateStoreState = () => {
  if (process.env.NODE_ENV !== 'development') {
    return { valid: true };
  }

  const { useSimulationConfigStore } = require('../stores/simulationConfigStore.js');
  const state = useSimulationConfigStore.getState();
  
  const issues = [];
  
  // Check for common issues
  if (state.canonicalSteps.length > 0 && state.nodes.length === 0) {
    issues.push('Canonical steps exist but no visual nodes');
  }
  
  if (state.nodes.length > 0 && state.canonicalSteps.length === 0) {
    issues.push('Visual nodes exist but no canonical steps');
  }
  
  if (state.yamlContent && !state.parsedSchema) {
    issues.push('YAML content exists but not parsed');
  }
  
  if (state.canonicalSteps.length !== state.nodes.length) {
    issues.push(`Step/node count mismatch: ${state.canonicalSteps.length} steps vs ${state.nodes.length} nodes`);
  }
  
  // Check for circular references
  state.canonicalSteps.forEach(step => {
    if (step.next_steps?.includes(step.step_id)) {
      issues.push(`Step ${step.step_id} references itself`);
    }
  });
  
  if (issues.length > 0) {
    console.warn('⚠️ Store state validation issues:', issues);
    return { valid: false, issues };
  }
  
  console.log('✅ Store state validation passed');
  return { valid: true };
};