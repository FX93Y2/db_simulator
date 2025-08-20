/**
 * Enhanced connection handler for Event Flow component
 * Manages step-to-step connections with proper validation and cleanup
 */

/**
 * Validate connection before allowing it
 * @param {Object} connection - Connection parameters
 * @param {Array} canonicalSteps - Current canonical steps
 * @returns {boolean} - Whether the connection is valid
 */
export const validateConnection = (connection, canonicalSteps) => {
  // Prevent self-connections
  if (connection.source === connection.target) {
    console.warn('[EventFlowConnectionHandler] Invalid connection: self-connection not allowed');
    return false;
  }
  
  // Ensure both steps exist
  if (!canonicalSteps) {
    console.warn('[EventFlowConnectionHandler] Invalid connection: no canonical steps');
    return false;
  }
  
  const sourceExists = canonicalSteps.some(s => s.step_id === connection.source);
  const targetExists = canonicalSteps.some(s => s.step_id === connection.target);
  
  if (!sourceExists || !targetExists) {
    console.warn('[EventFlowConnectionHandler] Invalid connection: source or target step does not exist');
    return false;
  }
  
  return true;
};

/**
 * Handle step connection - add connection to canonical steps state
 * @param {Object} params - Connection parameters from ReactFlow
 * @param {Array} canonicalSteps - Current canonical steps
 * @param {Function} onStepsUpdate - Callback to update canonical steps
 * @returns {Array} - Updated canonical steps or null if connection failed
 */
export const handleStepConnection = (params, canonicalSteps, onStepsUpdate) => {
  console.log('[EventFlowConnectionHandler] Processing connection:', params);
  
  // Validate connection parameters
  if (!validateConnection(params, canonicalSteps)) {
    return null;
  }
  
  // Create a deep copy of the steps
  const updatedSteps = JSON.parse(JSON.stringify(canonicalSteps));
  
  // Find source step
  const sourceStep = updatedSteps.find(s => s.step_id === params.source);
  
  if (!sourceStep) {
    console.warn('[EventFlowConnectionHandler] Source step not found');
    return null;
  }
  
  if (sourceStep.step_type === 'decide') {
    // Handle decide step connections through outcomes
    const outcomeIndex = parseInt(params.sourceHandle?.replace('outcome-', '') || '0');
    
    // Ensure decide_config exists
    if (!sourceStep.decide_config) {
      sourceStep.decide_config = {
        decision_type: '2way-chance',
        outcomes: []
      };
    }
    
    // If connecting to an existing outcome, update it
    if (sourceStep.decide_config.outcomes[outcomeIndex]) {
      sourceStep.decide_config.outcomes[outcomeIndex].next_step_id = params.target;
    } else {
      // If connecting to the always-available handle (beyond existing outcomes), create a new outcome
      const newOutcome = {
        outcome_id: `outcome_${outcomeIndex + 1}`,
        next_step_id: params.target,
        conditions: [{
          if: 'Probability',
          is: '==',
          value: 0.5 // Default probability, user can edit later
        }]
      };
      
      // Add the new outcome
      sourceStep.decide_config.outcomes.push(newOutcome);
      
      // Normalize probabilities if needed (ensure they sum to 1)
      const outcomes = sourceStep.decide_config.outcomes;
      if (outcomes.length > 1) {
        const equalProbability = 1 / outcomes.length;
        outcomes.forEach(outcome => {
          if (outcome.conditions && outcome.conditions[0]) {
            outcome.conditions[0].value = equalProbability;
          }
        });
      }
    }
  } else {
    // Handle regular next_steps
    if (!sourceStep.next_steps) sourceStep.next_steps = [];
    if (!sourceStep.next_steps.includes(params.target)) {
      sourceStep.next_steps.push(params.target);
    }
  }
  
  console.log(`[EventFlowConnectionHandler] Created connection: ${params.source} -> ${params.target}`);
  
  // Update the steps through callback
  if (onStepsUpdate) {
    onStepsUpdate(updatedSteps);
  }
  
  return updatedSteps;
};

/**
 * Handle edge deletion - remove connections when edges are deleted
 * @param {Array} deletedEdges - Array of deleted edge objects
 * @param {Array} canonicalSteps - Current canonical steps
 * @param {Function} onStepsUpdate - Callback to update canonical steps
 * @returns {Array} - Updated canonical steps
 */
export const handleEdgeDeletion = (deletedEdges, canonicalSteps, onStepsUpdate) => {
  console.log('[EventFlowConnectionHandler] Processing edge deletion:', deletedEdges);
  
  if (!deletedEdges.length || !canonicalSteps) {
    return canonicalSteps;
  }
  
  const updatedSteps = JSON.parse(JSON.stringify(canonicalSteps));
  
  deletedEdges.forEach(edge => {
    const sourceStep = updatedSteps.find(s => s.step_id === edge.source);
    const targetStepId = edge.target;
    
    if (sourceStep) {
      if (sourceStep.step_type === 'decide' && sourceStep.decide_config?.outcomes) {
        // Remove outcomes that reference the target step
        sourceStep.decide_config.outcomes = sourceStep.decide_config.outcomes.filter(outcome => 
          outcome.next_step_id !== targetStepId
        );
        
        // Rebalance probabilities for remaining outcomes
        if (sourceStep.decide_config.outcomes.length > 0) {
          const equalProbability = 1 / sourceStep.decide_config.outcomes.length;
          sourceStep.decide_config.outcomes.forEach(outcome => {
            outcome.conditions.forEach(condition => {
              if (condition.if && condition.if.toLowerCase() === 'probability') {
                condition.value = equalProbability;
              }
            });
          });
        }
        
        console.log(`[EventFlowConnectionHandler] Removed decide outcome: ${edge.source} -> ${targetStepId}`);
      } else if (sourceStep.next_steps) {
        // Remove from regular next_steps
        sourceStep.next_steps = sourceStep.next_steps.filter(id => id !== targetStepId);
        console.log(`[EventFlowConnectionHandler] Removed next_step: ${edge.source} -> ${targetStepId}`);
      }
    }
  });
  
  if (onStepsUpdate) {
    onStepsUpdate(updatedSteps);
  }
  
  return updatedSteps;
};

