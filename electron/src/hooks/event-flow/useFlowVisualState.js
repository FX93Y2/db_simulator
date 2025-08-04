import { useState, useEffect } from 'react';
import { useNodesState, useEdgesState } from 'reactflow';

/**
 * Custom hook for managing ReactFlow visual state in ModularEventFlow
 * Transforms canonical steps to visual nodes and edges
 * Handles step connection visualization
 */
export const useFlowVisualState = (canonicalSteps, theme, onDiagramChange, generateYAML, flowSchema, isInternalUpdate, resetInternalFlags) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update visual nodes and edges from canonical steps
  useEffect(() => {
    if (canonicalSteps.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Build visual nodes directly from canonical steps with their stored positions
    const visualNodes = canonicalSteps.map(step => {
      const nodeType = step.step_type === 'event' ? 'process' :
                      step.step_type === 'decide' ? 'decide' :
                      step.step_type === 'assign' ? 'assign' :
                      step.step_type === 'release' ? 'release' : 'process';
      
      // Use the position stored in the canonical step
      const position = step.position || { x: 100, y: 100 };
      
      return {
        id: step.step_id,
        type: nodeType,
        position: position,
        data: {
          label: step.step_id,
          stepConfig: step,
          theme: theme
        }
      };
    });
    
    // Build edges from canonical steps
    const visualEdges = [];
    canonicalSteps.forEach(step => {
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

    // Update visual representation
    setNodes(visualNodes);
    setEdges(visualEdges);
    
    // Notify parent of changes if this was an internal update
    if (isInternalUpdate() && onDiagramChange && flowSchema) {
      const generatedSchema = generateYAML();
      if (generatedSchema) {
        // Set a timeout to reset the flags after the parent processes the change
        setTimeout(() => {
          resetInternalFlags();
        }, 500); // Increased timeout to be more reliable
        onDiagramChange(generatedSchema);
      } else {
        resetInternalFlags();
      }
    }
  }, [canonicalSteps, theme, onDiagramChange, generateYAML, flowSchema, isInternalUpdate, resetInternalFlags]);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange
  };
};