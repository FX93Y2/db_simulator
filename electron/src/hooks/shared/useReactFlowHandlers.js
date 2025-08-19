import React from 'react';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';

/**
 * Shared hook for ReactFlow event handling with multiselection support
 * Provides consistent behavior between ERDiagram and ModularEventFlow
 * 
 * @param {Object} config - Configuration object
 * @param {Array} config.nodes - Current nodes array
 * @param {Function} config.getEdges - Function to get current edges array
 * @param {Function} config.updateNodes - Function to update nodes array
 * @param {Function} config.updateEdges - Function to update edges array
 * @param {Function} config.updateSelected - Function to update selected items array
 * @param {Function} config.onPositionChange - Handler for position changes (optional)
 * @returns {Object} - Event handlers for ReactFlow
 */
const useReactFlowHandlers = ({
  nodes,
  getEdges,
  updateNodes,
  updateEdges,
  updateSelected,
  onPositionChange
}) => {
  // Use a ref to debounce edge updates
  const edgeUpdateTimeoutRef = React.useRef(null);
  
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
      
      // Clear any pending edge update
      if (edgeUpdateTimeoutRef.current) {
        clearTimeout(edgeUpdateTimeoutRef.current);
      }
      
      // Debounce edge updates to prevent rapid multiple updates
      edgeUpdateTimeoutRef.current = setTimeout(() => {
        // Get current edges using the function to avoid stale closure
        const currentEdges = getEdges();
        
        // Update edge highlighting based on ALL selected nodes
        // Use current edges from getEdges to ensure we have the latest state
        const updatedEdges = currentEdges.map(edge => {
          const shouldBeSelected = selectedNodes.some(node => 
            edge.source === node.id || edge.target === node.id
          );
          
          return {
            ...edge,
            selected: shouldBeSelected
          };
        });
        
        updateEdges(updatedEdges);
        edgeUpdateTimeoutRef.current = null;
      }, 10); // Small debounce to batch rapid updates
    }
    
    // Handle position changes
    if (onPositionChange) {
      changes.forEach(change => {
        if (change.type === 'position' && change.position) {
          onPositionChange(change.id, change.position);
        }
      });
    }
  }, [nodes, getEdges, updateNodes, updateEdges, updateSelected, onPositionChange]);

  /**
   * Handle ReactFlow edges change
   */
  const onEdgesChange = React.useCallback((changes) => {
    // Apply edge changes to maintain ReactFlow state
    const currentEdges = getEdges();
    const updatedEdges = applyEdgeChanges(changes, currentEdges);
    updateEdges(updatedEdges);
  }, [getEdges, updateEdges]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (edgeUpdateTimeoutRef.current) {
        clearTimeout(edgeUpdateTimeoutRef.current);
      }
    };
  }, []);

  return {
    onNodesChange,
    onEdgesChange
  };
};

export default useReactFlowHandlers;