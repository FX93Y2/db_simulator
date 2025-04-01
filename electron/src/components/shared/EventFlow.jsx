import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import jsYaml from 'js-yaml';

// Custom Event Node component
const EventNode = ({ data }) => {
  return (
    <div className="event-node">
      <div className="event-node__title">{data.label}</div>
      {data.duration && (
        <div className="event-node__info">
          Duration: {data.duration.distribution?.mean || 0} days
        </div>
      )}
      {data.resources && (
        <div className="event-node__info">
          Resources: {data.resources}
        </div>
      )}
    </div>
  );
};

// Node types definition
const nodeTypes = {
  event: EventNode,
};

const EventFlow = ({ yamlContent, onDiagramChange }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [simSchema, setSimSchema] = useState(null);
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  
  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);
  
  // Parse YAML to extract events and transitions
  useEffect(() => {
    try {
      if (!yamlContent) return;
      
      const parsedYaml = jsYaml.load(yamlContent);
      setSimSchema(parsedYaml);
      
      if (parsedYaml && parsedYaml.event_simulation && 
          parsedYaml.event_simulation.event_sequence && 
          parsedYaml.event_simulation.event_sequence.event_types) {
        
        const eventTypes = parsedYaml.event_simulation.event_sequence.event_types;
        const transitions = parsedYaml.event_simulation.event_sequence.transitions || [];
        
        // Create nodes for each event type
        const eventNodes = eventTypes.map((event, index) => {
          // Position events in a circle
          const angle = (2 * Math.PI * index) / eventTypes.length;
          const radius = 200;
          const x = 400 + radius * Math.cos(angle);
          const y = 250 + radius * Math.sin(angle);
          
          // Format resource requirements for display
          let resourcesText = '';
          if (event.resource_requirements && event.resource_requirements.length > 0) {
            resourcesText = event.resource_requirements
              .map(req => `${req.count || 1} ${req.resource_table || 'Resource'}`)
              .join(', ');
          }
          
          return {
            id: event.name,
            type: 'event',
            position: { x, y },
            data: { 
              label: event.name,
              duration: event.duration,
              resources: resourcesText
            },
            // Add specific connection points
            sourcePosition: 'right',
            targetPosition: 'left',
          };
        });
        
        // Create edges for transitions
        const transitionEdges = [];
        transitions.forEach(transition => {
          const source = transition.from;
          
          // Each 'to' entry can have multiple destinations with probabilities
          if (transition.to && Array.isArray(transition.to)) {
            transition.to.forEach(dest => {
              transitionEdges.push({
                id: `${source}-${dest.event_type}`,
                source,
                target: dest.event_type,
                label: `${dest.probability * 100}%`,
                labelStyle: { fill: '#333', fontWeight: 'bold' },
                style: { stroke: '#2ecc71', strokeWidth: 2 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                  color: '#2ecc71',
                },
              });
            });
          }
        });
        
        setNodes(eventNodes);
        setEdges(transitionEdges);
      }
    } catch (error) {
      console.error('Error parsing YAML for event flow diagram:', error);
    }
  }, [yamlContent, setNodes, setEdges]);
  
  // Handle connecting nodes
  const onConnect = useCallback(
    (params) => {
      // Validate connection
      if (!params.source || !params.target) {
        console.error('Invalid connection params:', params);
        return;
      }
    
      // Create a new edge with styling
      const newEdge = { 
        ...params, 
        id: `${params.source}-${params.target}`,
        label: '100%',
        labelStyle: { fill: '#333', fontWeight: 'bold' },
        style: { stroke: '#2ecc71', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#2ecc71',
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      
      // If the schema exists, update it
      if (simSchema) {
        // Create a copy of the schema to modify
        const updatedSchema = { ...simSchema };
        
        // Ensure the transitions array exists
        if (!updatedSchema.event_simulation) {
          updatedSchema.event_simulation = {};
        }
        if (!updatedSchema.event_simulation.event_sequence) {
          updatedSchema.event_simulation.event_sequence = {};
        }
        if (!updatedSchema.event_simulation.event_sequence.transitions) {
          updatedSchema.event_simulation.event_sequence.transitions = [];
        }
        
        const transitions = updatedSchema.event_simulation.event_sequence.transitions;
        
        // Check if we already have a transition from this source
        let sourceTransition = transitions.find(t => t.from === params.source);
        
        if (!sourceTransition) {
          // Create a new transition entry
          sourceTransition = {
            from: params.source,
            to: []
          };
          transitions.push(sourceTransition);
        }
        
        // Check if the target is already in the "to" array
        const existingTarget = sourceTransition.to.find(t => t.event_type === params.target);
        
        if (!existingTarget) {
          // Add the new target with 100% probability
          sourceTransition.to.push({
            event_type: params.target,
            probability: 1.0
          });
          
          // If there were already other targets, adjust probabilities
          if (sourceTransition.to.length > 1) {
            const newProb = 1.0 / sourceTransition.to.length;
            sourceTransition.to.forEach(target => {
              target.probability = newProb;
            });
          }
        }
        
        // Update the schema state
        setSimSchema(updatedSchema);
        
        // Convert to YAML and notify parent
        const updatedYaml = jsYaml.dump(updatedSchema, { lineWidth: 120 });
        if (onDiagramChange) {
          onDiagramChange(updatedYaml);
        }
      }
    },
    [setEdges, simSchema, onDiagramChange]
  );
  
  // Handle node drag end
  const onNodeDragStop = useCallback(
    (event, node) => {
      // Update the position in our node state
      setNodes(nds => 
        nds.map(n => {
          if (n.id === node.id) {
            n.position = node.position;
          }
          return n;
        })
      );
      
      console.log('Event node moved:', node);
    },
    [setNodes]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    (deleted) => {
      if (!simSchema || !simSchema.event_simulation || 
          !simSchema.event_simulation.event_sequence) return;
      
      // Create a copy of the schema to modify
      const updatedSchema = { ...simSchema };
      const eventSequence = updatedSchema.event_simulation.event_sequence;
      
      // Remove the deleted event types
      if (eventSequence.event_types) {
        eventSequence.event_types = eventSequence.event_types.filter(
          event => !deleted.some(node => node.id === event.name)
        );
      }
      
      // Remove transitions that reference the deleted events
      if (eventSequence.transitions) {
        // Remove transitions from deleted events
        eventSequence.transitions = eventSequence.transitions.filter(
          transition => !deleted.some(node => node.id === transition.from)
        );
        
        // Remove transitions to deleted events
        eventSequence.transitions.forEach(transition => {
          if (transition.to) {
            transition.to = transition.to.filter(
              to => !deleted.some(node => node.id === to.event_type)
            );
            
            // Recalculate probabilities if needed
            if (transition.to.length > 0) {
              const newProb = 1.0 / transition.to.length;
              transition.to.forEach(target => {
                target.probability = newProb;
              });
            }
          }
        });
        
        // Remove transitions with no destinations
        eventSequence.transitions = eventSequence.transitions.filter(
          transition => transition.to && transition.to.length > 0
        );
      }
      
      // Update the schema state
      setSimSchema(updatedSchema);
      
      // Convert to YAML and notify parent
      const updatedYaml = jsYaml.dump(updatedSchema, { lineWidth: 120 });
      if (onDiagramChange) {
        onDiagramChange(updatedYaml);
      }
    },
    [simSchema, onDiagramChange]
  );
  
  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (deleted) => {
      if (!simSchema || !simSchema.event_simulation || 
          !simSchema.event_simulation.event_sequence ||
          !simSchema.event_simulation.event_sequence.transitions) return;
      
      // Create a copy of the schema to modify
      const updatedSchema = { ...simSchema };
      const transitions = updatedSchema.event_simulation.event_sequence.transitions;
      
      // Process each deleted edge
      deleted.forEach(edge => {
        const [sourceEvent, targetEvent] = edge.id.split('-');
        
        // Find the transition for this source event
        const transitionIndex = transitions.findIndex(t => t.from === sourceEvent);
        
        if (transitionIndex !== -1) {
          const transition = transitions[transitionIndex];
          
          // Find and remove the target from the "to" array
          if (transition.to) {
            transition.to = transition.to.filter(to => to.event_type !== targetEvent);
            
            // Recalculate probabilities
            if (transition.to.length > 0) {
              const newProb = 1.0 / transition.to.length;
              transition.to.forEach(target => {
                target.probability = newProb;
              });
            } else {
              // If no targets left, remove the entire transition
              transitions.splice(transitionIndex, 1);
            }
          }
        }
      });
      
      // Update the schema state
      setSimSchema(updatedSchema);
      
      // Convert to YAML and notify parent
      const updatedYaml = jsYaml.dump(updatedSchema, { lineWidth: 120 });
      if (onDiagramChange) {
        onDiagramChange(updatedYaml);
      }
    },
    [simSchema, onDiagramChange]
  );
  
  // If not initialized, just show the container to get dimensions
  if (!initialized) {
    return <div ref={containerRef} className="event-flow-container" style={{ width: '100%', height: '100%' }} />;
  }
  
  return (
    <div className="event-flow-container" style={{ width: '100%', height: '100%' }} ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Controls />
        <MiniMap />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default EventFlow; 