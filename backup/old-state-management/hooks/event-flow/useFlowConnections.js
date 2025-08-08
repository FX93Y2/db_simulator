import { useCallback } from 'react';
import { addEdge } from 'reactflow';
import {
  handleStepConnection,
  handleEdgeDeletion,
  validateConnection,
  connectionExists
} from '../../components/shared/flow-nodes/EventFlowConnectionHandler';

/**
 * Custom hook for handling step connections in ModularEventFlow
 * Manages step connection generation, connection validation, and edge operations
 */
export const useFlowConnections = (
  canonicalSteps,
  setCanonicalSteps,
  setEdges,
  internalUpdateRef,
  pendingInternalUpdateRef
) => {

  // Handle connecting nodes with automatic step connection
  const onConnect = useCallback((params) => {
    // Validate connection
    if (!validateConnection(params, canonicalSteps)) {
      return;
    }
    
    // Check if connection already exists
    if (connectionExists(params, canonicalSteps)) {
      return;
    }
    
    // Add visual edge
    const newEdge = {
      ...params,
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' },
      style: { stroke: '#38a169', strokeWidth: 2 }
    };
    setEdges((eds) => addEdge(newEdge, eds));

    // Use the enhanced connection handler
    handleStepConnection(
      params, 
      canonicalSteps, 
      (newSteps) => {
        // Update canonical steps
        setCanonicalSteps(newSteps);
        
        // Set flag to prevent circular update
        internalUpdateRef.current = true;
        pendingInternalUpdateRef.current = true;
      }
    );
    
  }, [canonicalSteps, setEdges, setCanonicalSteps, internalUpdateRef, pendingInternalUpdateRef]);

  // Handle edge deletion with automatic step connection removal
  const onEdgesDelete = useCallback((deletedEdges) => {
    
    if (canonicalSteps && deletedEdges.length > 0) {
      handleEdgeDeletion(
        deletedEdges,
        canonicalSteps,
        (newSteps) => {
          // Update canonical steps
          setCanonicalSteps(newSteps);
          
          // Set flag to prevent circular update
          internalUpdateRef.current = true;
          pendingInternalUpdateRef.current = true;
        }
      );
    }
  }, [canonicalSteps, setCanonicalSteps, internalUpdateRef, pendingInternalUpdateRef]);

  return {
    onConnect,
    onEdgesDelete
  };
};