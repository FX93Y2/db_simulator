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

// Step validation utilities
export const validateStep = (step) => {
  const errors = [];
  
  if (!step.step_id || step.step_id.trim() === '') {
    errors.push('Step ID is required');
  }
  
  if (!step.step_type || !['event', 'decide', 'assign', 'release'].includes(step.step_type)) {
    errors.push('Valid step type is required (event, decide, assign, release)');
  }
  
  // Validate step-specific configurations
  switch (step.step_type) {
    case 'event':
      // Event names are now derived from step_id, no longer stored in event_config
      if (!step.event_config?.duration) {
        errors.push('Event duration configuration is required');
      }
      break;
    case 'decide':
      if (!step.decide_config?.decision_type) {
        errors.push('Decision type is required');
      }
      break;
    case 'assign':
      if (!step.assign_config?.assignments || step.assign_config.assignments.length === 0) {
        errors.push('At least one assignment is required');
      }
      break;
    case 'release':
      // Release steps don't require additional validation
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate entire flow
export const validateFlow = (steps) => {
  const errors = [];
  const stepIds = new Set();
  
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push('Flow must contain at least one step');
    return { isValid: false, errors };
  }
  
  // Check for duplicate step IDs
  steps.forEach(step => {
    if (stepIds.has(step.step_id)) {
      errors.push(`Duplicate step ID: ${step.step_id}`);
    } else {
      stepIds.add(step.step_id);
    }
    
    // Validate individual step
    const stepValidation = validateStep(step);
    if (!stepValidation.isValid) {
      errors.push(...stepValidation.errors.map(err => `${step.step_id}: ${err}`));
    }
  });
  
  // Check for orphaned references
  steps.forEach(step => {
    if (step.next_steps) {
      step.next_steps.forEach(nextStepId => {
        if (!stepIds.has(nextStepId)) {
          errors.push(`${step.step_id} references non-existent step: ${nextStepId}`);
        }
      });
    }
    
    if (step.decide_config?.outcomes) {
      step.decide_config.outcomes.forEach(outcome => {
        if (outcome.next_step_id && !stepIds.has(outcome.next_step_id)) {
          errors.push(`${step.step_id} outcome references non-existent step: ${outcome.next_step_id}`);
        }
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Find steps that have no incoming connections
export const findEntryPoints = (steps) => {
  const allTargets = new Set();
  
  steps.forEach(step => {
    if (step.next_steps) {
      step.next_steps.forEach(target => allTargets.add(target));
    }
    if (step.decide_config?.outcomes) {
      step.decide_config.outcomes.forEach(outcome => {
        if (outcome.next_step_id) {
          allTargets.add(outcome.next_step_id);
        }
      });
    }
  });
  
  return steps.filter(step => !allTargets.has(step.step_id));
};

// Find steps that have no outgoing connections
export const findExitPoints = (steps) => {
  return steps.filter(step => {
    if (step.step_type === 'release') return true;
    
    const hasNextSteps = step.next_steps && step.next_steps.length > 0;
    const hasOutcomes = step.decide_config?.outcomes && step.decide_config.outcomes.length > 0;
    
    return !hasNextSteps && !hasOutcomes;
  });
};

// Generate a unique step ID
export const generateStepId = (stepType, existingSteps) => {
  const existingIds = new Set(existingSteps.map(s => s.step_id));
  let counter = 1;
  let candidateId = `${stepType}_${Date.now()}`;
  
  while (existingIds.has(candidateId)) {
    candidateId = `${stepType}_${Date.now()}_${counter}`;
    counter++;
  }
  
  return candidateId;
};

// Calculate optimal layout positions
export const calculateOptimalLayout = (steps, containerWidth = 800) => {
  const positions = {};
  const stepWidth = 200;
  const stepHeight = 100;
  const horizontalSpacing = 50;
  const verticalSpacing = 50;
  
  if (steps.length === 0) return positions;
  
  // Simple grid layout for now
  const maxColumns = Math.floor((containerWidth - horizontalSpacing) / (stepWidth + horizontalSpacing));
  
  steps.forEach((step, index) => {
    const column = index % maxColumns;
    const row = Math.floor(index / maxColumns);
    
    positions[step.step_id] = {
      x: horizontalSpacing + column * (stepWidth + horizontalSpacing),
      y: horizontalSpacing + row * (stepHeight + verticalSpacing)
    };
  });
  
  return positions;
};

// Deep clone step (for safe mutations)
export const cloneStep = (step) => {
  return JSON.parse(JSON.stringify(step));
};

// Check if two steps are deeply equal (excluding position)
export const stepsEqual = (step1, step2) => {
  const clean1 = { ...step1 };
  const clean2 = { ...step2 };
  delete clean1.position;
  delete clean2.position;
  
  return JSON.stringify(clean1) === JSON.stringify(clean2);
};