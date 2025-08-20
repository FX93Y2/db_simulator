import React, { useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Store imports
import {
  useDatabaseConfigStore,
  useEntityNodes,
  useEntityEdges,
  useCanonicalEntities,
  useSelectedEntity,
  useSelectedEntities,
  useSelectionMode,
  useShowEntityModal,
  useEntityActions,
  useEntityYamlActions,
  useEntityUIActions,
  useDatabaseCurrentState,
  useClipboard,
  useContextMenu,
} from '../../stores/databaseConfigStore';

import EntityNode from './entity-nodes/EntityNode';
import EntityEditor from './entity-nodes/editors/EntityEditor';
import CanvasContextMenu from '../shared/CanvasContextMenu';

// Shared hooks
import useReactFlowHandlers from '../../hooks/shared/useReactFlowHandlers';
import useTextSelectionPrevention from '../../hooks/shared/useTextSelectionPrevention';
import useContextMenuLogic from '../../hooks/shared/useContextMenu';
import useViewportPersistence from '../../hooks/shared/useViewportPersistence';

// Node types definition
const nodeTypes = {
  entity: EntityNode,
};

/**
 * Inner ERDiagram component that has access to ReactFlow context
 */
const ERDiagramInner = forwardRef(({ theme, projectId }, ref) => {
  const containerRef = useRef(null);
  const [initialized, setInitialized] = React.useState(false);
  const reactFlowInstance = useReactFlow();
  
  // Store state subscriptions (selective to prevent unnecessary re-renders)
  const entityNodes = useEntityNodes(projectId);
  const entityEdges = useEntityEdges(projectId);
  const canonicalEntities = useCanonicalEntities(projectId);
  const selectedEntity = useSelectedEntity(projectId);
  const selectedEntities = useSelectedEntities(projectId);
  const selectionMode = useSelectionMode(projectId);
  const showEntityModal = useShowEntityModal(projectId);
  const currentState = useDatabaseCurrentState(projectId);
  const clipboard = useClipboard(projectId);
  const contextMenu = useContextMenu(projectId);
  
  // Store actions
  const {
    addEntity,
    updateEntity,
    deleteEntity,
    deleteEntities
  } = useEntityActions(projectId);

  const {
    generateEntityYaml
  } = useEntityYamlActions(projectId);

  const {
    updateEntityNodes,
    updateEntityEdges,
    updateSelectedEntities,
    handleEdgeClick,
    handleEntityDoubleClick,
    handleEntityDragStop,
    handleEntityUpdate,
    handleEntityDelete,
    closeEntityModal,
    clearEntitySelection,
    handleEntityConnect,
    copyEntities,
    pasteEntities,
    showContextMenu,
    hideContextMenu
  } = useEntityUIActions(projectId);

  // Use shared viewport persistence hook
  const {
    viewport,
    handleViewportMove,
    handleViewportMoveStart,
    handleViewportMoveEnd
  } = useViewportPersistence(projectId, 'database', reactFlowInstance, initialized, entityNodes);

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);
  
  // Log component re-renders (only when entities actually change)
  useEffect(() => {
  }, [entityNodes.length, canonicalEntities.length, selectedEntity?.id]);



  // Simple visual state sync - like ModularEventFlow
  useEffect(() => {
    if (currentState !== 'importing') { // Don't sync during imports
      // Visual state is automatically updated by the store actions
      // No need for manual sync here - just log for debugging
    }
  }, [canonicalEntities, currentState]);

  // Create getEdges function that gets current edges from store
  const getEntityEdges = React.useCallback(() => {
    return useDatabaseConfigStore(projectId).getState().entityEdges;
  }, [projectId]);

  // Use shared ReactFlow handlers for consistent behavior
  const { onNodesChange, onEdgesChange } = useReactFlowHandlers({
    nodes: entityNodes,
    getEdges: getEntityEdges,
    updateNodes: updateEntityNodes,
    updateEdges: updateEntityEdges,
    updateSelected: updateSelectedEntities,
    onPositionChange: (nodeId, position) => {
      handleEntityDragStop(null, { id: nodeId, position });
    }
  });

  // Enhanced text selection prevention with mouse events
  useTextSelectionPrevention(containerRef, true);

  const onConnect = React.useCallback((connection) => {
    handleEntityConnect(connection);
  }, [handleEntityConnect]);

  // Remove onNodeClick to allow ReactFlow's native multiselection
  // const onNodeClick = React.useCallback((event, node) => {
  //   handleEntityClick(event, node);
  // }, [handleEntityClick]);

  const onNodeDoubleClick = React.useCallback((event, node) => {
    handleEntityDoubleClick(event, node);
  }, [handleEntityDoubleClick]);

  const onNodeDragStop = React.useCallback((event, node) => {
    handleEntityDragStop(event, node);
  }, [handleEntityDragStop]);

  // Memoize entity prop to prevent unnecessary EntityEditor resets
  const memoizedEntity = useMemo(() => {
    if (!selectedEntity) return null;
    
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
  }, [selectedEntity, canonicalEntities]);

  // Use shared context menu hook
  const contextMenuHook = useContextMenuLogic({
    selectionMode,
    selectedItems: selectedEntities,
    clipboard,
    onCopy: copyEntities,
    onPaste: pasteEntities,
    onDelete: (entities) => {
      const entityIds = entities.map(entity => entity.id);
      deleteEntities(entityIds);
    },
    onShowContextMenu: showContextMenu,
    onHideContextMenu: hideContextMenu,
    reactFlowInstance
  });

  const onPaneClick = React.useCallback((event) => {
    // Clear selection when clicking on the canvas
    clearEntitySelection();
    contextMenuHook.onPaneClick(event);
  }, [clearEntitySelection, contextMenuHook]);

  const onEdgeClick = React.useCallback((event, edge) => {
    handleEdgeClick(event, edge);
  }, [handleEdgeClick]);

  const onConnectStart = React.useCallback((event) => {
    // Prevent default text selection during edge dragging
    event.preventDefault();
    document.body.classList.add('react-flow-connecting');
  }, []);

  const onConnectEnd = React.useCallback(() => {
    // Re-enable text selection after edge dragging
    document.body.classList.remove('react-flow-connecting');
  }, []);


  // Node and edge deletion callbacks removed - entities can only be deleted via explicit button clicks

  // Enhanced delete entity for use by EntityEditor (with foreign key cleanup)
  const deleteEntityWithCleanup = React.useCallback((entityId) => {
    deleteEntity(entityId);
  }, [deleteEntity]);

  // Note: Keyboard events and context menu logic now handled by useContextMenuLogic hook

  // Add event listener for right-clicks when nodes are selected
  React.useEffect(() => {
    if (selectionMode && selectedEntities.length > 0) {
      const handleSelectionContextMenu = (e) => {
        // Check if the click is within the diagram container
        const flowContainer = e.target.closest('.er-diagram-container');
        if (flowContainer) {
          e.preventDefault();
          e.stopPropagation();
          // Show context menu at cursor position
          showContextMenu(e.clientX, e.clientY);
        }
      };
      
      // Use capture phase to intercept before other handlers
      document.addEventListener('contextmenu', handleSelectionContextMenu, true);
      return () => {
        document.removeEventListener('contextmenu', handleSelectionContextMenu, true);
      };
    }
  }, [selectionMode, selectedEntities, showContextMenu]);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    addEntity: (entityData) => {
      // Get viewport center for positioning new entities
      const viewport = reactFlowInstance.getViewport();
      const viewportCenter = {
        x: -viewport.x + (containerRef.current?.clientWidth || 800) / 2 / viewport.zoom,
        y: -viewport.y + (containerRef.current?.clientHeight || 600) / 2 / viewport.zoom
      };
      return addEntity(entityData, containerRef, viewportCenter);
    },
    updateEntity,
    deleteEntity: deleteEntityWithCleanup,
    generateYAML: generateEntityYaml,
    getCanonicalEntities: () => canonicalEntities
  }), [addEntity, updateEntity, deleteEntityWithCleanup, generateEntityYaml, canonicalEntities, reactFlowInstance]);

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
    <div ref={containerRef} className={`er-diagram-container ${selectionMode ? 'selection-mode' : ''}`} style={{ width: '100%', height: '100%' }}>
      {initialized && (
        <>
          <ReactFlow
            nodes={entityNodes}
            edges={entityEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeDragStop={onNodeDragStop}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={contextMenuHook.onNodeContextMenu}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={contextMenuHook.onPaneContextMenu}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView={false}
            onMove={handleViewportMove}
            onMoveStart={handleViewportMoveStart}
            onMoveEnd={handleViewportMoveEnd}
            attributionPosition="bottom-right"
            nodesDraggable={true}
            elementsSelectable={true}
            multiSelectionKeyCode={selectionMode ? false : 'Shift'}
            selectionOnDrag={selectionMode}
            panOnDrag={!selectionMode}
          >
            <Controls position="bottom-right" />
            <Background key="er-diagram-background" variant="dots" gap={12} size={1} />
          </ReactFlow>
        </>
      )}
      <EntityEditor
        show={showEntityModal}
        onHide={closeEntityModal}
        entity={memoizedEntity}
        onEntityUpdate={handleEntityUpdate}
        onEntityDelete={handleEntityDelete}
        theme={theme}
      />
      <CanvasContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onCopy={contextMenuHook.handleContextCopy}
        onPaste={contextMenuHook.handleContextPaste}
        onDelete={contextMenuHook.handleContextDelete}
        hasClipboard={clipboard.length > 0}
        hasSelection={selectedEntities.length > 0}
        itemType="entity"
      />
    </div>
  );
});

ERDiagramInner.displayName = 'ERDiagramInner';

/**
 * Main ERDiagram component with ReactFlow provider
 */
const ERDiagram = forwardRef(({ theme, projectId }, ref) => {
  return (
    <ReactFlowProvider>
      <ERDiagramInner theme={theme} projectId={projectId} ref={ref} />
    </ReactFlowProvider>
  );
});

ERDiagram.displayName = 'ERDiagram';

export default ERDiagram;