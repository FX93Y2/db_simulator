import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import yaml from 'yaml';
import { useCanvasPositions } from '../../hooks/useCanvasPositions';
import EntityEditor from './EntityEditor';
import { FiKey, FiLink } from 'react-icons/fi';
import { 
  handleTableConnection, 
  handleEdgeDeletion, 
  handleTableDeletion,
  validateConnection,
  getSuggestedConnectionTypes 
} from './ERDiagramConnectionHandler';

// Function to sort attributes: primary key first, then foreign keys, then others
const sortAttributes = (attributes) => {
  if (!attributes || attributes.length === 0) return [];
  
  return [...attributes].sort((a, b) => {
    // Primary key gets highest priority (0)
    const aPriority = a.type === 'pk' ? 0 : 
                     (a.type === 'fk' || a.type === 'event_id' || a.type === 'entity_id' || a.type === 'resource_id') ? 1 : 2;
    const bPriority = b.type === 'pk' ? 0 : 
                     (b.type === 'fk' || b.type === 'event_id' || b.type === 'entity_id' || b.type === 'resource_id') ? 1 : 2;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If same priority, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
};

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
        {sortAttributes(data.attributes).map((attr, index) => (
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

const ERDiagram = forwardRef(({ yamlContent, onDiagramChange, theme, projectId }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Canonical entity state - this is now the source of truth
  const [canonicalEntities, setCanonicalEntities] = useState([]);
  const [dbSchema, setDbSchema] = useState(null);
  
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  
  // Track if we're updating from internal canvas operations
  const internalUpdateRef = useRef(false);
  
  const positions = useCanvasPositions(yamlContent, 'er_diagram_positions', projectId, true);


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

  // Direct manipulation methods - Canvas is source of truth
  const addEntity = useCallback((entityData) => {
    // Calculate viewport-centered position for new entity
    let newPosition;
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      
      // Add some randomness to avoid stacking entities exactly on top of each other
      const offsetX = (canonicalEntities.length % 3 - 1) * 50;
      const offsetY = Math.floor(canonicalEntities.length / 3) * 50;
      
      newPosition = {
        x: Math.max(50, centerX - 100 + offsetX),
        y: Math.max(50, centerY - 100 + offsetY)
      };
    } else {
      // Fallback to grid positioning
      newPosition = {
        x: 50 + (canonicalEntities.length % 3) * 300,
        y: 100 + Math.floor(canonicalEntities.length / 3) * 200
      };
    }
    
    // Add to canonical entities
    const newEntity = {
      ...entityData,
      position: newPosition,
      attributes: sortAttributes(entityData.attributes || [])
    };
    
    setCanonicalEntities(prev => [...prev, newEntity]);
    
    // Update position in hook
    positions.updateItemPosition(entityData.name, newPosition);
    
    // Set internal update flag to prevent YAML sync loops
    internalUpdateRef.current = true;
    
    return newEntity;
  }, [canonicalEntities, positions]);

  const updateEntity = useCallback((entityId, newData) => {
    
    // Check if name is changing
    const isNameChanging = newData.name && newData.name !== entityId;
    
    setCanonicalEntities(prev => prev.map(entity => 
      entity.name === entityId 
        ? { 
            ...entity, 
            ...newData, 
            position: entity.position, // Preserve position
            attributes: sortAttributes(newData.attributes || entity.attributes || []) // Sort attributes
          }
        : entity
    ));
    
    // If name is changing, update position mapping
    if (isNameChanging) {
      positions.updateItemId(entityId, newData.name);
    }
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, [positions]);

  const deleteEntity = useCallback((entityId) => {
    
    // Use the same foreign key cleanup logic as onNodesDelete
    if (dbSchema) {
      handleTableDeletion(
        [entityId], // Array of deleted table names
        dbSchema,
        (newSchema) => {
          // Update internal state
          setDbSchema(newSchema);
          
          // Update canonical entities to reflect the deletion and foreign key cleanup
          setCanonicalEntities(prev => {
            // Remove deleted entity and update remaining entities with cleaned foreign keys
            const updatedCanonical = prev
              .filter(entity => entity.name !== entityId) // Remove deleted entity
              .map(entity => {
                // Update remaining entities with cleaned foreign keys from newSchema
                const updatedEntity = newSchema.entities.find(e => e.name === entity.name);
                if (updatedEntity) {
                  return {
                    ...entity,
                    attributes: sortAttributes(updatedEntity.attributes || []) // Apply foreign key cleanup and sorting
                  };
                }
                return entity;
              });
              
            return updatedCanonical;
          });
          
          // Set internal update flag to notify parent of changes
          internalUpdateRef.current = true;
          
          // Notify parent component
          if (onDiagramChange) {
            onDiagramChange(yaml.stringify(newSchema));
          }
        }
      );
    } else {
      // Fallback: simple deletion without foreign key cleanup if dbSchema not available
      setCanonicalEntities(prev => prev.filter(entity => entity.name !== entityId));
      internalUpdateRef.current = true;
    }
    
    // Remove position
    positions.removeItemPositions([entityId]);
  }, [dbSchema, onDiagramChange]);

  const generateYAML = useCallback(() => {
    const yamlObject = {
      entities: canonicalEntities.map(entity => ({
        name: entity.name,
        ...(entity.type && { type: entity.type }),
        rows: entity.rows || 100,
        attributes: entity.attributes || []
      }))
    };
    
    return yaml.stringify(yamlObject);
  }, [canonicalEntities]);

  // Utility function to detect entity changes
  const detectEntityChanges = useCallback((oldEntities, newEntities) => {
    const oldNames = new Set(oldEntities.map(e => e.name));
    const newNames = new Set(newEntities.map(e => e.name));
    
    const added = newEntities.filter(e => !oldNames.has(e.name));
    const deleted = oldEntities.filter(e => !newNames.has(e.name));
    const modified = newEntities.filter(e => {
      const oldEntity = oldEntities.find(old => old.name === e.name);
      if (!oldEntity) return false;
      
      // Deep comparison of entity properties (excluding position)
      const oldClean = { ...oldEntity };
      delete oldClean.position;
      const newClean = { ...e };
      delete newClean.position;
      
      return JSON.stringify(oldClean) !== JSON.stringify(newClean);
    });
    
    return { added, deleted, modified };
  }, []);

  // Handle YAML changes from external sources (like YAML editor)
  const handleYAMLChange = useCallback((newYAMLContent) => {
    console.log(`[ERDiagram] handleYAMLChange called:`, {
      contentLength: newYAMLContent?.length,
      isInitialLoad: positions.isInitialLoad,
      layoutMapSize: Object.keys(positions.layoutMap).length,
      canonicalEntitiesCount: canonicalEntities.length,
      storageReady: positions.isStorageReady(),
      layoutMapReady: positions.layoutMapReady
    });
    
    // CRITICAL: Don't process YAML until positions are ready
    if (!positions.isStorageReady() || !positions.layoutMapReady) {
      console.log(`[ERDiagram] handleYAMLChange: Aborting - position storage not ready`);
      return;
    }
    
    // Ensure we have a string
    if (typeof newYAMLContent !== 'string') {
      return;
    }
    
    try {
      const parsedYAML = yaml.parse(newYAMLContent);
      const newEntities = parsedYAML?.entities || [];
      
      // Skip if this looks like simulation YAML (has steps) rather than database YAML
      if (parsedYAML?.steps) {
        return;
      }
      
      if (newEntities.length === 0) {
        // Don't clear entities if we currently have entities - this prevents accidental clearing
        if (canonicalEntities.length > 0) {
          return;
        }
        
        setCanonicalEntities([]);
        return;
      }
      
      // Use position hook to resolve positions
      const updatedEntities = positions.resolvePositions(newEntities.map(entity => ({
        ...entity,
        attributes: sortAttributes(entity.attributes || []) // Sort attributes
      })));
      
      // Check for structural changes
      const hasStructuralChanges = JSON.stringify(canonicalEntities.map(e => {
        const { position, ...entity } = e;
        return entity;
      })) !== JSON.stringify(newEntities);
      
      if (hasStructuralChanges || canonicalEntities.length !== updatedEntities.length) {
        setCanonicalEntities(updatedEntities);
        // Only complete initial load if we successfully loaded and applied saved positions
        // OR if there were no saved positions to begin with
        const hasSavedPositions = Object.keys(positions.layoutMap).length > 0;
        const appliedSavedPositions = hasSavedPositions && updatedEntities.some(e => 
          positions.layoutMap[e.name] && 
          e.position.x === positions.layoutMap[e.name].x && 
          e.position.y === positions.layoutMap[e.name].y
        );
        
        if (!hasSavedPositions || appliedSavedPositions) {
          positions.completeInitialLoad();
        }
      }
      
      // Update dbSchema for compatibility with legacy code
      setDbSchema(parsedYAML);
      
    } catch (error) {
      // Invalid YAML, ignore changes
    }
  }, [canonicalEntities, positions.layoutMap, positions.isInitialLoad, positions.isStorageReady, positions.layoutMapReady]);

  // Update visual nodes and edges from canonical entities
  useEffect(() => {
    if (canonicalEntities.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Generate visual nodes
    const visualNodes = canonicalEntities.map(entity => {
      const position = entity.position || { x: 50, y: 50 };
      
      console.log(`[ERDiagram] Creating visual node for ${entity.name}:`, {
        savedPosition: positions.layoutMap[entity.name],
        entityPosition: entity.position,
        finalPosition: position,
        isInitialLoad: positions.isInitialLoad
      });
      
      return {
        id: entity.name,
        type: 'entity',
        position: position,
        data: {
          label: entity.name,
          tableType: entity.type || '',
          rows: entity.rows || 100,
          attributes: sortAttributes(entity.attributes || [])
        },
        width: 200,
        height: 100 + (entity.attributes?.length || 0) * 25,
      };
    });

    // Generate visual edges from foreign key relationships
    const visualEdges = [];
    canonicalEntities.forEach(entity => {
      if (entity.attributes) {
        entity.attributes.forEach(attr => {
          if ((attr.type === 'fk' || attr.type === 'event_id' || attr.type === 'entity_id' || attr.type === 'resource_id') && attr.ref) {
            const [targetEntity] = attr.ref.split('.');
            // Only create edge if target entity exists in canonical entities
            if (canonicalEntities.find(e => e.name === targetEntity)) {
              visualEdges.push({
                id: `${entity.name}-${targetEntity}`,
                source: entity.name,
                sourceHandle: 'source-right',
                target: targetEntity,
                targetHandle: 'target-left',
                animated: true,
                type: 'smoothstep',
                style: { stroke: '#3498db' },
                markerEnd: {
                  type: 'arrowclosed',
                  width: 20,
                  height: 20,
                  color: '#3498db',
                },
              });
            }
          }
        });
      }
    });

    console.log(`[ERDiagram] Setting ${visualNodes.length} visual nodes:`, visualNodes.map(n => ({ id: n.id, position: n.position })));
    setNodes(visualNodes);
    setEdges(visualEdges);
    
    // Update dbSchema to stay in sync with canonicalEntities for connection validation
    setDbSchema({
      entities: canonicalEntities.map(entity => ({
        name: entity.name,
        type: entity.type,
        rows: entity.rows,
        attributes: entity.attributes || []
      }))
    });
    
    // Notify parent of changes if this was an internal update
    if (internalUpdateRef.current && onDiagramChange) {
      const generatedYAML = generateYAML();
      onDiagramChange(generatedYAML);
      internalUpdateRef.current = false;
    }
  }, [canonicalEntities, onDiagramChange, generateYAML]);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    addEntity,
    updateEntity,
    deleteEntity,
    generateYAML,
    handleYAMLChange,
    getCanonicalEntities: () => canonicalEntities
  }), [addEntity, updateEntity, deleteEntity, generateYAML, handleYAMLChange, canonicalEntities]);

  // Generate a consistent ID for the schema based on its entities

  // Handle external YAML updates
  useEffect(() => {
    console.log(`[ERDiagram] External YAML effect triggered:`, {
      hasYamlContent: !!yamlContent,
      internalUpdate: internalUpdateRef.current,
      storageReady: positions.isStorageReady(),
      layoutMapReady: positions.layoutMapReady,
      isInitialLoad: positions.isInitialLoad,
      layoutMapSize: Object.keys(positions.layoutMap).length
    });
    
    // Skip if this was triggered by internal changes
    if (internalUpdateRef.current) {
      console.log(`[ERDiagram] Skipping - internal update`);
      return;
    }
    
    // Skip if no YAML content
    if (!yamlContent) {
      console.log(`[ERDiagram] Skipping - no YAML content`);
      return;
    }
    
    // Wait for position storage to be ready
    if (!positions.isStorageReady()) {
      console.log(`[ERDiagram] Skipping - storage not ready`);
      return;
    }
    
    // Wait for layoutMap to be ready from localStorage
    if (!positions.layoutMapReady) {
      console.log(`[ERDiagram] Skipping - waiting for layoutMap to be ready`);
      return;
    }
    
    console.log(`[ERDiagram] Calling handleYAMLChange`);
    handleYAMLChange(yamlContent);
  }, [yamlContent, positions.layoutMapReady]);
  
  // Handle connecting nodes with automatic foreign key generation
  const onConnect = useCallback(
    (params) => {
      
      // Validate connection
      if (!validateConnection(params, dbSchema)) {
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
            onDiagramChange(yaml.stringify(newSchema));
          }
        }
      );
      
      if (updatedSchema) {
        // Update canonical entities to reflect the new foreign key
        setCanonicalEntities(prev => {
          return prev.map(entity => {
            if (entity.name === params.source) {
              // Find the updated entity from the schema
              const updatedEntity = updatedSchema.entities.find(e => e.name === params.source);
              if (updatedEntity) {
                return {
                  ...entity,
                  attributes: updatedEntity.attributes || []
                };
              }
            }
            return entity;
          });
        });

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
                    attributes: sortAttributes(updatedEntity.attributes || [])
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
      // Only update the visual nodes and layoutMap - don't modify canonicalEntities
      // This prevents regenerating the entire node structure and losing unsaved changes
      setNodes(nds =>
        nds.map(n => n.id === node.id ? { ...n, position: node.position } : n)
      );
      
      // Update position in canonical entities and position hook
      setCanonicalEntities(prev => prev.map(entity => 
        entity.name === node.id 
          ? { ...entity, position: node.position }
          : entity
      ));
      
      // Update position in hook for localStorage persistence
      positions.updateItemPosition(node.id, node.position);
    },
    [positions]
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
            
            // Update canonical entities to reflect the deletion and foreign key cleanup
            setCanonicalEntities(prev => {
              // Remove deleted entities and update remaining entities with cleaned foreign keys
              const updatedCanonical = prev
                .filter(entity => !deletedIds.includes(entity.name)) // Remove deleted entities
                .map(entity => {
                  // Update remaining entities with cleaned foreign keys from newSchema
                  const updatedEntity = newSchema.entities.find(e => e.name === entity.name);
                  if (updatedEntity) {
                    return {
                      ...entity,
                      attributes: sortAttributes(updatedEntity.attributes || []) // Apply foreign key cleanup and sorting
                    };
                  }
                  return entity;
                });
                
              return updatedCanonical;
            });
            
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
                      attributes: sortAttributes(updatedEntity.attributes || [])
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
              onDiagramChange(yaml.stringify(newSchema));
            }
          }
        );
        
        // Remove deleted node positions
        positions.removeItemPositions(deletedIds);
      }
    },
    [dbSchema, onDiagramChange, positions]
  );

  // Handle edge deletion with automatic foreign key removal
  const onEdgesDelete = useCallback(
    (deletedEdges) => {
      
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
              onDiagramChange(yaml.stringify(newSchema));
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
      if (selectedNode) {
        // Use the new updateEntity method
        updateEntity(selectedNode.id, {
          name: updatedEntity.name,
          type: updatedEntity.type,
          rows: updatedEntity.rows,
          attributes: updatedEntity.attributes
        });
      }
  }, [selectedNode, updateEntity]);

  // Handle entity deletion from EntityEditor
  const handleEntityDelete = useCallback((_entity) => {
    if (selectedNode) {
      // Use the new deleteEntity method
      deleteEntity(selectedNode.id);
    }
  }, [selectedNode, deleteEntity]);


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
            <Background key="er-diagram-background" variant="dots" gap={12} size={1} />
          </ReactFlow>
        </>
      )}
      <EntityEditor
        show={showNodeModal}
        onHide={() => setShowNodeModal(false)}
        entity={selectedNode ? (() => {
          // Get the most up-to-date entity data from canonicalEntities
          const canonicalEntity = canonicalEntities.find(e => e.name === selectedNode.id);
          if (canonicalEntity) {
            return {
              name: canonicalEntity.name,
              type: canonicalEntity.type,
              rows: canonicalEntity.rows,
              attributes: canonicalEntity.attributes || []
            };
          }
          // Fallback to visual node data if not found in canonical entities
          return {
            name: selectedNode.id,
            type: selectedNode.data?.tableType,
            rows: selectedNode.data?.rows,
            attributes: selectedNode.data?.attributes || []
          };
        })() : null}
        onEntityUpdate={handleEntityUpdate}
        onEntityDelete={handleEntityDelete}
        theme={theme}
      />
    </div>
  );
});

ERDiagram.displayName = 'ERDiagram';

export default ERDiagram; 