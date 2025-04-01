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

// Custom Entity Node component
const EntityNode = ({ data }) => {
  return (
    <div className="entity-node">
      <div className="entity-node__title">{data.label}</div>
      <div className="entity-node__attributes">
        {data.attributes.map((attr, index) => (
          <div 
            key={index} 
            className={`entity-node__attribute ${attr.type === 'pk' ? 'primary-key' : ''} ${attr.type === 'fk' ? 'foreign-key' : ''}`}
          >
            {attr.name}: {attr.type}
          </div>
        ))}
      </div>
    </div>
  );
};

// Node types definition
const nodeTypes = {
  entity: EntityNode,
};

const ERDiagram = ({ yamlContent, onDiagramChange }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dbSchema, setDbSchema] = useState(null);
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);

  // Parse YAML to extract entities
  useEffect(() => {
    try {
      if (!yamlContent) return;
      
      const parsedYaml = jsYaml.load(yamlContent);
      setDbSchema(parsedYaml);
      
      if (parsedYaml && parsedYaml.entities) {
        const entityNodes = [];
        const relationEdges = [];
        
        // Create nodes for each entity
        parsedYaml.entities.forEach((entity, index) => {
          const xPos = (index % 3) * 300 + 50;
          const yPos = Math.floor(index / 3) * 300 + 50;
          
          entityNodes.push({
            id: entity.name,
            type: 'entity',
            position: { x: xPos, y: yPos },
            data: { 
              label: entity.name,
              attributes: entity.attributes || []
            },
            // Add connection points without specific handles
            sourcePosition: 'right',
            targetPosition: 'left',
          });
          
          // Create edges for relationships
          if (entity.attributes) {
            entity.attributes.forEach(attr => {
              if (attr.type === 'fk' && attr.ref) {
                const [targetEntity] = attr.ref.split('.');
                relationEdges.push({
                  id: `${entity.name}-${targetEntity}`,
                  source: entity.name,
                  // Remove sourceHandle and targetHandle that don't exist
                  target: targetEntity,
                  animated: true,
                  style: { stroke: '#3498db' },
                  label: attr.name,
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                    color: '#3498db',
                  },
                });
              }
            });
          }
        });
        
        setNodes(entityNodes);
        setEdges(relationEdges);
      }
    } catch (error) {
      console.error('Error parsing YAML for ER diagram:', error);
    }
  }, [yamlContent, setNodes, setEdges]);
  
  // Handle connecting nodes
  const onConnect = useCallback(
    (params) => {
      // Validate connection params
      if (!params.source || !params.target) {
        console.error('Invalid connection params:', params);
        return;
      }
      
      // When a connection is made, we need to update the YAML
      const newEdge = { 
        ...params, 
        id: `${params.source}-${params.target}`,
        animated: true,
        style: { stroke: '#3498db' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#3498db',
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      
      // Only proceed if dbSchema exists
      if (!dbSchema || !dbSchema.entities) {
        console.error('No schema available for edge creation');
        return;
      }
      
      // Find the source and target entities
      const sourceEntity = dbSchema.entities.find(e => e.name === params.source);
      const targetEntity = dbSchema.entities.find(e => e.name === params.target);
      
      if (sourceEntity && targetEntity) {
        // Add a foreign key to the source entity
        if (!sourceEntity.attributes) {
          sourceEntity.attributes = [];
        }
        
        // Generate a foreign key name
        const fkName = `${targetEntity.name.toLowerCase()}_id`;
        
        // Check if this foreign key already exists
        if (!sourceEntity.attributes.some(attr => attr.name === fkName)) {
          // Add the foreign key attribute
          sourceEntity.attributes.push({
            name: fkName,
            type: 'fk',
            ref: `${targetEntity.name}.id`
          });
          
          // Convert the updated schema back to YAML
          const updatedYaml = jsYaml.dump(dbSchema, { lineWidth: 120 });
          
          // Call the parent's callback with the updated YAML content
          if (onDiagramChange) {
            onDiagramChange(updatedYaml);
          }
        }
      }
    },
    [setEdges, dbSchema, onDiagramChange]
  );
  
  // Handle node movement
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
      
      console.log('Node moved:', node);
    },
    [setNodes]
  );
  
  // If not initialized, just show the container to get dimensions
  if (!initialized) {
    return <div ref={containerRef} className="er-diagram-container" style={{ width: '100%', height: '100%' }} />;
  }
  
  return (
    <div className="er-diagram-container" style={{ width: '100%', height: '100%' }} ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
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

export default ERDiagram; 