import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import yaml from 'yaml';
import EntityEditor from './EntityEditor';

// Custom Entity Node component
const EntityNode = ({ data, theme }) => {
  // Determine node class based on table type
  const getNodeTypeClass = () => {
    switch (data.tableType) {
      case 'entity':
        return 'entity-type';
      case 'event':
        return 'event-type';
      case 'resource':
        return 'resource-type';
      default:
        return '';
    }
  };

  return (
    <div className={`entity-node ${getNodeTypeClass()}`}>
      <Handle type="target" position={Position.Top} id="target-top" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
      
      <div className="entity-node__title">
        {data.label}
        {data.tableType && (
          <span className="entity-node__type-badge">
            {data.tableType}
          </span>
        )}
      </div>
      <div className="entity-node__attributes">
        {data.attributes.map((attr, index) => (
          <div
            key={index}
            className={`entity-node__attribute ${attr.type === 'pk' ? 'primary-key' : ''} ${
              attr.type === 'fk' || attr.type === 'event_id' || attr.type === 'entity_id' || attr.type === 'resource_id' ? 'foreign-key' : ''
            }`}
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

const ERDiagram = ({ yamlContent, onDiagramChange, theme }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dbSchema, setDbSchema] = useState(null);
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [schemaId, setSchemaId] = useState(null);
  const currentNodesRef = useRef([]);
  const [layoutMap, setLayoutMap] = useState({});

  // Utility: Extract layout map from nodes
  const extractLayoutMap = useCallback((nodesArr) => {
    const map = {};
    nodesArr.forEach(node => {
      if (node.position) {
        map[node.id] = { ...node.position };
      }
    });
    return map;
  }, []);

  // Utility: Apply layout map to nodes
  const applyLayoutToNodes = useCallback((nodesArr, layout) => {
    return nodesArr.map(node => {
      if (layout && layout[node.id]) {
        return { ...node, position: { ...layout[node.id] } };
      }
      return node;
    });
  }, []);

  // Debounced save to localStorage
  const debounceRef = useRef();
  const saveLayoutToLocalStorage = useCallback((layout, key) => {
    if (!key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(layout));
        // console.log('[ERDiagram] Debounced save to localStorage:', layout);
      } catch (err) {
        console.error('[ERDiagram] Error saving layout to localStorage:', err);
      }
    }, 300);
  }, []);
  // Update the ref whenever nodes change
  useEffect(() => {
    currentNodesRef.current = nodes;
  }, [nodes]);

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);

  // Generate a consistent ID for the schema based on its entities
  useEffect(() => {
    if (yamlContent) {
      try {
        const parsedDoc = yaml.parseDocument(yamlContent);
        const parsedYaml = parsedDoc.toJSON();
        
        if (parsedYaml) {
          // Generate a more stable ID that doesn't change when entities are added/removed
          // This uses a hash of the first part of the YAML content
          const yamlPrefix = yamlContent.substring(0, 100).replace(/\s+/g, '');
          let stableId = '';
          
          // Simple hash function to create a stable ID
          for (let i = 0; i < yamlPrefix.length; i++) {
            stableId += yamlPrefix.charCodeAt(i);
          }
          
          const id = `er_diagram_positions_${stableId}`;
          console.log('[ERDiagram] Generated stable schema ID:', id);
          setSchemaId(id);
        }
      } catch (error) {
        console.error('[ERDiagram] Error generating schema ID:', error);
      }
    }
  }, [yamlContent]);

  // Load layout map from localStorage on mount or schemaId change
  useEffect(() => {
    if (schemaId) {
      try {
        const saved = localStorage.getItem(schemaId);
        setLayoutMap(saved ? JSON.parse(saved) : {});
      } catch (err) {
        setLayoutMap({});
      }
    }
  }, [schemaId]);

  // Save layout to localStorage whenever layoutMap changes
  useEffect(() => {
    if (schemaId) {
      saveLayoutToLocalStorage(layoutMap, schemaId);
    }
  }, [layoutMap, schemaId, saveLayoutToLocalStorage]);

  // Parse YAML to extract entities and hydrate positions
  useEffect(() => {
    try {
      if (!yamlContent) {
        setDbSchema(null);
        setNodes([]);
        setEdges([]);
        return;
      }
      const parsedDoc = yaml.parseDocument(yamlContent);
      const parsedYaml = parsedDoc.toJSON();

      setDbSchema(parsedYaml);

      if (parsedYaml && parsedYaml.entities) {
        const entityNodes = [];
        const relationEdges = [];

        // Create nodes for each entity
        parsedYaml.entities.forEach((entity, index) => {
          // Default position if not in layoutMap
          let position = layoutMap[entity.name] || { x: (index % 3) * 300 + 50, y: Math.floor(index / 3) * 300 + 50 };

          entityNodes.push({
            id: entity.name,
            type: 'entity',
            position: position,
            data: {
              label: entity.name,
              tableType: entity.type || '',
              rows: entity.rows,
              attributes: entity.attributes || []
            },
            width: 200,
            height: 100 + (entity.attributes?.length || 0) * 25,
          });

          // Create edges for relationships
          if (entity.attributes) {
            entity.attributes.forEach(attr => {
              if ((attr.type === 'fk' || attr.type === 'event_id' || attr.type === 'entity_id' || attr.type === 'resource_id') && attr.ref) {
                const [targetEntity] = attr.ref.split('.');
                relationEdges.push({
                  id: `${entity.name}-${targetEntity}`,
                  source: entity.name,
                  sourceHandle: 'source-right',
                  target: targetEntity,
                  targetHandle: 'target-left',
                  animated: true,
                  type: 'smoothstep',
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

        // Hydrate positions from layoutMap
        const hydratedNodes = applyLayoutToNodes(entityNodes, layoutMap);

        setNodes(hydratedNodes);
        setEdges(relationEdges);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch (error) {
      setDbSchema(null);
      setNodes([]);
      setEdges([]);
    }
  }, [yamlContent, theme, schemaId, layoutMap, applyLayoutToNodes]);
  
  // Handle connecting nodes
  const onConnect = useCallback(
    (params) => {
      // Validate connection params
      if (!params.source || !params.target) {
        console.error('Invalid connection params:', params);
        return;
      }
      
      if (dbSchema) {
        // Create a deep copy to avoid direct state mutation
        const updatedSchema = JSON.parse(JSON.stringify(dbSchema));

        // ... logic to modify updatedSchema based on new connection (params) ...
        // Example: Add relationship

        if (!updatedSchema.relationships) {
            updatedSchema.relationships = [];
        }
        updatedSchema.relationships.push({
            from: params.source,
            to: params.target,
            type: 'one-to-many' // Example type
        });

        // Update the internal state
        setDbSchema(updatedSchema);

        // Call the callback with the updated OBJECT
        if (onDiagramChange) {
          console.log("[ERDiagram] Calling onDiagramChange with updated schema object after connect:", updatedSchema);
          onDiagramChange(updatedSchema);
        }
      }
    },
    [dbSchema, onDiagramChange, setEdges]
  );
  
  // Handle node movement
  const onNodeDragStop = useCallback(
    (event, node) => {
      setNodes(nds =>
        nds.map(n => n.id === node.id ? { ...n, position: node.position } : n)
      );
      // Update layoutMap in state (triggers debounced save)
      setLayoutMap(prev => ({
        ...prev,
        [node.id]: { ...node.position }
      }));
    },
    [setNodes]
  );
  
  // Helper function to save node position to localStorage
  const saveNodePosition = useCallback((nodeId, position) => {
    if (!schemaId) return;
    
    try {
      const savedData = localStorage.getItem(schemaId);
      let positions = savedData ? JSON.parse(savedData) : {};
      
      positions[nodeId] = position;
      localStorage.setItem(schemaId, JSON.stringify(positions));
      console.log(`[ERDiagram] Saved position for ${nodeId}:`, position);
    } catch (err) {
      console.error('[ERDiagram] Error saving position to localStorage:', err);
    }
  }, [schemaId]);
  
  // Save all current node positions to layoutMap (e.g., before YAML changes)
  const saveAllNodePositions = useCallback(() => {
    setLayoutMap(extractLayoutMap(currentNodesRef.current));
  }, [extractLayoutMap]);

  // Handle node deletion
  const onNodesDelete = useCallback(
    (deletedNodes) => {
      if (dbSchema) {
        // Create a deep copy
        const updatedSchema = JSON.parse(JSON.stringify(dbSchema));

        // Logic to remove entities/relationships from updatedSchema based on deletedNodes
        const deletedIds = deletedNodes.map(n => n.id);

        if (updatedSchema.entities) {
            updatedSchema.entities = updatedSchema.entities.filter(
                entity => !deletedIds.includes(entity.name)
            );
        }
        if (updatedSchema.relationships) {
            updatedSchema.relationships = updatedSchema.relationships.filter(
                rel => !deletedIds.includes(rel.from) && !deletedIds.includes(rel.to)
            );
        }

        // Update internal state
        setDbSchema(updatedSchema);

        // Call the callback with the updated OBJECT
        if (onDiagramChange) {
          console.log("[ERDiagram] Calling onDiagramChange with updated schema object after delete:", updatedSchema);
          onDiagramChange(updatedSchema);
        }
        
        // Remove the deleted node positions from localStorage
        if (schemaId) {
          try {
            const savedData = localStorage.getItem(schemaId);
            if (savedData) {
              let positions = JSON.parse(savedData);
              
              // Remove positions for all deleted nodes
              deletedIds.forEach(id => {
                if (positions[id]) {
                  console.log(`[ERDiagram] Removing position for deleted node: ${id}`);
                  delete positions[id];
                }
              });
              
              // Save the updated positions back to localStorage
              localStorage.setItem(schemaId, JSON.stringify(positions));
            }
          } catch (err) {
            console.error('[ERDiagram] Error updating positions in localStorage after deletion:', err);
          }
        }
      }
    },
    [dbSchema, onDiagramChange, schemaId]
  );

  // Handle node double click
  const onNodeDoubleClick = useCallback(
    (event, node) => {
      setSelectedNode(node);
      setShowNodeModal(true);
    },
    []
  );

  // Handle entity update from EntityEditor
  const handleEntityUpdate = useCallback((updatedEntity) => {
      if (dbSchema && selectedNode) {
         // Create a deep copy
        const updatedSchema = JSON.parse(JSON.stringify(dbSchema));

        // Find and update the entity in the schema
        const entityIndex = updatedSchema.entities.findIndex(e => e.name === selectedNode.id);
        if (entityIndex !== -1) {
            // Update the entity with the new data from EntityEditor
            updatedSchema.entities[entityIndex] = {
                name: updatedEntity.name,
                ...(updatedEntity.type && { type: updatedEntity.type }),
                rows: updatedEntity.rows,
                attributes: updatedEntity.attributes
            };
        }

        // Update internal state
        setDbSchema(updatedSchema);

        // Call the callback with the updated OBJECT
        if (onDiagramChange) {
          console.log("[ERDiagram] Calling onDiagramChange with updated schema object after entity update:", updatedSchema);
          onDiagramChange(updatedSchema);
        }
      }
  }, [dbSchema, onDiagramChange, selectedNode]);

  // Handle entity deletion from EntityEditor
  const handleEntityDelete = useCallback((entity) => {
    if (selectedNode) {
      console.log("[ERDiagram] Deleting entity from EntityEditor:", selectedNode);
      onNodesDelete([selectedNode]);
    }
  }, [onNodesDelete, selectedNode]);

  // Legacy function for backward compatibility
  const handleNodeUpdate = useCallback((updatedNodeData) => {
      if (dbSchema) {
         // Create a deep copy
        const updatedSchema = JSON.parse(JSON.stringify(dbSchema));

        // Find and update the entity in the schema
        const entityIndex = updatedSchema.entities.findIndex(e => e.name === updatedNodeData.id);
        if (entityIndex !== -1) {
            // Update attributes, name, etc. based on updatedNodeData.data
            updatedSchema.entities[entityIndex] = {
                // Reconstruct the entity based on modal data
                // This needs careful mapping from node data back to schema structure
                name: updatedNodeData.data.label,
                type: updatedNodeData.data.tableType || undefined, // Include table type, but don't add if empty
                attributes: updatedNodeData.data.attributes, // Assuming modal updates attributes directly
                // ... other entity properties ...
            };
        }

        // Update internal state
        setDbSchema(updatedSchema);

        // Call the callback with the updated OBJECT
        if (onDiagramChange) {
          console.log("[ERDiagram] Calling onDiagramChange with updated schema object after node update:", updatedSchema);
          onDiagramChange(updatedSchema);
        }
      }
  }, [dbSchema, onDiagramChange]);

  // Wrapper function to handle node deletion from the modal
  const handleNodeDelete = useCallback((node) => {
    // Convert single node to array before passing to onNodesDelete
    if (node) {
      console.log("[ERDiagram] Deleting node from modal:", node);
      onNodesDelete([node]);
    }
  }, [onNodesDelete]);

  // If not initialized, just show the container to get dimensions
  if (!initialized) {
    return (
      <div 
        ref={containerRef} 
        className="er-diagram-container" 
        style={{ 
          width: '100%', 
          // height: '600px', // Let parent control height
          // border: '1px solid #ddd', // REMOVE inline border
          borderRadius: '4px',
          overflow: 'hidden'
        }} 
      />
    );
  }
  
  return (
    <div ref={containerRef} className="er-diagram-container">
      {initialized && (
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            attributionPosition="bottom-right"
            nodesDraggable={true}
            elementsSelectable={true}
          >
            <Controls position="bottom-right" />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </>
      )}
      <EntityEditor
        show={showNodeModal}
        onHide={() => setShowNodeModal(false)}
        entity={selectedNode ? {
          name: selectedNode.id,
          type: selectedNode.data?.tableType,
          rows: selectedNode.data?.rows,
          attributes: selectedNode.data?.attributes || []
        } : null}
        onEntityUpdate={handleEntityUpdate}
        onEntityDelete={handleEntityDelete}
        theme={theme}
      />
    </div>
  );
};

export default ERDiagram; 