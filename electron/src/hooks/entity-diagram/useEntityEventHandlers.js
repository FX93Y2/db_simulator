import { useState, useCallback } from 'react';
import yaml from 'yaml';
import { sortAttributes } from '../../components/shared/entity-nodes/EntityNode';
import { handleTableDeletion } from '../../components/shared/entity-nodes/ERDiagramConnectionHandler';

/**
 * Custom hook for handling ERDiagram events
 * Manages ReactFlow event handlers, entity modal state, and node operations
 */
export const useEntityEventHandlers = (
  updateEntityPosition,
  deleteEntity,
  updateEntity,
  dbSchema,
  setDbSchema,
  setCanonicalEntities,
  setNodes,
  setEdges,
  positions,
  onDiagramChange,
  internalUpdateRef,
  pendingInternalUpdateRef
) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);

  // Handle node movement
  const onNodeDragStop = useCallback((_event, node) => {
    // Only update the visual nodes - don't modify canonicalEntities directly
    // This prevents regenerating the entire node structure and losing unsaved changes
    setNodes(nds =>
      nds.map(n => n.id === node.id ? { ...n, position: node.position } : n)
    );
    
    // Update position through entity manager
    updateEntityPosition(node.id, node.position);
  }, [setNodes, updateEntityPosition]);

  // Handle node deletion with enhanced foreign key cleanup
  const onNodesDelete = useCallback((deletedNodes) => {
    if (dbSchema) {
      const deletedIds = deletedNodes.map(n => n.id);
      
      // Use the enhanced table deletion handler
      handleTableDeletion(
        deletedIds,
        dbSchema,
        (newSchema) => {
          // Update internal state
          setDbSchema(newSchema);
          
          // Update canonical entities to reflect the deletion and foreign key cleanup
          setCanonicalEntities(prev => {
            // Remove deleted entities and update remaining entities with cleaned foreign keys
            const updatedCanonical = prev
              .filter(entity => !deletedIds.includes(entity.name)) // Remove deleted entities
              .map(entity => {
                // Update remaining entities with cleaned foreign keys from newSchema
                const updatedEntity = newSchema.entities.find(e => e.name === entity.name);
                if (updatedEntity) {
                  return {
                    ...entity,
                    attributes: sortAttributes(updatedEntity.attributes || []) // Apply foreign key cleanup and sorting
                  };
                }
                return entity;
              });
              
            return updatedCanonical;
          });
          
          // Update visual nodes to remove deleted tables and update foreign keys immediately
          setNodes(currentNodes => {
            // First filter out deleted nodes
            const remainingNodes = currentNodes.filter(node => !deletedIds.includes(node.id));
            
            // Then update remaining nodes to reflect foreign key cleanup
            return remainingNodes.map(node => {
              const updatedEntity = newSchema.entities.find(e => e.name === node.id);
              if (updatedEntity) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    attributes: sortAttributes(updatedEntity.attributes || [])
                  }
                };
              }
              return node;
            });
          });
          
          // Remove edges connected to deleted nodes
          setEdges(currentEdges => 
            currentEdges.filter(edge => 
              !deletedIds.includes(edge.source) && !deletedIds.includes(edge.target)
            )
          );
          
          // Set flags to prevent circular update
          internalUpdateRef.current = true;
          pendingInternalUpdateRef.current = true;
          
          // Notify parent component
          if (onDiagramChange) {
            onDiagramChange(yaml.stringify(newSchema));
          }
        }
      );
      
      // Remove deleted node positions
      positions.removeItemPositions(deletedIds);
    }
  }, [dbSchema, onDiagramChange, positions, setDbSchema, setCanonicalEntities, setNodes, setEdges, internalUpdateRef, pendingInternalUpdateRef]);

  // Handle node double click
  const onNodeDoubleClick = useCallback((_event, node) => {
    setSelectedNode(node);
    setShowNodeModal(true);
  }, []);

  // Handle entity update from EntityEditor
  const handleEntityUpdate = useCallback((updatedEntity) => {
    if (selectedNode) {
      // Use the entity manager updateEntity method
      updateEntity(selectedNode.id, {
        name: updatedEntity.name,
        type: updatedEntity.type,
        rows: updatedEntity.rows,
        attributes: updatedEntity.attributes
      });
    }
  }, [selectedNode, updateEntity]);

  // Handle entity deletion from EntityEditor
  const handleEntityDelete = useCallback((_entity) => {
    if (selectedNode) {
      // Use the entity manager deleteEntity method for simple deletion
      deleteEntity(selectedNode.id);
    }
  }, [selectedNode, deleteEntity]);

  // Close modal
  const closeModal = useCallback(() => {
    setShowNodeModal(false);
  }, []);

  return {
    selectedNode,
    showNodeModal,
    setSelectedNode,
    setShowNodeModal,
    onNodeDragStop,
    onNodesDelete,
    onNodeDoubleClick,
    handleEntityUpdate,
    handleEntityDelete,
    closeModal
  };
};