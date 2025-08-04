import { useState, useCallback, useEffect } from 'react';
import { isUserTyping } from '../../components/shared/flow-nodes/flowUtils';

/**
 * Custom hook for handling ModularEventFlow events
 * Manages ReactFlow event handlers, step modal state, and node operations
 */
export const useFlowEventHandlers = (
  updateStepPosition,
  deleteStep,
  updateStep,
  canonicalSteps,
  setCanonicalSteps,
  setNodes,
  setEdges,
  positions,
  internalUpdateRef,
  pendingInternalUpdateRef
) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Handle node movement
  const onNodeDragStop = useCallback((_event, node) => {
    // Update position in canonical steps
    setCanonicalSteps(prev => prev.map(step => 
      step.step_id === node.id 
        ? { ...step, position: node.position }
        : step
    ));
    
    // Update visual nodes
    setNodes(nds => nds.map(n => 
      n.id === node.id ? { ...n, position: node.position } : n
    ));
    
    // Update position in hook for localStorage persistence
    positions.updateItemPosition(node.id, node.position);
  }, [positions, setCanonicalSteps, setNodes]);

  // Handle node deletion with cleanup of references
  const onNodesDelete = useCallback((deletedNodes) => {
    const deletedIds = deletedNodes.map(n => n.id);
    
    // Update canonical steps - remove deleted steps and clean up references
    setCanonicalSteps(prev => {
      // Remove deleted steps
      let remainingSteps = prev.filter(step => !deletedIds.includes(step.step_id));
      
      // Clean up references in remaining steps
      remainingSteps = remainingSteps.map(step => {
        let updatedStep = { ...step };
        
        if (step.next_steps) {
          updatedStep.next_steps = step.next_steps.filter(id => !deletedIds.includes(id));
        }
        
        if (step.decide_config?.outcomes) {
          // Remove outcomes that reference deleted steps entirely
          updatedStep.decide_config = {
            ...step.decide_config,
            outcomes: step.decide_config.outcomes.filter(outcome => 
              !deletedIds.includes(outcome.next_step_id)
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
      
      return remainingSteps;
    });
    
    // Remove deleted node positions
    positions.removeItemPositions(deletedIds);
    
    // Set internal update flags
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
  }, [positions, setCanonicalSteps, internalUpdateRef, pendingInternalUpdateRef]);

  // Handle node clicks
  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  // Handle node double click
  const onNodeDoubleClick = useCallback((_event, node) => {
    setSelectedNode(node);
    setShowEditModal(true);
  }, []);

  // Handle keyboard shortcuts
  const onKeyDown = useCallback((event) => {
    // Don't handle keyboard shortcuts if user is typing in an input field
    if (isUserTyping()) {
      return; // Let the input field handle the keyboard event
    }
    
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
      onNodesDelete([selectedNode]);
      setSelectedNode(null);
    }
  }, [selectedNode, onNodesDelete]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  // Handle step update from NodeEditModal
  const handleNodeUpdate = useCallback((updatedNode) => {
    const oldNodeId = selectedNode?.id;
    const newNodeId = updatedNode.id;
    
    // Update canonical steps with new node data
    setCanonicalSteps(prev => {
      let updatedSteps = prev.map(step => {
        if (step.step_id === oldNodeId) {
          return {
            ...updatedNode.data.stepConfig,
            position: step.position // Preserve position
          };
        }
        return step;
      });
      
      // Update references to this step in other steps if ID changed
      if (oldNodeId !== newNodeId) {
        updatedSteps = updatedSteps.map(step => {
          let updatedStep = { ...step };
          
          // Update next_steps references
          if (step.next_steps) {
            updatedStep.next_steps = step.next_steps.map(id => id === oldNodeId ? newNodeId : id);
          }
          
          // Update decide outcomes references
          if (step.decide_config?.outcomes) {
            updatedStep.decide_config = {
              ...step.decide_config,
              outcomes: step.decide_config.outcomes.map(outcome => ({
                ...outcome,
                next_step_id: outcome.next_step_id === oldNodeId ? newNodeId : outcome.next_step_id
              }))
            };
          }
          
          return updatedStep;
        });
        
        // Update position mapping if step ID changed
        if (oldNodeId !== newNodeId) {
          positions.updateItemId(oldNodeId, newNodeId);
        }
      }
      
      return updatedSteps;
    });
    
    // Set internal update flags
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
  }, [selectedNode, positions, setCanonicalSteps, internalUpdateRef, pendingInternalUpdateRef]);

  // Close modal
  const closeModal = useCallback(() => {
    setShowEditModal(false);
  }, []);

  return {
    selectedNode,
    showEditModal,
    setSelectedNode,
    setShowEditModal,
    onNodeClick,
    onNodeDoubleClick,
    onNodeDragStop,
    onNodesDelete,
    handleNodeUpdate,
    closeModal
  };
};