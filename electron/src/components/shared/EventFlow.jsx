import React, { useState, useCallback, useEffect } from 'react';
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
            }
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
      // Create a new edge with styling
      const newEdge = { 
        ...params, 
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
        // This would update the YAML to add a new transition
        // In a real implementation, this requires complex YAML manipulation
        if (onDiagramChange) {
          onDiagramChange(simSchema);
        }
      }
    },
    [setEdges, simSchema, onDiagramChange]
  );
  
  // Handle node drag end
  const onNodeDragStop = useCallback(
    (event, node) => {
      console.log('Event node moved:', node);
    },
    []
  );
  
  return (
    <div className="event-flow-container" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default EventFlow; 