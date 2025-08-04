import { useCallback } from 'react';
import { addEdge } from 'reactflow';
import yaml from 'yaml';
import { sortAttributes } from '../../components/shared/entity-nodes/EntityNode';
import { 
  handleTableConnection, 
  handleEdgeDeletion, 
  validateConnection 
} from '../../components/shared/entity-nodes/ERDiagramConnectionHandler';

/**
 * Custom hook for handling entity connections in ERDiagram
 * Manages foreign key generation, connection validation, and edge operations
 */
export const useEntityConnections = (
  dbSchema, 
  setDbSchema, 
  setCanonicalEntities, 
  setNodes, 
  setEdges, 
  onDiagramChange,
  internalUpdateRef,
  pendingInternalUpdateRef
) => {

  // Handle connecting nodes with automatic foreign key generation
  const onConnect = useCallback((params) => {
    // Validate connection
    if (!validateConnection(params, dbSchema)) {
      return;
    }
    
    // Use the enhanced connection handler
    const updatedSchema = handleTableConnection(
      params, 
      dbSchema, 
      (newSchema) => {
        // Update internal state
        setDbSchema(newSchema);
        
        // Set flags to prevent circular update
        internalUpdateRef.current = true;
        pendingInternalUpdateRef.current = true;
        
        // Notify parent component
        if (onDiagramChange) {
          onDiagramChange(yaml.stringify(newSchema));
        }
      }
    );
    
    if (updatedSchema) {
      // Update canonical entities to reflect the new foreign key
      setCanonicalEntities(prev => {
        return prev.map(entity => {
          if (entity.name === params.source) {
            // Find the updated entity from the schema
            const updatedEntity = updatedSchema.entities.find(e => e.name === params.source);
            if (updatedEntity) {
              return {
                ...entity,
                attributes: updatedEntity.attributes || []
              };
            }
          }
          return entity;
        });
      });

      // Update visual nodes to reflect the new foreign key immediately
      setNodes((currentNodes) => {
        return currentNodes.map(node => {
          if (node.id === params.source) {
            // Find the updated entity from the schema
            const updatedEntity = updatedSchema.entities.find(e => e.name === params.source);
            if (updatedEntity) {
              return {
                ...node,
                data: {
                  ...node.data,
                  attributes: sortAttributes(updatedEntity.attributes || [])
                }
              };
            }
          }
          return node;
        });
      });

      // Add the visual edge
      setEdges((eds) => addEdge({
        ...params,
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#3498db' },
        markerEnd: {
          type: 'arrowclosed',
          width: 20,
          height: 20,
          color: '#3498db',
        }
      }, eds));
    }
  }, [dbSchema, onDiagramChange, setEdges, setDbSchema, setCanonicalEntities, setNodes, internalUpdateRef, pendingInternalUpdateRef]);

  // Handle edge deletion with automatic foreign key removal
  const onEdgesDelete = useCallback((deletedEdges) => {
    if (dbSchema && deletedEdges.length > 0) {
      handleEdgeDeletion(
        deletedEdges,
        dbSchema,
        (newSchema) => {
          // Update internal state
          setDbSchema(newSchema);
          
          // Update visual nodes to reflect foreign key removal immediately
          setNodes((currentNodes) => {
            return currentNodes.map(node => {
              // Check if this node was affected by the edge deletion
              const wasSourceOfDeletedEdge = deletedEdges.some(edge => edge.source === node.id);
              if (wasSourceOfDeletedEdge) {
                // Find the updated entity from the schema
                const updatedEntity = newSchema.entities.find(e => e.name === node.id);
                if (updatedEntity) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      attributes: updatedEntity.attributes || []
                    }
                  };
                }
              }
              return node;
            });
          });
          
          // Set flags to prevent circular update
          internalUpdateRef.current = true;
          pendingInternalUpdateRef.current = true;
          
          // Notify parent component
          if (onDiagramChange) {
            onDiagramChange(yaml.stringify(newSchema));
          }
        }
      );
    }
  }, [dbSchema, onDiagramChange, setDbSchema, setNodes, internalUpdateRef, pendingInternalUpdateRef]);

  return {
    onConnect,
    onEdgesDelete
  };
};