import React, { useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
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
  useCanvasActions,
  useUIActions
} from '../../stores/simulationConfigStore';

// Shared hooks (keep these)
import useResourceDefinitions from '../../hooks/shared/useResourceDefinitions';
import useEntityTables from '../../hooks/shared/useEntityTables';

// Components
import { nodeTypes } from './flow-nodes/FlowNodeComponents';
import NodeEditModal from './flow-nodes/NodeEditModal';

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
    handleNodeClick, 
    handleNodeDoubleClick, 
    handlePaneClick,
    setSelectedNode,
    handleKeyboard
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

  // ReactFlow event handlers
  const onNodesChange = React.useCallback((changes) => {
    // Apply all changes to maintain ReactFlow state (following ER Diagram approach)
    const currentNodes = nodes;
    const updatedNodes = applyNodeChanges(changes, currentNodes);
    updateNodes(updatedNodes);
    
    // Handle selection changes to maintain edge highlighting
    changes.forEach(change => {
      if (change.type === 'select') {
        if (change.selected) {
          // Find the selected node and highlight its connected edges
          const selectedNode = updatedNodes.find(n => n.id === change.id);
          if (selectedNode) {
            const currentEdges = edges;
            const updatedEdges = currentEdges.map(edge => ({
              ...edge,
              selected: edge.source === selectedNode.id || edge.target === selectedNode.id
            }));
            updateEdges(updatedEdges);
          }
        } else {
          // Node deselected - check if any nodes are still selected
          const hasSelectedNodes = updatedNodes.some(n => n.selected);
          if (!hasSelectedNodes) {
            // No nodes selected, clear all edge highlighting
            const currentEdges = edges;
            const updatedEdges = currentEdges.map(edge => ({
              ...edge,
              selected: false
            }));
            updateEdges(updatedEdges);
          }
        }
      } else if (change.type === 'position' && change.position) {
        updateNodePosition(change.id, change.position);
      }
    });
  }, [updateNodePosition, updateNodes, updateEdges, nodes, edges]);

  const onEdgesChange = React.useCallback((changes) => {
    // Apply edge changes to maintain ReactFlow state (following ER Diagram approach)
    const currentEdges = edges;
    const updatedEdges = applyEdgeChanges(changes, currentEdges);
    updateEdges(updatedEdges);
  }, [updateEdges, edges]);

  const onConnect = React.useCallback((connection) => {
    console.log('🔗 ModularEventFlow: Connecting nodes:', connection);
    connectNodes(connection);
  }, [connectNodes]);

  const onNodeClick = React.useCallback((event, node) => {
    handleNodeClick(event, node);
  }, [handleNodeClick]);

  const onNodeDoubleClick = React.useCallback((event, node) => {
    handleNodeDoubleClick(event, node);
  }, [handleNodeDoubleClick]);

  const onNodeDragStop = React.useCallback((event, node) => {
    // Position updates are already handled by onNodesChange, but let's keep this as backup
    updateNodePosition(node.id, node.position);
  }, [updateNodePosition]);

  const onNodesDelete = React.useCallback((deletedNodes) => {
    const deletedIds = deletedNodes.map(n => n.id);
    console.log('🗑️ ModularEventFlow: Deleting nodes:', deletedIds);
    deleteNodes(deletedIds);
  }, [deleteNodes]);

  const onEdgesDelete = React.useCallback((deletedEdges) => {
    console.log('🗑️ ModularEventFlow: Deleting edges:', deletedEdges);
    // Edge deletion handled by node deletion cleanup
  }, []);

  const onConnectStart = React.useCallback((event, { nodeId, handleType }) => {
    // Prevent default text selection during edge dragging
    event.preventDefault();
    document.body.classList.add('react-flow-connecting');
  }, []);

  const onConnectEnd = React.useCallback((event) => {
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

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (event) => {
      handleKeyboard(event);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyboard]);

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
    <div ref={containerRef} className="modular-event-flow event-flow-container" style={{ width: '100%', height: '100%' }}>
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
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={handlePaneClick}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            attributionPosition="bottom-right"
            nodesDraggable={true}
            elementsSelectable={true}
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