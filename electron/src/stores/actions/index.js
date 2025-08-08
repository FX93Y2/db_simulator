import { createYamlActions } from './yamlActions.js';
import { createCanvasActions } from './canvasActions.js';
import { createWorkflowActions } from './workflowActions.js';
import { createUIActions } from './uiActions.js';
import { createConfigActions } from './configActions.js';

/**
 * Initialize all store actions
 * This function combines all action modules and injects them into the store
 */
export const initializeStoreActions = () => {
  // Import the store
  const { useSimulationConfigStore } = require('../simulationConfigStore.js');
  
  // Get the store methods
  const store = useSimulationConfigStore.getState();
  const set = useSimulationConfigStore.setState;
  const get = useSimulationConfigStore.getState;
  
  // Create all action modules
  const yamlActions = createYamlActions(set, get);
  const canvasActions = createCanvasActions(set, get);
  const workflowActions = createWorkflowActions(set, get);
  const uiActions = createUIActions(set, get);
  const configActions = createConfigActions(set, get);
  
  // Combine all actions
  const allActions = {
    ...yamlActions,
    ...canvasActions,
    ...workflowActions,
    ...uiActions,
    ...configActions
  };
  
  // Initialize the store with actions
  store._initializeActions(allActions);
  
  console.log('[StoreActions] All actions initialized successfully');
  
  return allActions;
};

/**
 * Action groups for organized imports
 */
export { createYamlActions } from './yamlActions.js';
export { createCanvasActions } from './canvasActions.js';
export { createWorkflowActions } from './workflowActions.js';
export { createUIActions } from './uiActions.js';
export { createConfigActions } from './configActions.js';