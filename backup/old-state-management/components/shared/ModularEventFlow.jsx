import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import useResourceDefinitions from '../../hooks/shared/useResourceDefinitions';
import { useCanvasPositions } from '../../hooks/shared/useCanvasPositions';
import { useStepManager } from '../../hooks/event-flow/useStepManager';
import { useFlowYamlProcessor } from '../../hooks/event-flow/useFlowYamlProcessor';
import { useFlowVisualState } from '../../hooks/event-flow/useFlowVisualState';
import { useFlowEventHandlers } from '../../hooks/event-flow/useFlowEventHandlers';
import { useFlowConnections } from '../../hooks/event-flow/useFlowConnections';
import { nodeTypes } from './flow-nodes/FlowNodeComponents';
import NodeEditModal from './flow-nodes/NodeEditModal';

const ModularEventFlow = forwardRef(({ yamlContent, parsedSchema, onDiagramChange, theme, dbConfigContent, projectId }, ref) => {
  const [initialized, setInitialized] = useState(false);
  const [flowSchema, setFlowSchema] = useState(null);
  const containerRef = useRef(null);
  
  // Position management
  const positions = useCanvasPositions(yamlContent, 'modular_flow_positions', projectId);
  
  // Step state management
  const stepManager = useStepManager(positions);
  const {
    canonicalSteps,
    setCanonicalSteps,
    addStep,
    updateStep,
    deleteStep,
    internalUpdateRef,
    pendingInternalUpdateRef,
    resetInternalFlags,
    isInternalUpdate
  } = stepManager;

  // YAML processing (canvas -> YAML only)
  const { generateYAML, handleYAMLImport } = useFlowYamlProcessor(
    canonicalSteps, 
    flowSchema, 
    setCanonicalSteps, 
    positions
  );

  // Visual state management
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange
  } = useFlowVisualState(
    canonicalSteps,
    theme,
    onDiagramChange,
    generateYAML,
    flowSchema
  );

  // Connection handling
  const { onConnect, onEdgesDelete } = useFlowConnections(
    canonicalSteps,
    setCanonicalSteps,
    setEdges,
    internalUpdateRef,
    pendingInternalUpdateRef
  );

  // Event handling
  const {
    selectedNode,
    showEditModal,
    onNodeClick,
    onNodeDoubleClick,
    onNodeDragStop,
    onNodesDelete,
    handleNodeUpdate,
    closeModal
  } = useFlowEventHandlers(
    stepManager.updateStepPosition,
    deleteStep,
    updateStep,
    canonicalSteps,
    setCanonicalSteps,
    setNodes,
    setEdges,
    positions,
    internalUpdateRef,
    pendingInternalUpdateRef
  );
  
  // Use the custom hook to get resource definitions from database config
  const resourceDefinitions = useResourceDefinitions(dbConfigContent);

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

  // Handle initial schema load (for existing projects)
  useEffect(() => {
    // Skip if this was triggered by internal changes
    if (isInternalUpdate()) {
      return;
    }
    
    // Wait for position storage to be ready
    if (!positions.isStorageReady()) {
      return;
    }
    
    if (parsedSchema) {
      // Always update flowSchema for canvas initialization
      setFlowSchema(parsedSchema);
      
      // Only sync to canvas on initial load, not ongoing updates
      const eventFlows = parsedSchema?.event_simulation?.event_flows;
      if (eventFlows && eventFlows.length > 0) {
        const flow = eventFlows[0];
        const steps = flow.steps || [];
        if (steps.length > 0) {
          const updatedSteps = positions.resolvePositions(steps);
          setCanonicalSteps(updatedSteps);
          positions.completeInitialLoad();
        }
      }
    }
  }, [parsedSchema, positions, isInternalUpdate, setCanonicalSteps]);  // Removed handleYAMLChange dependency

  // Memoized imperative methods to prevent recreation on every render
  const imperativeMethods = useMemo(() => ({
    addStep: (stepData) => addStep(stepData, containerRef),
    updateStep,
    deleteStep,
    generateYAML,
    handleYAMLImport,
    getCanonicalSteps: () => canonicalSteps
  }), [addStep, updateStep, deleteStep, generateYAML, handleYAMLImport, canonicalSteps]);
  
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
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={[20, 20]}
          fitView
          attributionPosition="bottom-right"
          nodesDraggable={true}
          elementsSelectable={true}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background 
            key="modular-event-flow-background"
            variant="dots" 
            gap={12} 
            size={1}
          />
          <Controls />
          <MiniMap />
        </ReactFlow>
        </div>
      )}

      <NodeEditModal
        show={showEditModal}
        onHide={closeModal}
        node={selectedNode}
        onNodeUpdate={handleNodeUpdate}
        onNodeDelete={onNodesDelete}
        theme={theme}
        parsedSchema={parsedSchema}
        resourceDefinitions={resourceDefinitions}
      />
    </div>
  );
});

ModularEventFlow.displayName = 'ModularEventFlow';

export default ModularEventFlow;