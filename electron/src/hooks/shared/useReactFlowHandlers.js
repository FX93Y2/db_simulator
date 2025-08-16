import React from 'react';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';

/**
 * Shared hook for ReactFlow event handling with multiselection support
 * Provides consistent behavior between ERDiagram and ModularEventFlow
 * 
 * @param {Object} config - Configuration object
 * @param {Array} config.nodes - Current nodes array
 * @param {Array} config.edges - Current edges array  
 * @param {Function} config.updateNodes - Function to update nodes array
 * @param {Function} config.updateEdges - Function to update edges array
 * @param {Function} config.updateSelected - Function to update selected items array
 * @param {Function} config.onPositionChange - Handler for position changes (optional)
 * @returns {Object} - Event handlers for ReactFlow
 */
const useReactFlowHandlers = ({
  nodes,
  edges,
  updateNodes,
  updateEdges,
  updateSelected,
  onPositionChange
}) => {
  
  /**
   * Handle ReactFlow nodes change with multiselection support
   */
  const onNodesChange = React.useCallback((changes) => {
    // Apply all changes to maintain ReactFlow state
    const currentNodes = nodes;
    const updatedNodes = applyNodeChanges(changes, currentNodes);
    updateNodes(updatedNodes);
    
    // Check if any selection changes occurred
    const hasSelectionChanges = changes.some(change => change.type === 'select');
    
    if (hasSelectionChanges) {
      // Get all currently selected nodes
      const selectedNodes = updatedNodes.filter(n => n.selected);
      
      // Update the selected items array in the store
      if (updateSelected) {
        updateSelected(selectedNodes);
      }
      
      // Update edge highlighting based on ALL selected nodes
      const currentEdges = edges;
      const updatedEdges = currentEdges.map(edge => ({
        ...edge,
        selected: selectedNodes.some(node => 
          edge.source === node.id || edge.target === node.id
        )
      }));
      updateEdges(updatedEdges);
    }
    
    // Handle position changes
    if (onPositionChange) {
      changes.forEach(change => {
        if (change.type === 'position' && change.position) {
          onPositionChange(change.id, change.position);
        }
      });
    }
  }, [nodes, edges, updateNodes, updateEdges, updateSelected, onPositionChange]);

  /**
   * Handle ReactFlow edges change
   */
  const onEdgesChange = React.useCallback((changes) => {
    // Apply edge changes to maintain ReactFlow state
    const currentEdges = edges;
    const updatedEdges = applyEdgeChanges(changes, currentEdges);
    updateEdges(updatedEdges);
  }, [edges, updateEdges]);

  return {
    onNodesChange,
    onEdgesChange
  };
};

export default useReactFlowHandlers;