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
  useSimulationConfigStore,
  useNodes,
  useEdges,
  useCanonicalSteps,
  useCurrentState,
  useSelectedNodes,
  useSimulationSelectionMode,
  useCanvasActions,
  useUIActions,
  useSimulationClipboard,
  useSimulationContextMenu
} from '../../stores/simulationConfigStore';

// Shared hooks (keep these)
import useResourceDefinitions from '../../hooks/shared/useResourceDefinitions';
import useEntityTables from '../../hooks/shared/useEntityTables';
import useReactFlowHandlers from '../../hooks/shared/useReactFlowHandlers';
import useTextSelectionPrevention from '../../hooks/shared/useTextSelectionPrevention';
import useContextMenuLogic from '../../hooks/shared/useContextMenu';

// Components
import { nodeTypes } from './flow-nodes/FlowNodeComponents';
import NodeEditModal from './flow-nodes/NodeEditModal';
import CanvasContextMenu from '../shared/CanvasContextMenu';

/**
 * Inner ModularEventFlow component that has access to ReactFlow context
 */
const ModularEventFlowInner = forwardRef(({ theme, dbConfigContent, projectId }, ref) => {
  const [initialized, setInitialized] = React.useState(false);
  const containerRef = useRef(null);
  const reactFlowInstance = useReactFlow();
  
  // Store state subscriptions (selective to prevent unnecessary re-renders)
  const nodes = useNodes(projectId);
  const edges = useEdges(projectId);
  const canonicalSteps = useCanonicalSteps(projectId);
  const currentState = useCurrentState(projectId);
  const selectedNodes = useSelectedNodes(projectId);
  const selectionMode = useSimulationSelectionMode(projectId);
  const clipboard = useSimulationClipboard(projectId);
  const contextMenu = useSimulationContextMenu(projectId);

  // Store actions
  const { 
    updateNodePosition, 
    updateNodes,
    updateEdges,
    deleteNodes, 
    updateStep, 
    connectNodes, 
    updateVisualState,
    addNode
  } = useCanvasActions(projectId);
  
  const { 
    handleNodeDoubleClick, 
    updateSelectedNodes,
    clearSelection,
    copyNodes,
    pasteNodes,
    showContextMenu,
    hideContextMenu
  } = useUIActions(projectId);
  
  // Use the custom hook to get resource definitions from database config
  const resourceDefinitions = useResourceDefinitions(dbConfigContent);
  
  // Use the custom hook to get entity tables from database config
  const entityTables = useEntityTables(dbConfigContent);

  // Get project-specific store state when needed (non-reactive)
  const getStoreState = () => useSimulationConfigStore(projectId).getState();

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);

  // Position management is now handled directly by the store

  // Sync canonical steps to visual representation when they change
  useEffect(() => {
    if (currentState !== 'importing') { // Don't sync during imports
      console.log('🔄 ModularEventFlow: Updating visual state from canonical steps');
      updateVisualState();
    }
  }, [canonicalSteps, currentState]);

  // Use shared ReactFlow handlers for consistent behavior
  const { onNodesChange, onEdgesChange } = useReactFlowHandlers({
    nodes,
    edges,
    updateNodes,
    updateEdges,
    updateSelected: updateSelectedNodes,
    onPositionChange: updateNodePosition
  });


  // Enhanced text selection prevention with mouse events
  useTextSelectionPrevention(containerRef, true);

  // Use shared context menu hook
  const contextMenuHook = useContextMenuLogic({
    selectionMode,
    selectedItems: selectedNodes,
    clipboard,
    onCopy: copyNodes,
    onPaste: pasteNodes,
    onDelete: (nodes) => {
      const nodeIds = nodes.map(node => node.id);
      deleteNodes(nodeIds);
    },
    onShowContextMenu: showContextMenu,
    onHideContextMenu: hideContextMenu,
    reactFlowInstance
  });

  const onConnect = React.useCallback((connection) => {
    console.log('🔗 ModularEventFlow: Connecting nodes:', connection);
    connectNodes(connection);
  }, [connectNodes]);


  const onNodeDoubleClick = React.useCallback((_, node) => {
    handleNodeDoubleClick(_, node);
  }, [handleNodeDoubleClick]);

  const onNodeDragStop = React.useCallback((_, node) => {
    // Position updates are already handled by onNodesChange, but let's keep this as backup
    updateNodePosition(node.id, node.position);
  }, [updateNodePosition]);

  const onNodesDelete = React.useCallback((deletedNodes) => {
    const deletedIds = deletedNodes.map(n => n.id);
    deleteNodes(deletedIds);
  }, [deleteNodes]);

  const onEdgesDelete = React.useCallback(() => {
    // Edge deletion handled by node deletion cleanup
  }, []);

  const onConnectStart = React.useCallback((event) => {
    // Prevent default text selection during edge dragging
    event.preventDefault();
    document.body.classList.add('react-flow-connecting');
  }, []);

  const onConnectEnd = React.useCallback(() => {
    // Re-enable text selection after edge dragging
    document.body.classList.remove('react-flow-connecting');
  }, []);


  // Handle node updates from modal
  const handleNodeUpdate = React.useCallback((updatedNode) => {
    const { selectedNode } = getStoreState();
    if (!selectedNode) return;

    console.log('✏️ ModularEventFlow: Updating node:', selectedNode.id, '->', updatedNode.id);
    
    updateStep(selectedNode.id, {
      ...updatedNode.data.stepConfig,
      step_id: updatedNode.id
    });
  }, [updateStep, getStoreState]);

  // Close modal handler
  const closeModal = React.useCallback(() => {
    const state = getStoreState();
    state.setShowEditModal(false);
  }, [getStoreState]);

  // Note: Keyboard event handling now done by useContextMenuLogic hook

  // Add event listener for right-clicks when nodes are selected
  React.useEffect(() => {
    if (selectionMode && selectedNodes.length > 0) {
      const handleSelectionContextMenu = (e) => {
        // Check if the click is within the flow container
        const flowContainer = e.target.closest('.modular-event-flow');
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
  }, [selectionMode, selectedNodes, showContextMenu]);

  // Imperative methods for parent components (if needed)
  const imperativeMethods = useMemo(() => ({
    addStep: (stepData) => {
      // Get viewport center for positioning new steps
      const viewport = reactFlowInstance.getViewport();
      const position = containerRef.current 
        ? {
            x: -viewport.x + (containerRef.current.clientWidth || 800) / 2 / viewport.zoom - 100,
            y: -viewport.y + (containerRef.current.clientHeight || 600) / 2 / viewport.zoom - 50
          }
        : { x: 100, y: 100 };
      
      addNode(stepData, position);
    },
    updateStep,
    deleteStep: (stepId) => deleteNodes([stepId]),
    getCanonicalSteps: () => getStoreState().canonicalSteps
  }), [addNode, updateStep, deleteNodes, getStoreState, reactFlowInstance]);
  
  // Expose methods to parent components
  useImperativeHandle(ref, () => imperativeMethods, [imperativeMethods]);

  // If not initialized, just show the container to get dimensions
  if (!initialized) {
    return (
      <div 
        ref={containerRef} 
        className="modular-event-flow event-flow-container" 
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
    <div ref={containerRef} className={`modular-event-flow event-flow-container ${selectionMode ? 'selection-mode' : ''}`} style={{ width: '100%', height: '100%' }}>
      {initialized && (
        <div id="modular-event-flow-wrapper" style={{ width: '100%', height: '100%' }}>
          <ReactFlow
            id="modular-event-flow-instance" 
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDragStop={onNodeDragStop}
            onNodeContextMenu={contextMenuHook.onNodeContextMenu}
            onPaneClick={(event) => {
              clearSelection();
              contextMenuHook.onPaneClick(event);
            }}
            onPaneContextMenu={contextMenuHook.onPaneContextMenu}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            attributionPosition="bottom-right"
            nodesDraggable={true}
            elementsSelectable={true}
            multiSelectionKeyCode={selectionMode ? false : 'Shift'}
            selectionOnDrag={selectionMode}
            panOnDrag={!selectionMode}
            deleteKeyCode={null}
          >
            <Background 
              key="modular-event-flow-background"
              variant="dots" 
              gap={12} 
              size={1}
            />
            <Controls position="bottom-right" />
          </ReactFlow>
        </div>
      )}

      <NodeEditModal
        show={getStoreState().showEditModal}
        onHide={closeModal}
        node={getStoreState().selectedNode}
        onNodeUpdate={handleNodeUpdate}
        onNodeDelete={onNodesDelete}
        theme={theme}
        parsedSchema={getStoreState().parsedSchema}
        resourceDefinitions={resourceDefinitions}
        entityTables={entityTables}
      />
      <CanvasContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onCopy={contextMenuHook.handleContextCopy}
        onPaste={contextMenuHook.handleContextPaste}
        onDelete={contextMenuHook.handleContextDelete}
        hasClipboard={clipboard.length > 0}
        hasSelection={selectedNodes.length > 0}
        itemType="node"
      />
    </div>
  );
});

ModularEventFlowInner.displayName = 'ModularEventFlowInner';

/**
 * Main ModularEventFlow component with ReactFlow provider
 */
const ModularEventFlow = forwardRef(({ theme, dbConfigContent, projectId }, ref) => {
  return (
    <ReactFlowProvider>
      <ModularEventFlowInner theme={theme} dbConfigContent={dbConfigContent} projectId={projectId} ref={ref} />
    </ReactFlowProvider>
  );
});

ModularEventFlow.displayName = 'ModularEventFlow';

export default ModularEventFlow;