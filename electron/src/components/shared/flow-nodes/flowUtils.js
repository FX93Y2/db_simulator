/**
 * Utility functions for ModularEventFlow
 */

// Generate a consistent ID for the schema based on flow content
export const generateSchemaId = (yamlContent) => {
  if (!yamlContent) return null;
  
  try {
    // Generate a stable ID that doesn't change when positions are modified
    const yamlPrefix = yamlContent.substring(0, 200).replace(/\s+/g, '');
    let stableId = '';
    
    // Simple hash function to create a stable ID
    for (let i = 0; i < yamlPrefix.length; i++) {
      stableId += yamlPrefix.charCodeAt(i);
    }
    
    return `modular_flow_positions_${stableId}`;
  } catch (error) {
    console.error('Error generating schema ID:', error);
    return null;
  }
};

// Load layout map from localStorage
export const loadLayoutFromStorage = (schemaId) => {
  if (!schemaId) return {};
  
  try {
    const saved = localStorage.getItem(schemaId);
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.error('Error loading layout from localStorage:', err);
    return {};
  }
};

// Save layout to localStorage with debouncing
export const saveLayoutToStorage = (layoutMap, schemaId) => {
  if (!schemaId) return;
  
  try {
    localStorage.setItem(schemaId, JSON.stringify(layoutMap));
  } catch (err) {
    console.error('Error saving layout to localStorage:', err);
  }
};

// Build nodes from flow steps
export const buildNodesFromFlow = (flow, layoutMap, theme, currentPositions = {}) => {
  const newNodes = [];

  flow.steps.forEach((step, index) => {
    // Use position from localStorage if available, then current positions, then default layout
    const savedPosition = layoutMap[step.step_id];
    const currentPosition = currentPositions[step.step_id];
    const defaultX = 100 + (index % 3) * 300;
    const defaultY = 100 + Math.floor(index / 3) * 200;
    
    const position = savedPosition || currentPosition || { x: defaultX, y: defaultY };

    let nodeType = 'process';
    if (step.step_type === 'decide') nodeType = 'decide';
    if (step.step_type === 'assign') nodeType = 'assign';
    if (step.step_type === 'release') nodeType = 'release';

    const node = {
      id: step.step_id,
      type: nodeType,
      position: position,
      data: {
        label: step.step_id,
        stepConfig: step,
        theme: theme
      }
    };

    newNodes.push(node);
  });

  return newNodes;
};

// Build edges from flow step connections
export const buildEdgesFromFlow = (flow) => {
  const newEdges = [];

  flow.steps.forEach((step) => {
    if (step.step_type === 'decide' && step.decide_config?.outcomes) {
      // Handle decide step outcomes
      step.decide_config.outcomes.forEach((outcome, index) => {
        if (outcome.next_step_id) {
          newEdges.push({
            id: `${step.step_id}-${outcome.next_step_id}`,
            source: step.step_id,
            target: outcome.next_step_id,
            sourceHandle: `outcome-${index}`,
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' },
            style: { stroke: '#ed8936', strokeWidth: 2 }
          });
        }
      });
    } else if (step.next_steps && step.next_steps.length > 0) {
      // Handle regular next_steps
      step.next_steps.forEach((nextStepId) => {
        newEdges.push({
          id: `${step.step_id}-${nextStepId}`,
          source: step.step_id,
          target: nextStepId,
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { stroke: '#38a169', strokeWidth: 2 }
        });
      });
    }
  });

  return newEdges;
};

// Check if user is typing in an input field (for keyboard shortcuts)
export const isUserTyping = () => {
  const activeElement = document.activeElement;
  return activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.tagName === 'SELECT' ||
    activeElement.contentEditable === 'true' ||
    activeElement.isContentEditable
  );
};