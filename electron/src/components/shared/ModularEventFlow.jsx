import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
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
import { nodeTypes } from './flow-nodes/FlowNodeComponents';
import NodeEditModal from './flow-nodes/NodeEditModal';
import { 
  generateSchemaId, 
  loadLayoutFromStorage, 
  saveLayoutToStorage,
  buildNodesFromFlow,
  buildEdgesFromFlow,
  isUserTyping
} from './flow-nodes/flowUtils';

const ModularEventFlow = ({ yamlContent, parsedSchema, onDiagramChange, theme, dbConfigContent }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [flowData, setFlowData] = useState(null);
  const [schemaId, setSchemaId] = useState(null);
  const [layoutMap, setLayoutMap] = useState({});
  const [initialized, setInitialized] = useState(false);
  const containerRef = useRef(null);
  
  // Use the custom hook to get resource definitions from database config
  const resourceDefinitions = useResourceDefinitions(dbConfigContent);

  // Use layout effect to ensure container is measured before rendering (COPIED FROM ERDIAGRAM)
  useLayoutEffect(() => {
    if (containerRef.current) {
      console.log('[ModularEventFlow] Container dimensions:', {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
        clientWidth: containerRef.current.clientWidth,
        clientHeight: containerRef.current.clientHeight
      });
      setInitialized(true);
    }
  }, []);


  // Generate consistent ID for schema based on content
  useEffect(() => {
    const id = generateSchemaId(yamlContent);
    setSchemaId(id);
  }, [yamlContent]);

  // Load layout map from localStorage on mount or schemaId change
  useEffect(() => {
    if (schemaId) {
      const savedLayout = loadLayoutFromStorage(schemaId);
      setLayoutMap(savedLayout);
    }
  }, [schemaId]);

  // Debounced save to localStorage
  const debounceRef = useRef();
  const saveLayoutDebounced = useCallback((layout, key) => {
    if (!key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveLayoutToStorage(layout, key);
    }, 300);
  }, []);

  // Save layout to localStorage whenever layoutMap changes
  useEffect(() => {
    if (schemaId) {
      saveLayoutDebounced(layoutMap, schemaId);
    }
  }, [layoutMap, schemaId, saveLayoutDebounced]);

  // Parse event_flows from schema and build diagram
  useEffect(() => {
    if (!parsedSchema?.event_simulation?.event_flows) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const eventFlows = parsedSchema.event_simulation.event_flows;
    if (eventFlows.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Use first flow for now
    const flow = eventFlows[0];
    setFlowData(flow);
    
    // Store current node positions before rebuilding
    const currentPositions = {};
    nodes.forEach(node => {
      currentPositions[node.id] = node.position;
    });
    
    // Build nodes and edges
    const newNodes = buildNodesFromFlow(flow, layoutMap, theme, currentPositions);
    const newEdges = buildEdgesFromFlow(flow);

    setNodes(newNodes);
    setEdges(newEdges);
  }, [parsedSchema, theme, layoutMap]);

  const onConnect = useCallback((params) => {
    // Add visual edge
    const newEdge = {
      ...params,
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' },
      style: { stroke: '#38a169', strokeWidth: 2 }
    };
    setEdges((eds) => addEdge(newEdge, eds));

    // Update YAML schema
    if (flowData && parsedSchema) {
      const updatedSchema = { ...parsedSchema };
      const flow = updatedSchema.event_simulation.event_flows[0];
      const sourceStep = flow.steps.find(s => s.step_id === params.source);

      if (sourceStep) {
        if (sourceStep.step_type === 'decide') {
          // Handle decide step connections through outcomes
          const outcomeIndex = parseInt(params.sourceHandle?.replace('outcome-', '') || '0');
          
          // Ensure decide_config exists
          if (!sourceStep.decide_config) {
            sourceStep.decide_config = {
              module_id: sourceStep.step_id,
              decision_type: 'probability',
              outcomes: []
            };
          }
          
          // If connecting to an existing outcome, update it
          if (sourceStep.decide_config.outcomes[outcomeIndex]) {
            sourceStep.decide_config.outcomes[outcomeIndex].next_step_id = params.target;
          } else {
            // If connecting to the always-available handle (beyond existing outcomes), create a new outcome
            const newOutcome = {
              outcome_id: `outcome_${outcomeIndex + 1}`,
              next_step_id: params.target,
              conditions: [{
                if: 'Probability',
                is: '==',
                value: 0.5 // Default probability, user can edit later
              }]
            };
            
            // Add the new outcome
            sourceStep.decide_config.outcomes.push(newOutcome);
            
            // Normalize probabilities if needed (ensure they sum to 1)
            const outcomes = sourceStep.decide_config.outcomes;
            if (outcomes.length > 1) {
              const equalProbability = 1 / outcomes.length;
              outcomes.forEach(outcome => {
                if (outcome.conditions && outcome.conditions[0]) {
                  outcome.conditions[0].probability = equalProbability;
                }
              });
            }
          }
        } else {
          // Handle regular next_steps
          if (!sourceStep.next_steps) sourceStep.next_steps = [];
          if (!sourceStep.next_steps.includes(params.target)) {
            sourceStep.next_steps.push(params.target);
          }
        }

        onDiagramChange(updatedSchema);
      }
    }
  }, [flowData, parsedSchema, onDiagramChange]);

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

  const handleNodeUpdate = (updatedNode) => {
    const oldNodeId = selectedNode?.id;
    const newNodeId = updatedNode.id;
    
    // Update visual node
    setNodes((nds) =>
      nds.map((node) =>
        node.id === oldNodeId ? updatedNode : node
      )
    );

    // Update edges if node ID changed
    if (oldNodeId !== newNodeId) {
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          source: edge.source === oldNodeId ? newNodeId : edge.source,
          target: edge.target === oldNodeId ? newNodeId : edge.target,
          id: edge.id.replace(oldNodeId, newNodeId)
        }))
      );
    }

    // Update YAML schema
    if (flowData && parsedSchema) {
      const updatedSchema = { ...parsedSchema };
      const flow = updatedSchema.event_simulation.event_flows[0];
      const stepIndex = flow.steps.findIndex(s => s.step_id === oldNodeId);
      
      if (stepIndex !== -1) {
        // Update the step configuration
        flow.steps[stepIndex] = updatedNode.data.stepConfig;
        
        // Update references to this step in other steps if ID changed
        if (oldNodeId !== newNodeId) {
          flow.steps.forEach(step => {
            // Update next_steps references
            if (step.next_steps) {
              step.next_steps = step.next_steps.map(id => id === oldNodeId ? newNodeId : id);
            }
            // Update decide outcomes references
            if (step.decide_config?.outcomes) {
              step.decide_config.outcomes.forEach(outcome => {
                if (outcome.next_step_id === oldNodeId) {
                  outcome.next_step_id = newNodeId;
                }
              });
            }
          });
          
          // Update initial_step if it was changed
          if (flow.initial_step === oldNodeId) {
            flow.initial_step = newNodeId;
          }
        }
        
        onDiagramChange(updatedSchema);
      }
    }
  };

  // Handle node drag end to save positions to localStorage
  const onNodeDragStop = useCallback((_event, node) => {
    setNodes(nds =>
      nds.map(n => n.id === node.id ? { ...n, position: node.position } : n)
    );
    // Update layoutMap in state (triggers debounced save)
    setLayoutMap(prev => ({
      ...prev,
      [node.id]: { ...node.position }
    }));
  }, [setNodes]);

  const onNodesDelete = useCallback((deletedNodes) => {
    if (flowData && parsedSchema) {
      const updatedSchema = { ...parsedSchema };
      const flow = updatedSchema.event_simulation.event_flows[0];
      
      const deletedIds = deletedNodes.map(n => n.id);
      
      // Remove deleted steps
      flow.steps = flow.steps.filter(step => !deletedIds.includes(step.step_id));
      
      // Clean up references in remaining steps
      flow.steps.forEach(step => {
        if (step.next_steps) {
          step.next_steps = step.next_steps.filter(id => !deletedIds.includes(id));
        }
        if (step.decide_config?.outcomes) {
          // Remove outcomes that reference deleted steps entirely
          step.decide_config.outcomes = step.decide_config.outcomes.filter(outcome => 
            !deletedIds.includes(outcome.next_step_id)
          );
          
          // Rebalance probabilities for remaining outcomes
          if (step.decide_config.outcomes.length > 0) {
            const equalProbability = 1 / step.decide_config.outcomes.length;
            step.decide_config.outcomes.forEach(outcome => {
              outcome.conditions.forEach(condition => {
                if (condition.if && condition.if.toLowerCase() === 'probability') {
                  condition.value = equalProbability;
                }
              });
            });
          }
        }
      });

      // Update initial_step if it was deleted
      if (deletedIds.includes(flow.initial_step)) {
        flow.initial_step = flow.steps.length > 0 ? flow.steps[0].step_id : '';
      }

      onDiagramChange(updatedSchema);
    }
  }, [flowData, parsedSchema, onDiagramChange]);

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
};

export default ModularEventFlow;