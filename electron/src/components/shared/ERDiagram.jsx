import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
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
            }
          });
          
          // Create edges for relationships
          if (entity.attributes) {
            entity.attributes.forEach(attr => {
              if (attr.type === 'fk' && attr.ref) {
                const [targetEntity] = attr.ref.split('.');
                relationEdges.push({
                  id: `${entity.name}-${targetEntity}`,
                  source: entity.name,
                  sourceHandle: `${entity.name}-output`,
                  target: targetEntity,
                  targetHandle: `${targetEntity}-input`,
                  animated: true,
                  style: { stroke: '#3498db' },
                  label: attr.name,
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
        // Generate YAML changes for the new relationship
        // This is where you would update the YAML to add a foreign key
        if (onDiagramChange) {
          // In a real implementation, this would involve more complex YAML manipulation
          onDiagramChange(dbSchema);
        }
      }
    },
    [setEdges, dbSchema, onDiagramChange]
  );
  
  // Handle node movement
  const onNodeDragStop = useCallback(
    (event, node) => {
      // Update node positions (this doesn't affect the YAML, just the diagram)
      console.log('Node moved:', node);
    },
    []
  );
  
  return (
    <div className="er-diagram-container" style={{ width: '100%', height: '100%' }}>
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

export default ERDiagram; 