/**
 * Handle step deletion - remove all connections that reference the deleted steps
 * @param {Array} deletedStepIds - Array of deleted step IDs
 * @param {Array} canonicalSteps - Current canonical steps
 * @param {Function} onStepsUpdate - Callback to update canonical steps
 * @returns {Array} - Updated canonical steps
 */
export const handleStepDeletion = (deletedStepIds, canonicalSteps, onStepsUpdate) => {
  console.log('[EventFlowConnectionHandler] Processing step deletion:', deletedStepIds);
  
  if (!deletedStepIds.length || !canonicalSteps) {
    return canonicalSteps;
  }
  
  // Remove the deleted steps from the array
  let updatedSteps = canonicalSteps.filter(step => !deletedStepIds.includes(step.step_id));
  
  // Remove references to deleted steps from remaining steps
  updatedSteps = updatedSteps.map(step => {
    let updatedStep = { ...step };
    
    // Clean up next_steps references
    if (step.next_steps) {
      const originalLength = step.next_steps.length;
      updatedStep.next_steps = step.next_steps.filter(id => !deletedStepIds.includes(id));
      if (updatedStep.next_steps.length !== originalLength) {
        console.log(`[EventFlowConnectionHandler] Cleaned up next_steps in ${step.step_id}`);
      }
    }
    
    // Clean up decide outcomes references
    if (step.decide_config?.outcomes) {
      const originalLength = step.decide_config.outcomes.length;
      updatedStep.decide_config = {
        ...step.decide_config,
        outcomes: step.decide_config.outcomes.filter(outcome => 
          !deletedStepIds.includes(outcome.next_step_id)
        )
      };
      
      if (updatedStep.decide_config.outcomes.length !== originalLength) {
        console.log(`[EventFlowConnectionHandler] Cleaned up decide outcomes in ${step.step_id}`);
        
        // Rebalance probabilities for remaining outcomes
        if (updatedStep.decide_config.outcomes.length > 0) {
          const equalProbability = 1 / updatedStep.decide_config.outcomes.length;
          updatedStep.decide_config.outcomes.forEach(outcome => {
            outcome.conditions.forEach(condition => {
              if (condition.if && condition.if.toLowerCase() === 'probability') {
                condition.value = equalProbability;
              }
            });
          });
        }
      }
    }
    
    return updatedStep;
  });
  
  if (onStepsUpdate) {
    onStepsUpdate(updatedSteps);
  }
  
  return updatedSteps;
};

/**
 * Get suggested connection types based on step types
 * @param {Object} sourceStep - Source step
 * @param {Object} targetStep - Target step
 * @returns {Array} - Array of suggested connection types
 */
export const getSuggestedConnectionTypes = (sourceStep, targetStep) => {
  const suggestions = [];
  
  if (!sourceStep || !targetStep) {
    return suggestions;
  }
  
  // Based on step types, suggest appropriate relationships
  if (sourceStep.step_type === 'event' && targetStep.step_type === 'decide') {
    suggestions.push({
      type: 'next_step',
      description: 'Event proceeds to decision point',
      handles: 'single'
    });
  }
  
  if (sourceStep.step_type === 'decide') {
    suggestions.push({
      type: 'outcome',
      description: 'Decision outcome leads to next step',
      handles: 'multiple'
    });
  }
  
  if (sourceStep.step_type === 'assign' && targetStep.step_type === 'event') {
    suggestions.push({
      type: 'next_step',
      description: 'Assignment followed by event',
      handles: 'single'
    });
  }
  
  if (targetStep.step_type === 'release') {
    suggestions.push({
      type: 'termination',
      description: 'Flow termination',
      handles: 'single'
    });
  }
  
  // Default next step relationship
  suggestions.push({
    type: 'next_step',
    description: 'Sequential flow step',
    handles: 'single'
  });
  
  return suggestions;
};

/**
 * Check if a connection already exists
 * @param {Object} connection - Connection to check
 * @param {Array} canonicalSteps - Current canonical steps
 * @returns {boolean} - Whether the connection already exists
 */
export const connectionExists = (connection, canonicalSteps) => {
  const sourceStep = canonicalSteps.find(s => s.step_id === connection.source);
  
  if (!sourceStep) return false;
  
  if (sourceStep.step_type === 'decide' && sourceStep.decide_config?.outcomes) {
    return sourceStep.decide_config.outcomes.some(outcome => 
      outcome.next_step_id === connection.target
    );
  } else if (sourceStep.next_steps) {
    return sourceStep.next_steps.includes(connection.target);
  }
  
  return false;
};