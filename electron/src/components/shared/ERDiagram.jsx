import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import yaml from 'yaml';
import EntityEditor from './EntityEditor';
import { FiKey, FiLink } from 'react-icons/fi';
import { 
  handleTableConnection, 
  handleEdgeDeletion, 
  handleTableDeletion,
  validateConnection,
  getSuggestedConnectionTypes 
} from './ERDiagramConnectionHandler';

// Custom Entity Node component with enhanced connection handles
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

  // Get handle tooltip based on table type and position
  const getHandleTooltip = (position, type) => {
    if (type === 'source') {
      return `Connect from ${data.label} to another table (creates foreign key in ${data.label})`;
    } else {
      return `Connect to ${data.label} from another table (creates foreign key in source table)`;
    }
  };

  return (
    <div className={`entity-node ${getNodeTypeClass()}`}>
      {/* Connection handles with enhanced styling and tooltips */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="target-top"
        className="connection-handle connection-handle--target"
        title={getHandleTooltip('top', 'target')}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="source-right"
        className="connection-handle connection-handle--source"
        title={getHandleTooltip('right', 'source')}
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        id="target-left"
        className="connection-handle connection-handle--target"
        title={getHandleTooltip('left', 'target')}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="source-bottom"
        className="connection-handle connection-handle--source"
        title={getHandleTooltip('bottom', 'source')}
      />
      
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
            title={attr.ref ? `References: ${attr.ref}` : ''}
          >
            {(attr.type === 'pk') && <FiKey className="key-icon" />}
            {(attr.type === 'fk' || attr.type === 'event_id' || attr.type === 'entity_id' || attr.type === 'resource_id') && <FiLink className="key-icon" />}
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
  const internalUpdateRef = useRef(false);


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
    // Skip re-parsing if this update came from an internal diagram change
    if (internalUpdateRef.current) {
      console.log('[ERDiagram] Skipping YAML re-parse - internal update');
      internalUpdateRef.current = false;
      return;
    }

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
                    type: 'arrowclosed',
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
  
  // Handle connecting nodes with automatic foreign key generation
  const onConnect = useCallback(
    (params) => {
      console.log('[ERDiagram] Connection attempt:', params);
      
      // Validate connection
      if (!validateConnection(params, dbSchema)) {
        console.warn('[ERDiagram] Invalid connection attempt');
        return;
      }
      
      // Use the enhanced connection handler
      const updatedSchema = handleTableConnection(
        params, 
        dbSchema, 
        (newSchema) => {
          // Update internal state
          setDbSchema(newSchema);
          
          // Set flag to prevent circular update
          internalUpdateRef.current = true;
          
          // Notify parent component
          if (onDiagramChange) {
            console.log("[ERDiagram] Calling onDiagramChange with updated schema after auto-FK creation");
            onDiagramChange(newSchema);
          }
        }
      );
      
      if (updatedSchema) {
        // Update visual nodes to reflect the new foreign key immediately
        setNodes((currentNodes) => {
          return currentNodes.map(node => {
            if (node.id === params.source) {
              // Find the updated entity from the schema
              const updatedEntity = updatedSchema.entities.find(e => e.name === params.source);
              if (updatedEntity) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    attributes: updatedEntity.attributes || []
                  }
                };
              }
            }
            return node;
          });
        });

        // Add the visual edge
        setEdges((eds) => addEdge({
          ...params,
          animated: true,
          type: 'smoothstep',
          style: { stroke: '#3498db' },
          markerEnd: {
            type: 'arrowclosed',
            width: 20,
            height: 20,
            color: '#3498db',
          }
        }, eds));
      }
    },
    [dbSchema, onDiagramChange, setEdges]
  );
  
  // Handle node movement
  const onNodeDragStop = useCallback(
    (_event, node) => {
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
  
  

  // Handle node deletion with enhanced foreign key cleanup
  const onNodesDelete = useCallback(
    (deletedNodes) => {
      if (dbSchema) {
        const deletedIds = deletedNodes.map(n => n.id);
        
        // Use the enhanced table deletion handler
        handleTableDeletion(
          deletedIds,
          dbSchema,
          (newSchema) => {
            // Update internal state
            setDbSchema(newSchema);
            
            // Update visual nodes to remove deleted tables and update foreign keys immediately
            setNodes(currentNodes => {
              // First filter out deleted nodes
              const remainingNodes = currentNodes.filter(node => !deletedIds.includes(node.id));
              
              // Then update remaining nodes to reflect foreign key cleanup
              return remainingNodes.map(node => {
                const updatedEntity = newSchema.entities.find(e => e.name === node.id);
                if (updatedEntity) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      attributes: updatedEntity.attributes || []
                    }
                  };
                }
                return node;
              });
            });
            
            // Remove edges connected to deleted nodes
            setEdges(currentEdges => 
              currentEdges.filter(edge => 
                !deletedIds.includes(edge.source) && !deletedIds.includes(edge.target)
              )
            );
            
            // Set flag to prevent circular update
            internalUpdateRef.current = true;
            
            // Notify parent component
            if (onDiagramChange) {
              console.log("[ERDiagram] Calling onDiagramChange with updated schema after table deletion");
              onDiagramChange(newSchema);
            }
          }
        );
        
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

  // Handle edge deletion with automatic foreign key removal
  const onEdgesDelete = useCallback(
    (deletedEdges) => {
      console.log('[ERDiagram] Edge deletion:', deletedEdges);
      
      if (dbSchema && deletedEdges.length > 0) {
        handleEdgeDeletion(
          deletedEdges,
          dbSchema,
          (newSchema) => {
            // Update internal state
            setDbSchema(newSchema);
            
            // Update visual nodes to reflect foreign key removal immediately
            setNodes((currentNodes) => {
              return currentNodes.map(node => {
                // Check if this node was affected by the edge deletion
                const wasSourceOfDeletedEdge = deletedEdges.some(edge => edge.source === node.id);
                if (wasSourceOfDeletedEdge) {
                  // Find the updated entity from the schema
                  const updatedEntity = newSchema.entities.find(e => e.name === node.id);
                  if (updatedEntity) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        attributes: updatedEntity.attributes || []
                      }
                    };
                  }
                }
                return node;
              });
            });
            
            // Set flag to prevent circular update
            internalUpdateRef.current = true;
            
            // Notify parent component
            if (onDiagramChange) {
              console.log("[ERDiagram] Calling onDiagramChange with updated schema after FK removal");
              onDiagramChange(newSchema);
            }
          }
        );
      }
    },
    [dbSchema, onDiagramChange]
  );

  // Handle node double click
  const onNodeDoubleClick = useCallback(
    (_event, node) => {
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

        // Set flag to prevent circular update
        internalUpdateRef.current = true;

        // Call the callback with the updated OBJECT
        if (onDiagramChange) {
          console.log("[ERDiagram] Calling onDiagramChange with updated schema object after entity update:", updatedSchema);
          onDiagramChange(updatedSchema);
        }
      }
  }, [dbSchema, onDiagramChange, selectedNode]);

  // Handle entity deletion from EntityEditor
  const handleEntityDelete = useCallback((_entity) => {
    if (selectedNode) {
      console.log("[ERDiagram] Deleting entity from EntityEditor:", selectedNode);
      onNodesDelete([selectedNode]);
    }
  }, [onNodesDelete, selectedNode]);


  // If not initialized, just show the container to get dimensions
  if (!initialized) {
    return (
      <div 
        ref={containerRef} 
        className="er-diagram-container" 
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
    <div ref={containerRef} className="er-diagram-container" style={{ width: '100%', height: '100%' }}>
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
            onEdgesDelete={onEdgesDelete}
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