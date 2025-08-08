import { initializeStoreActions } from './actions/index.js';
import { setupDevtools } from '../utils/storeDevtools.js';

/**
 * Initialize the complete store system
 * Sets up actions, debugging tools, and any required integrations
 */
export const initializeStore = () => {
  console.log('🚀 Initializing simulation config store...');
  
  try {
    // Initialize all store actions
    const actions = initializeStoreActions();
    
    // Set up development tools
    if (process.env.NODE_ENV === 'development') {
      setupDevtools();
    }
    
    console.log('✅ Store initialization completed successfully');
    console.log('📊 Available actions:', Object.keys(actions).length);
    
    return {
      success: true,
      actions: Object.keys(actions)
    };
    
  } catch (error) {
    console.error('❌ Store initialization failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Store health check
 * Validates that the store is properly initialized
 */
export const checkStoreHealth = () => {
  const { useSimulationConfigStore } = require('./simulationConfigStore.js');
  
  try {
    const store = useSimulationConfigStore.getState();
    
    const checks = {
      storeExists: !!store,
      hasActions: !!(store.importYaml && store.updateNodes && store.setCurrentState),
      hasInitialState: store.currentState === 'idle',
      hasPositionsMap: store.positions instanceof Map
    };
    
    const allPassed = Object.values(checks).every(Boolean);
    
    if (allPassed) {
      console.log('✅ Store health check passed');
    } else {
      console.warn('⚠️ Store health check failed:', checks);
    }
    
    return {
      healthy: allPassed,
      checks
    };
    
  } catch (error) {
    console.error('❌ Store health check error:', error);
    return {
      healthy: false,
      error: error.message
    };
  }
};