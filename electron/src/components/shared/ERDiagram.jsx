import React, { useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, {
  Controls,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';

// Store imports
import {
  useEntityNodes,
  useEntityEdges,
  useCanonicalEntities,
  useSelectedEntity,
  useShowEntityModal,
  useEntityActions,
  useEntityYamlActions,
  useEntityUIActions,
  useDatabaseCurrentState,
} from '../../stores/databaseConfigStore';

import EntityNode from './entity-nodes/EntityNode';
import EntityEditor from './entity-nodes/editors/EntityEditor';

// Node types definition
const nodeTypes = {
  entity: EntityNode,
};

/**
 * Modernized ERDiagram with Zustand store integration
 * Uses centralized state management following ModularEventFlow patterns
 */
const ERDiagram = forwardRef(({ theme, projectId }, ref) => {
  const containerRef = useRef(null);
  const [initialized, setInitialized] = React.useState(false);
  
  // Store state subscriptions (selective to prevent unnecessary re-renders)
  const entityNodes = useEntityNodes(projectId);
  const entityEdges = useEntityEdges(projectId);
  const canonicalEntities = useCanonicalEntities(projectId);
  const selectedEntity = useSelectedEntity(projectId);
  const showEntityModal = useShowEntityModal(projectId);
  const currentState = useDatabaseCurrentState(projectId);

  // Store actions
  const {
    addEntity,
    updateEntity,
    deleteEntity
  } = useEntityActions(projectId);

  const {
    generateEntityYaml
  } = useEntityYamlActions(projectId);

  const {
    handleEntityClick,
    handleEdgeClick,
    handleEntityDoubleClick,
    handleEntityDragStop,
    handleEntityUpdate,
    handleEntityDelete,
    closeEntityModal,
    clearEntitySelection,
    handleEntityNodesChange,
    handleEntityEdgesChange,
    handleEntityConnect
  } = useEntityUIActions(projectId);

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);

  // Simple visual state sync - like ModularEventFlow
  useEffect(() => {
    if (currentState !== 'importing') { // Don't sync during imports
      console.log('🔄 ERDiagram: Updating visual state from canonical entities');
      // Visual state is automatically updated by the store actions
      // No need for manual sync here - just log for debugging
    }
  }, [canonicalEntities, currentState]);

  // ReactFlow event handlers
  const onNodesChange = React.useCallback((changes) => {
    handleEntityNodesChange(changes);
  }, [handleEntityNodesChange]);

  const onEdgesChange = React.useCallback((changes) => {
    handleEntityEdgesChange(changes);
  }, [handleEntityEdgesChange]);

  const onConnect = React.useCallback((connection) => {
    handleEntityConnect(connection);
  }, [handleEntityConnect]);

  const onNodeClick = React.useCallback((event, node) => {
    handleEntityClick(event, node);
  }, [handleEntityClick]);

  const onNodeDoubleClick = React.useCallback((event, node) => {
    handleEntityDoubleClick(event, node);
  }, [handleEntityDoubleClick]);

  const onNodeDragStop = React.useCallback((event, node) => {
    handleEntityDragStop(event, node);
  }, [handleEntityDragStop]);

  const onPaneClick = React.useCallback((event) => {
    // Clear selection when clicking on the canvas
    clearEntitySelection();
  }, [clearEntitySelection]);

  const onEdgeClick = React.useCallback((event, edge) => {
    handleEdgeClick(event, edge);
  }, [handleEdgeClick]);

  // Node and edge deletion callbacks removed - entities can only be deleted via explicit button clicks

  // Enhanced delete entity for use by EntityEditor (with foreign key cleanup)
  const deleteEntityWithCleanup = React.useCallback((entityId) => {
    deleteEntity(entityId);
  }, [deleteEntity]);

  // Keyboard events removed - entities can only be deleted via explicit button clicks

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    addEntity: (entityData) => addEntity(entityData, containerRef),
    updateEntity,
    deleteEntity: deleteEntityWithCleanup,
    generateYAML: generateEntityYaml,
    getCanonicalEntities: () => canonicalEntities
  }), [addEntity, updateEntity, deleteEntityWithCleanup, generateEntityYaml, canonicalEntities]);

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
            nodes={entityNodes}
            edges={entityEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            attributionPosition="bottom-right"
            nodesDraggable={true}
            elementsSelectable={true}
            nodesDeletable={false}
            edgesDeletable={false}
          >
            <Controls position="bottom-right" />
            <Background key="er-diagram-background" variant="dots" gap={12} size={1} />
          </ReactFlow>
        </>
      )}
      <EntityEditor
        show={showEntityModal}
        onHide={closeEntityModal}
        entity={selectedEntity ? (() => {
          // Get the most up-to-date entity data from canonicalEntities
          const canonicalEntity = canonicalEntities.find(e => e.name === selectedEntity.id);
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
            name: selectedEntity.id,
            type: selectedEntity.data?.tableType,
            rows: selectedEntity.data?.rows,
            attributes: selectedEntity.data?.attributes || []
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