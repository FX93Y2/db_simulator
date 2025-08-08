/**
 * Canvas-related actions for the simulation config store
 * Handles ReactFlow nodes, edges, positioning, and visual state
 */
export const createCanvasActions = (set, get) => ({
  /**
   * Update ReactFlow nodes
   * @param {Array} nodes - New nodes array
   */
  updateNodes: (nodes) => {
    console.log('[CanvasActions] Updating nodes:', nodes.length);
    
    set((state) => {
      state.nodes = nodes;
    });
  },

  /**
   * Update ReactFlow edges
   * @param {Array} edges - New edges array
   */
  updateEdges: (edges) => {
    console.log('[CanvasActions] Updating edges:', edges.length);
    
    set((state) => {
      state.edges = edges;
    });
  },

  /**
   * Update a specific node's position
   * @param {string} nodeId - Node ID to update
   * @param {Object} position - New position {x, y}
   */
  updateNodePosition: (nodeId, position) => {
    console.log('[CanvasActions] Updating node position:', nodeId, position);
    
    set((state) => {
      // Update in nodes array
      const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex >= 0) {
        state.nodes[nodeIndex].position = position;
      }
      
      // Update in canonical steps
      const stepIndex = state.canonicalSteps.findIndex(s => s.step_id === nodeId);
      if (stepIndex >= 0) {
        state.canonicalSteps[stepIndex].position = position;
      }
      
      // Update in positions map
      state.positions.set(nodeId, position);
    });
    
    // Trigger YAML regeneration
    get().syncCanvasToYaml();
  },

  /**
   * Delete nodes and clean up references
   * @param {Array} nodeIds - Array of node IDs to delete
   */
  deleteNodes: (nodeIds) => {
    console.log('[CanvasActions] Deleting nodes:', nodeIds);
    
    set((state) => {
      // Remove from nodes array
      state.nodes = state.nodes.filter(n => !nodeIds.includes(n.id));
      
      // Remove from edges array
      state.edges = state.edges.filter(e => 
        !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
      );
      
      // Remove from canonical steps and clean up references
      let remainingSteps = state.canonicalSteps.filter(
        step => !nodeIds.includes(step.step_id)
      );
      
      // Clean up references in remaining steps
      remainingSteps = remainingSteps.map(step => {
        let updatedStep = { ...step };
        
        // Clean up next_steps references
        if (step.next_steps) {
          updatedStep.next_steps = step.next_steps.filter(id => !nodeIds.includes(id));
        }
        
        // Clean up decide_config outcome references
        if (step.decide_config?.outcomes) {
          updatedStep.decide_config = {
            ...step.decide_config,
            outcomes: step.decide_config.outcomes.filter(outcome => 
              !nodeIds.includes(outcome.next_step_id)
            )
          };
          
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
        
        return updatedStep;
      });
      
      state.canonicalSteps = remainingSteps;
      
      // Remove from positions map
      nodeIds.forEach(id => state.positions.delete(id));
      
      // Clear selection if deleted
      if (state.selectedNode && nodeIds.includes(state.selectedNode.id)) {
        state.selectedNode = null;
      }
    });
    
    // Trigger YAML regeneration
    get().syncCanvasToYaml();
  },

  /**
   * Add a new node to the canvas
   * @param {Object} stepData - Step configuration data
   * @param {Object} position - Position {x, y}
   */
  addNode: (stepData, position = { x: 100, y: 100 }) => {
    console.log('[CanvasActions] Adding node:', stepData.step_id);
    
    set((state) => {
      // Add to canonical steps
      const newStep = {
        ...stepData,
        position
      };
      state.canonicalSteps.push(newStep);
      
      // Add position to map
      state.positions.set(stepData.step_id, position);
    });
    
    // Update visual state and sync to YAML
    get().updateVisualState();
    get().syncCanvasToYaml();
  },

  /**
   * Update a step's configuration
   * @param {string} stepId - Step ID to update
   * @param {Object} newData - New step data
   */
  updateStep: (stepId, newData) => {
    console.log('[CanvasActions] Updating step:', stepId);
    
    const isIdChanging = newData.step_id && newData.step_id !== stepId;
    
    set((state) => {
      const stepIndex = state.canonicalSteps.findIndex(s => s.step_id === stepId);
      if (stepIndex >= 0) {
        // Preserve position when updating
        const position = state.canonicalSteps[stepIndex].position;
        state.canonicalSteps[stepIndex] = {
          ...newData,
          position
        };
        
        // If step ID is changing, update references in other steps
        if (isIdChanging) {
          state.canonicalSteps.forEach((step, index) => {
            if (index === stepIndex) return; // Skip the step being updated
            
            let needsUpdate = false;
            let updatedStep = { ...step };
            
            // Update next_steps references
            if (step.next_steps) {
              const updatedNextSteps = step.next_steps.map(id => id === stepId ? newData.step_id : id);
              if (JSON.stringify(updatedNextSteps) !== JSON.stringify(step.next_steps)) {
                updatedStep.next_steps = updatedNextSteps;
                needsUpdate = true;
              }
            }
            
            // Update decide outcomes references
            if (step.decide_config?.outcomes) {
              const updatedOutcomes = step.decide_config.outcomes.map(outcome => ({
                ...outcome,
                next_step_id: outcome.next_step_id === stepId ? newData.step_id : outcome.next_step_id
              }));
              
              if (JSON.stringify(updatedOutcomes) !== JSON.stringify(step.decide_config.outcomes)) {
                updatedStep.decide_config = {
                  ...step.decide_config,
                  outcomes: updatedOutcomes
                };
                needsUpdate = true;
              }
            }
            
            if (needsUpdate) {
              state.canonicalSteps[index] = updatedStep;
            }
          });
          
          // Update position mapping
          if (state.positions.has(stepId)) {
            const position = state.positions.get(stepId);
            state.positions.delete(stepId);
            state.positions.set(newData.step_id, position);
          }
        }
      }
    });
    
    // Update visual state and sync to YAML
    get().updateVisualState();
    get().syncCanvasToYaml();
  },

  /**
   * Update visual state from canonical steps
   * Transforms canonical steps into ReactFlow nodes and edges
   */
  updateVisualState: () => {
    console.log('[CanvasActions] Updating visual state from canonical steps');
    
    set((state) => {
      if (state.canonicalSteps.length === 0) {
        state.nodes = [];
        state.edges = [];
        return;
      }

      // Build visual nodes from canonical steps
      const visualNodes = state.canonicalSteps.map((step, index) => {
        const nodeType = step.step_type === 'event' ? 'process' :
                        step.step_type === 'decide' ? 'decide' :
                        step.step_type === 'assign' ? 'assign' :
                        step.step_type === 'release' ? 'release' : 'process';
        
        // If step doesn't have a position, calculate one based on index
        let position = step.position;
        if (!position) {
          position = {
            x: 100 + (index % 3) * 300, // Spread horizontally
            y: 100 + Math.floor(index / 3) * 200 // Stack vertically
          };
          
          // Update the step with calculated position within Immer context
          step.position = position;
          
          // Update positions map
          state.positions.set(step.step_id, position);
        }
        
        return {
          id: step.step_id,
          type: nodeType,
          position: position,
          data: {
            label: step.step_id,
            stepConfig: step,
            theme: state.theme
          }
        };
      });
    
      // Build edges from canonical steps
      const visualEdges = [];
      state.canonicalSteps.forEach(step => {
        if (step.step_type === 'decide' && step.decide_config?.outcomes) {
          step.decide_config.outcomes.forEach((outcome, index) => {
            if (outcome.next_step_id) {
              visualEdges.push({
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
          step.next_steps.forEach(nextStepId => {
            visualEdges.push({
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

      // Update visual state
      state.nodes = visualNodes;
      state.edges = visualEdges;
    });
  },

  /**
   * Sync canvas state to YAML
   * Only called when canvas is the source of truth
   */
  syncCanvasToYaml: () => {
    if (get().currentState === 'importing') {
      console.log('[CanvasActions] Skipping canvas->YAML sync during import');
      return;
    }
    
    console.log('[CanvasActions] Syncing canvas to YAML');
    
    const generatedYaml = get().generateYaml();
    
    set((state) => {
      state.yamlContent = generatedYaml;
    });
  },

  /**
   * Connect two nodes with an edge
   * @param {Object} connection - ReactFlow connection object
   */
  connectNodes: (connection) => {
    console.log('[CanvasActions] Connecting nodes:', connection);
    
    const { source, target, sourceHandle } = connection;
    
    set((state) => {
      const sourceStepIndex = state.canonicalSteps.findIndex(s => s.step_id === source);
      
      if (sourceStepIndex >= 0) {
        const sourceStep = state.canonicalSteps[sourceStepIndex];
        
        if (sourceStep.step_type === 'decide' && sourceHandle) {
          // Handle decide module connections through outcomes
          const outcomeIndex = parseInt(sourceHandle.replace('outcome-', ''));
          if (sourceStep.decide_config?.outcomes?.[outcomeIndex]) {
            state.canonicalSteps[sourceStepIndex].decide_config.outcomes[outcomeIndex].next_step_id = target;
          }
        } else {
          // Handle regular next_steps connections
          if (!sourceStep.next_steps) {
            state.canonicalSteps[sourceStepIndex].next_steps = [];
          }
          
          if (!sourceStep.next_steps.includes(target)) {
            state.canonicalSteps[sourceStepIndex].next_steps.push(target);
          }
        }
      }
    });
    
    // Update visual state and sync to YAML
    get().updateVisualState();
    get().syncCanvasToYaml();
  }
});