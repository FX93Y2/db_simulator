import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, {
  Controls,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import { useCanvasPositions } from '../../hooks/shared/useCanvasPositions';
import { useEntityManager } from '../../hooks/entity-diagram/useEntityManager';
import { useEntityYamlProcessor } from '../../hooks/entity-diagram/useEntityYamlProcessor';
import { useEntityVisualState } from '../../hooks/entity-diagram/useEntityVisualState';
import { useEntityConnections } from '../../hooks/entity-diagram/useEntityConnections';
import { useEntityEventHandlers } from '../../hooks/entity-diagram/useEntityEventHandlers';
import EntityNode from './entity-nodes/EntityNode';
import EntityEditor from './entity-nodes/editors/EntityEditor';
import { handleTableDeletion } from './entity-nodes/ERDiagramConnectionHandler';
import yaml from 'yaml';

// Node types definition
const nodeTypes = {
  entity: EntityNode,
};

const ERDiagram = forwardRef(({ yamlContent, onDiagramChange, theme, projectId }, ref) => {
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  
  // Position management
  const positions = useCanvasPositions(yamlContent, 'er_diagram_positions', projectId);
  
  // Entity state management
  const entityManager = useEntityManager(positions);
  const {
    canonicalEntities,
    setCanonicalEntities,
    addEntity,
    updateEntity,
    deleteEntity,
    updateEntityPosition,
    internalUpdateRef,
    pendingInternalUpdateRef,
    resetInternalFlags,
    isInternalUpdate
  } = entityManager;

  // YAML processing
  const { generateYAML, handleYAMLChange } = useEntityYamlProcessor(
    canonicalEntities, 
    positions, 
    setCanonicalEntities
  );

  // Visual state management
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    dbSchema,
    setDbSchema
  } = useEntityVisualState(
    canonicalEntities,
    onDiagramChange,
    generateYAML,
    isInternalUpdate,
    resetInternalFlags,
    projectId
  );

  // Connection handling
  const { onConnect, onEdgesDelete } = useEntityConnections(
    dbSchema,
    setDbSchema,
    setCanonicalEntities,
    setNodes,
    setEdges,
    onDiagramChange,
    internalUpdateRef,
    pendingInternalUpdateRef
  );

  // Event handling
  const {
    selectedNode,
    showNodeModal,
    onNodeDragStop,
    onNodesDelete,
    onNodeDoubleClick,
    handleEntityUpdate,
    handleEntityDelete,
    closeModal
  } = useEntityEventHandlers(
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
  );

  // Enhanced delete entity for use by EntityEditor (with foreign key cleanup)
  const deleteEntityWithCleanup = (entityId) => {
    if (dbSchema) {
      handleTableDeletion(
        [entityId], // Array of deleted table names
        dbSchema,
        (newSchema) => {
          // Update internal state
          setDbSchema(newSchema);
          
          // Update canonical entities to reflect the deletion and foreign key cleanup
          setCanonicalEntities(prev => {
            // Remove deleted entity and update remaining entities with cleaned foreign keys
            const updatedCanonical = prev
              .filter(entity => entity.name !== entityId) // Remove deleted entity
              .map(entity => {
                // Update remaining entities with cleaned foreign keys from newSchema
                const updatedEntity = newSchema.entities.find(e => e.name === entity.name);
                if (updatedEntity) {
                  return {
                    ...entity,
                    attributes: updatedEntity.attributes || []
                  };
                }
                return entity;
              });
              
            return updatedCanonical;
          });
          
          // Set internal update flags to notify parent of changes
          internalUpdateRef.current = true;
          pendingInternalUpdateRef.current = true;
          
          // Notify parent component
          if (onDiagramChange) {
            onDiagramChange(yaml.stringify(newSchema));
          }
        }
      );
    } else {
      // Fallback: simple deletion without foreign key cleanup if dbSchema not available
      deleteEntity(entityId);
    }
    
    // Remove position
    positions.removeItemPositions([entityId]);
  };

  // Update current nodes in position hook
  useEffect(() => {
    positions.updateCurrentNodes(nodes);
  }, [nodes, positions]);

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);

  // Handle external YAML updates
  useEffect(() => {
    // Skip if this was triggered by internal changes
    if (isInternalUpdate()) {
      return;
    }
    
    // Skip if no YAML content
    if (!yamlContent) {
      return;
    }
    
    // Wait for position storage to be ready
    if (!positions.isStorageReady()) {
      return;
    }
    
    // Wait for layoutMap to be ready from localStorage
    if (!positions.layoutMapReady) {
      return;
    }
    
    handleYAMLChange(yamlContent);
  }, [yamlContent, positions.layoutMapReady, handleYAMLChange, isInternalUpdate]);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    addEntity: (entityData) => addEntity(entityData, containerRef),
    updateEntity,
    deleteEntity: deleteEntityWithCleanup,
    generateYAML,
    handleYAMLChange,
    getCanonicalEntities: () => canonicalEntities
  }), [addEntity, updateEntity, deleteEntityWithCleanup, generateYAML, handleYAMLChange, canonicalEntities]);

  // If not initialized, just show the container to get dimensions
  if (!initialized) {
    return (
      <div 
        ref={containerRef} 
        className="er-diagram-container" 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: '4px',
          overflow: 'hidden'
        }} 
      />
    );
  }
  
  return (
    <div ref={containerRef} className="er-diagram-container" style={{ width: '100%', height: '100%' }}>
      {initialized && (
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            attributionPosition="bottom-right"
            nodesDraggable={true}
            elementsSelectable={true}
          >
            <Controls position="bottom-right" />
            <Background key="er-diagram-background" variant="dots" gap={12} size={1} />
          </ReactFlow>
        </>
      )}
      <EntityEditor
        show={showNodeModal}
        onHide={closeModal}
        entity={selectedNode ? (() => {
          // Get the most up-to-date entity data from canonicalEntities
          const canonicalEntity = canonicalEntities.find(e => e.name === selectedNode.id);
          if (canonicalEntity) {
            return {
              name: canonicalEntity.name,
              type: canonicalEntity.type,
              rows: canonicalEntity.rows,
              attributes: canonicalEntity.attributes || []
            };
          }
          // Fallback to visual node data if not found in canonical entities
          return {
            name: selectedNode.id,
            type: selectedNode.data?.tableType,
            rows: selectedNode.data?.rows,
            attributes: selectedNode.data?.attributes || []
          };
        })() : null}
        onEntityUpdate={handleEntityUpdate}
        onEntityDelete={handleEntityDelete}
        theme={theme}
      />
    </div>
  );
});

ERDiagram.displayName = 'ERDiagram';

export default ERDiagram;