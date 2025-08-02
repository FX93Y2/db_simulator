import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import useResourceDefinitions from '../../hooks/useResourceDefinitions';
import { useCanvasPositions } from '../../hooks/useCanvasPositions';
import { nodeTypes } from './flow-nodes/FlowNodeComponents';
import NodeEditModal from './flow-nodes/NodeEditModal';
import { 
  buildNodesFromFlow,
  buildEdgesFromFlow,
  isUserTyping
} from './flow-nodes/flowUtils';
import {
  handleStepConnection,
  handleEdgeDeletion,
  validateConnection,
  connectionExists
} from './flow-nodes/EventFlowConnectionHandler';

const ModularEventFlow = forwardRef(({ yamlContent, parsedSchema, onDiagramChange, theme, dbConfigContent, projectId }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Canonical step state - this is now the source of truth
  const [canonicalSteps, setCanonicalSteps] = useState([]);
  const [flowSchema, setFlowSchema] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const containerRef = useRef(null);
  
  // Track if we're updating from internal canvas operations
  const internalUpdateRef = useRef(false);
  
  // Use position management hook
  const positions = useCanvasPositions(yamlContent, 'modular_flow_positions', projectId);
  
  // Use the custom hook to get resource definitions from database config
  const resourceDefinitions = useResourceDefinitions(dbConfigContent);

  // Update current nodes in position hook
  useEffect(() => {
    positions.updateCurrentNodes(nodes);
  }, [nodes, positions]);

  // Direct step manipulation methods - Canvas is source of truth
  const addStep = useCallback((stepData) => {
    // Calculate viewport-centered position for new step
    let newPosition;
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      
      // Add some randomness to avoid stacking steps exactly on top of each other
      const offsetX = (canonicalSteps.length % 3 - 1) * 50;
      const offsetY = Math.floor(canonicalSteps.length / 3) * 50;
      
      newPosition = {
        x: Math.max(50, centerX - 100 + offsetX),
        y: Math.max(50, centerY - 100 + offsetY)
      };
    } else {
      // Fallback to grid positioning
      newPosition = {
        x: 50 + (canonicalSteps.length % 3) * 300,
        y: 100 + Math.floor(canonicalSteps.length / 3) * 200
      };
    }
    
    // Add to canonical steps
    const newStep = {
      ...stepData,
      position: newPosition
    };
    
    setCanonicalSteps(prev => [...prev, newStep]);
    
    // Update position in hook
    positions.updateItemPosition(stepData.step_id, newPosition);
    
    // Set internal update flag to prevent YAML sync loops
    internalUpdateRef.current = true;
    
    return newStep;
  }, [canonicalSteps, positions]);

  const updateStep = useCallback((stepId, newData) => {
    // Check if step_id is changing
    const isIdChanging = newData.step_id && newData.step_id !== stepId;
    
    setCanonicalSteps(prev => prev.map(step => 
      step.step_id === stepId 
        ? { 
            ...step, 
            ...newData, 
            position: step.position // Preserve position
          }
        : step
    ));
    
    // If step_id is changing, update position mapping
    if (isIdChanging) {
      positions.updateItemId(stepId, newData.step_id);
    }
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, [positions]);

  const deleteStep = useCallback((stepId) => {
    // Remove from canonical steps
    setCanonicalSteps(prev => prev.filter(step => step.step_id !== stepId));
    
    // Remove position
    positions.removeItemPositions([stepId]);
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, [positions]);

  const generateYAML = useCallback(() => {
    if (!flowSchema || canonicalSteps.length === 0) {
      return null;
    }
    
    const updatedSchema = {
      ...flowSchema,
      event_simulation: {
        ...flowSchema.event_simulation,
        event_flows: [{
          ...flowSchema.event_simulation.event_flows[0],
          steps: canonicalSteps.map(step => {
            const { position, ...stepWithoutPosition } = step;
            return stepWithoutPosition;
          })
        }]
      }
    };
    
    return updatedSchema;
  }, [canonicalSteps, flowSchema]);

  // Utility function to detect step changes
  const detectStepChanges = useCallback((oldSteps, newSteps) => {
    const oldIds = new Set(oldSteps.map(s => s.step_id));
    const newIds = new Set(newSteps.map(s => s.step_id));
    
    const added = newSteps.filter(s => !oldIds.has(s.step_id));
    const deleted = oldSteps.filter(s => !newIds.has(s.step_id));
    const modified = newSteps.filter(s => {
      const oldStep = oldSteps.find(old => old.step_id === s.step_id);
      if (!oldStep) return false;
      
      // Deep comparison of step properties (excluding position)
      const oldClean = { ...oldStep };
      delete oldClean.position;
      const newClean = { ...s };
      delete newClean.position;
      
      return JSON.stringify(oldClean) !== JSON.stringify(newClean);
    });
    
    return { added, deleted, modified };
  }, []);

  // Handle YAML changes from external sources (like YAML editor)
  const handleYAMLChange = useCallback((newSchema) => {
    if (!newSchema?.event_simulation?.event_flows) {
      setCanonicalSteps([]);
      return;
    }
    
    const eventFlows = newSchema.event_simulation.event_flows;
    if (eventFlows.length === 0) {
      setCanonicalSteps([]);
      return;
    }
    
    // Use first flow
    const flow = eventFlows[0];
    const newSteps = flow.steps || [];
    
    if (newSteps.length === 0) {
      // Don't clear steps if we currently have steps - prevents accidental clearing
      if (canonicalSteps.length > 0) {
        return;
      }
      setCanonicalSteps([]);
      return;
    }
    
    // Use position hook to resolve positions
    const updatedSteps = positions.resolvePositions(newSteps);
    
    // Check for structural changes
    const hasStructuralChanges = JSON.stringify(canonicalSteps.map(s => {
      const { position, ...step } = s;
      return step;
    })) !== JSON.stringify(newSteps);
    
    if (hasStructuralChanges || canonicalSteps.length !== updatedSteps.length) {
      setCanonicalSteps(updatedSteps);
      positions.completeInitialLoad();
    }
    
    // Always update flowSchema
    setFlowSchema(newSchema);
    
  }, [canonicalSteps, positions]);

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);


  // Update visual nodes and edges from canonical steps
  useEffect(() => {
    if (canonicalSteps.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Build visual nodes directly from canonical steps with their stored positions
    const visualNodes = canonicalSteps.map(step => {
      const nodeType = step.step_type === 'event' ? 'process' :
                      step.step_type === 'decide' ? 'decide' :
                      step.step_type === 'assign' ? 'assign' :
                      step.step_type === 'release' ? 'release' : 'process';
      
      // Use the position stored in the canonical step
      const position = step.position || { x: 100, y: 100 };
      
      return {
        id: step.step_id,
        type: nodeType,
        position: position,
        data: {
          label: step.step_id,
          stepConfig: step,
          theme: theme
        }
      };
    });
    
    // Build edges from canonical steps
    const visualEdges = [];
    canonicalSteps.forEach(step => {
      if (step.step_type === 'decide' && step.decide_config?.outcomes) {
        step.decide_config.outcomes.forEach((outcome, index) => {
          if (outcome.next_step_id) {
            visualEdges.push({
              id: `${step.step_id}-${outcome.next_step_id}`,
              source: step.step_id,
              target: outcome.next_step_id,
              sourceHandle: `outcome-${index}`,
              type: 'smoothstep',
              markerEnd: { type: 'arrowclosed' },
              style: { stroke: '#ed8936', strokeWidth: 2 }
            });
          }
        });
      } else if (step.next_steps && step.next_steps.length > 0) {
        step.next_steps.forEach(nextStepId => {
          visualEdges.push({
            id: `${step.step_id}-${nextStepId}`,
            source: step.step_id,
            target: nextStepId,
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' },
            style: { stroke: '#38a169', strokeWidth: 2 }
          });
        });
      }
    });

    // Update visual representation
    setNodes(visualNodes);
    setEdges(visualEdges);
    
    // Notify parent of changes if this was an internal update
    if (internalUpdateRef.current && onDiagramChange && flowSchema) {
      const generatedSchema = generateYAML();
      if (generatedSchema) {
        // Set a timeout to reset the flag after the parent processes the change
        setTimeout(() => {
          internalUpdateRef.current = false;
        }, 200);
        onDiagramChange(generatedSchema);
      } else {
        internalUpdateRef.current = false;
      }
    }
  }, [canonicalSteps, theme, onDiagramChange, generateYAML, flowSchema]);

  // Handle external YAML updates
  useEffect(() => {
    // Skip if this was triggered by internal changes
    if (internalUpdateRef.current) {
      return;
    }
    
    // Wait for position storage to be ready
    if (!positions.isStorageReady()) {
      return;
    }
    
    if (parsedSchema) {
      handleYAMLChange(parsedSchema);
    }
  }, [parsedSchema, handleYAMLChange, positions]);

  // Memoized imperative methods to prevent recreation on every render
  const imperativeMethods = useMemo(() => ({
    addStep,
    updateStep,
    deleteStep,
    generateYAML,
    handleYAMLChange,
    getCanonicalSteps: () => canonicalSteps
  }), [addStep, updateStep, deleteStep, generateYAML, handleYAMLChange, canonicalSteps]);
  
  // Expose methods to parent components
  useImperativeHandle(ref, () => imperativeMethods, [imperativeMethods]);

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
      }
    );
    
  }, [canonicalSteps]);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  const onNodeDoubleClick = useCallback((_event, node) => {
    setSelectedNode(node);
    setShowEditModal(true);
  }, []);

  // Handle keyboard shortcuts
  const onKeyDown = useCallback((event) => {
    // Don't handle keyboard shortcuts if user is typing in an input field
    if (isUserTyping()) {
      return; // Let the input field handle the keyboard event
    }
    
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
      onNodesDelete([selectedNode]);
      setSelectedNode(null);
    }
  }, [selectedNode, onNodesDelete]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  const handleNodeUpdate = useCallback((updatedNode) => {
    const oldNodeId = selectedNode?.id;
    const newNodeId = updatedNode.id;
    
    // Update canonical steps with new node data
    setCanonicalSteps(prev => {
      let updatedSteps = prev.map(step => {
        if (step.step_id === oldNodeId) {
          return {
            ...updatedNode.data.stepConfig,
            position: step.position // Preserve position
          };
        }
        return step;
      });
      
      // Update references to this step in other steps if ID changed
      if (oldNodeId !== newNodeId) {
        updatedSteps = updatedSteps.map(step => {
          let updatedStep = { ...step };
          
          // Update next_steps references
          if (step.next_steps) {
            updatedStep.next_steps = step.next_steps.map(id => id === oldNodeId ? newNodeId : id);
          }
          
          // Update decide outcomes references
          if (step.decide_config?.outcomes) {
            updatedStep.decide_config = {
              ...step.decide_config,
              outcomes: step.decide_config.outcomes.map(outcome => ({
                ...outcome,
                next_step_id: outcome.next_step_id === oldNodeId ? newNodeId : outcome.next_step_id
              }))
            };
          }
          
          return updatedStep;
        });
        
        // Update layout map key if step ID changed
        setLayoutMap(prev => {
          const currentPosition = prev[oldNodeId];
          if (currentPosition) {
            const newLayout = { ...prev };
            newLayout[newNodeId] = currentPosition;
            delete newLayout[oldNodeId];
            return newLayout;
          }
          return prev;
        });
      }
      
      return updatedSteps;
    });
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, [selectedNode]);

  // Handle node drag end - update canonical steps positions immediately
  const onNodeDragStop = useCallback((_event, node) => {
    // Update position in canonical steps
    setCanonicalSteps(prev => prev.map(step => 
      step.step_id === node.id 
        ? { ...step, position: node.position }
        : step
    ));
    
    // Update visual nodes
    setNodes(nds => nds.map(n => 
      n.id === node.id ? { ...n, position: node.position } : n
    ));
    
    // Update position in hook for localStorage persistence
    positions.updateItemPosition(node.id, node.position);
  }, [positions]);

  const onNodesDelete = useCallback((deletedNodes) => {
    const deletedIds = deletedNodes.map(n => n.id);
    
    // Update canonical steps - remove deleted steps and clean up references
    setCanonicalSteps(prev => {
      // Remove deleted steps
      let remainingSteps = prev.filter(step => !deletedIds.includes(step.step_id));
      
      // Clean up references in remaining steps
      remainingSteps = remainingSteps.map(step => {
        let updatedStep = { ...step };
        
        if (step.next_steps) {
          updatedStep.next_steps = step.next_steps.filter(id => !deletedIds.includes(id));
        }
        
        if (step.decide_config?.outcomes) {
          // Remove outcomes that reference deleted steps entirely
          updatedStep.decide_config = {
            ...step.decide_config,
            outcomes: step.decide_config.outcomes.filter(outcome => 
              !deletedIds.includes(outcome.next_step_id)
            )
          };
          
          // Rebalance probabilities for remaining outcomes
          if (updatedStep.decide_config.outcomes.length > 0) {
            const equalProbability = 1 / updatedStep.decide_config.outcomes.length;
            updatedStep.decide_config.outcomes.forEach(outcome => {
              outcome.conditions.forEach(condition => {
                if (condition.if && condition.if.toLowerCase() === 'probability') {
                  condition.value = equalProbability;
                }
              });
            });
          }
        }
        
        return updatedStep;
      });
      
      return remainingSteps;
    });
    
    // Remove deleted node positions from layoutMap
    setLayoutMap(prev => {
      const newLayout = { ...prev };
      deletedIds.forEach(id => {
        delete newLayout[id];
      });
      return newLayout;
    });
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, []);

  // Handle edge deletion with automatic connection removal
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
        }
      );
    }
  }, [canonicalSteps]);

  // If not initialized, just show the container to get dimensions (COPIED FROM ERDIAGRAM)
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
        onHide={() => setShowEditModal(false)}
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