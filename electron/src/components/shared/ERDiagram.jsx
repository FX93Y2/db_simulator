import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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

const ERDiagram = forwardRef(({ yamlContent, onDiagramChange, theme }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Canonical entity state - this is now the source of truth
  const [canonicalEntities, setCanonicalEntities] = useState([]);
  const [dbSchema, setDbSchema] = useState(null);
  
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [schemaId, setSchemaId] = useState(null);
  const currentNodesRef = useRef([]);
  const [layoutMap, setLayoutMap] = useState({});
  
  // Track if we're updating from internal canvas operations
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
      console.log('[ERDiagram] Container dimensions:', {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
        clientWidth: containerRef.current.clientWidth,
        clientHeight: containerRef.current.clientHeight
      });
      setInitialized(true);
    }
  }, []);

  // Direct manipulation methods - Canvas is source of truth
  const addEntity = useCallback((entityData) => {
    console.log('[ERDiagram] Adding entity directly:', entityData);
    
    // Find a good position for the new entity
    const maxY = canonicalEntities.reduce((max, entity) => {
      const position = layoutMap[entity.name] || { y: 0 };
      return Math.max(max, position.y);
    }, 0);
    
    const newPosition = {
      x: 50 + (canonicalEntities.length % 3) * 300,
      y: maxY + 300
    };
    
    // Add to canonical entities
    const newEntity = {
      ...entityData,
      position: newPosition
    };
    
    setCanonicalEntities(prev => [...prev, newEntity]);
    
    // Update layout map
    setLayoutMap(prev => ({
      ...prev,
      [entityData.name]: newPosition
    }));
    
    // Set internal update flag to prevent YAML sync loops
    internalUpdateRef.current = true;
    
    return newEntity;
  }, [canonicalEntities, layoutMap]);

  const updateEntity = useCallback((entityId, newData) => {
    console.log('[ERDiagram] Updating entity:', entityId, newData);
    
    setCanonicalEntities(prev => prev.map(entity => 
      entity.name === entityId 
        ? { ...entity, ...newData, position: entity.position } // Preserve position
        : entity
    ));
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, []);

  const deleteEntity = useCallback((entityId) => {
    console.log('[ERDiagram] Deleting entity:', entityId);
    
    setCanonicalEntities(prev => prev.filter(entity => entity.name !== entityId));
    
    // Remove from layout map
    setLayoutMap(prev => {
      const newLayout = { ...prev };
      delete newLayout[entityId];
      return newLayout;
    });
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, []);

  const generateYAML = useCallback(() => {
    console.log('[ERDiagram] Generating YAML from canonical entities');
    
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
    console.log('[ERDiagram] Handling external YAML change, content length:', newYAMLContent?.length);
    console.log('[ERDiagram] YAML content preview:', newYAMLContent?.substring(0, 100));
    
    try {
      const parsedYAML = yaml.parse(newYAMLContent);
      const newEntities = parsedYAML?.entities || [];
      
      if (newEntities.length === 0) {
        console.log('[ERDiagram] WARNING: Empty entities detected!');
        console.log('[ERDiagram] Parsed YAML:', parsedYAML);
        console.log('[ERDiagram] Raw YAML content:', newYAMLContent);
        
        // Don't clear entities if we currently have entities - this prevents accidental clearing
        if (canonicalEntities.length > 0) {
          console.log('[ERDiagram] PREVENTING canvas clear - keeping existing', canonicalEntities.length, 'entities');
          return;
        }
        
        console.log('[ERDiagram] No existing entities, clearing canvas');
        setCanonicalEntities([]);
        return;
      }
      
      // Capture current node positions from ReactFlow
      const currentPositions = {};
      currentNodesRef.current.forEach(node => {
        currentPositions[node.id] = node.position;
      });
      
      // Detect what changed
      const changes = detectEntityChanges(canonicalEntities, newEntities);
      console.log('[ERDiagram] Detected changes:', {
        added: changes.added.length,
        deleted: changes.deleted.length,
        modified: changes.modified.length
      });
      
      // Apply changes while preserving positions
      const updatedEntities = newEntities.map(entity => {
        // Priority order for position: current ReactFlow position > existing entity position > layoutMap > default
        const currentPosition = currentPositions[entity.name];
        const existingEntity = canonicalEntities.find(e => e.name === entity.name);
        const existingPosition = existingEntity?.position;
        const layoutPosition = layoutMap[entity.name];
        
        let finalPosition;
        if (currentPosition) {
          finalPosition = currentPosition;
        } else if (existingPosition) {
          finalPosition = existingPosition;
        } else if (layoutPosition) {
          finalPosition = layoutPosition;
        } else {
          // Only for truly new entities without any position history
          const maxY = Object.values(currentPositions).reduce((max, pos) => Math.max(max, pos.y), 0);
          finalPosition = {
            x: 50 + (Object.keys(currentPositions).length % 3) * 300,
            y: Math.max(maxY + 300, 50)
          };
        }
        
        return {
          ...entity,
          position: finalPosition
        };
      });
      
      // Update canonical entities
      console.log('[ERDiagram] Setting canonical entities to:', updatedEntities.length, 'entities');
      setCanonicalEntities(updatedEntities);
      
      // Update dbSchema for compatibility with legacy code
      setDbSchema(parsedYAML);
      
      // Update layout map with current positions
      const newLayoutMap = { ...layoutMap };
      updatedEntities.forEach(entity => {
        if (entity.position) {
          newLayoutMap[entity.name] = entity.position;
        }
      });
      setLayoutMap(newLayoutMap);
      
    } catch (error) {
      console.error('[ERDiagram] Invalid YAML, ignoring changes:', error);
      // Could show a warning to the user here
    }
  }, [canonicalEntities, layoutMap, detectEntityChanges]);

  // Update visual nodes and edges from canonical entities
  useEffect(() => {
    console.log('[ERDiagram] Updating visual nodes from canonical entities:', canonicalEntities.length);
    console.log('[ERDiagram] Current canonical entities:', canonicalEntities.map(e => e.name));
    
    if (canonicalEntities.length === 0) {
      console.log('[ERDiagram] WARNING: Setting nodes and edges to empty arrays!');
      setNodes([]);
      setEdges([]);
      return;
    }

    // Generate visual nodes
    const visualNodes = canonicalEntities.map(entity => {
      const position = layoutMap[entity.name] || entity.position || { x: 50, y: 50 };
      
      return {
        id: entity.name,
        type: 'entity',
        position: position,
        data: {
          label: entity.name,
          tableType: entity.type || '',
          rows: entity.rows || 100,
          attributes: entity.attributes || []
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
                label: attr.name,
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

    setNodes(visualNodes);
    setEdges(visualEdges);
    
    // Notify parent of changes if this was an internal update
    if (internalUpdateRef.current && onDiagramChange) {
      const generatedYAML = generateYAML();
      console.log('[ERDiagram] Notifying parent of internal changes');
      onDiagramChange(generatedYAML);
      internalUpdateRef.current = false;
    }
  }, [canonicalEntities, layoutMap, onDiagramChange, generateYAML]);

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

  // Legacy YAML parsing - now handled by handleYAMLChange method
  // This useEffect is disabled in favor of the new canvas-first architecture
  useEffect(() => {
    // Skip all legacy YAML parsing - now handled by handleYAMLChange
    console.log('[ERDiagram] Legacy YAML parsing disabled - using canvas-first architecture');
    return;

    // Check if this is just adding new entities (not modifying existing ones)
    // If so, we can preserve existing node positions and only add new nodes
    let isAddingNewEntitiesOnly = false;
    try {
      if (yamlContent && currentNodesRef.current.length > 0) {
        const parsedYaml = yaml.parseDocument(yamlContent).toJSON();
        if (parsedYaml && parsedYaml.entities) {
          const currentEntityNames = new Set(currentNodesRef.current.map(n => n.id));
          const newEntityNames = new Set(parsedYaml.entities.map(e => e.name));
          
          // Check if all current entities still exist and no entities were removed
          const hasAllCurrentEntities = [...currentEntityNames].every(name => newEntityNames.has(name));
          const hasNewEntities = newEntityNames.size > currentEntityNames.size;
          
          if (hasAllCurrentEntities && hasNewEntities) {
            isAddingNewEntitiesOnly = true;
            console.log('[ERDiagram] Detected addition of new entities only - preserving existing positions');
          }
        }
      }
    } catch (error) {
      console.log('[ERDiagram] Error checking for new entities only, proceeding with full re-parse');
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
        if (isAddingNewEntitiesOnly) {
          // Optimized path: only add new entities while preserving existing ones
          const currentEntityNames = new Set(currentNodesRef.current.map(n => n.id));
          const newEntities = parsedYaml.entities.filter(entity => !currentEntityNames.has(entity.name));
          
          if (newEntities.length > 0) {
            console.log('[ERDiagram] Adding', newEntities.length, 'new entities:', newEntities.map(e => e.name));
            
            // Create nodes for new entities only
            const newEntityNodes = [];
            const newRelationEdges = [];
            const maxY = currentNodesRef.current.reduce((max, node) => Math.max(max, node.position.y), 0);
            
            newEntities.forEach((entity, index) => {
              // Position new tables below existing ones
              let position = layoutMap[entity.name] || { 
                x: (index % 3) * 300 + 50, 
                y: maxY + 300 + Math.floor(index / 3) * 300 
              };

              newEntityNodes.push({
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

              // Create edges for relationships from new entities
              if (entity.attributes) {
                entity.attributes.forEach(attr => {
                  if ((attr.type === 'fk' || attr.type === 'event_id' || attr.type === 'entity_id' || attr.type === 'resource_id') && attr.ref) {
                    const [targetEntity] = attr.ref.split('.');
                    newRelationEdges.push({
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

            // Add new nodes to existing ones
            setNodes(prevNodes => [...prevNodes, ...newEntityNodes]);
            
            // Add new edges, but also regenerate all edges to catch new relationships to new entities
            const allEdges = [];
            parsedYaml.entities.forEach(entity => {
              if (entity.attributes) {
                entity.attributes.forEach(attr => {
                  if ((attr.type === 'fk' || attr.type === 'event_id' || attr.type === 'entity_id' || attr.type === 'resource_id') && attr.ref) {
                    const [targetEntity] = attr.ref.split('.');
                    allEdges.push({
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
            setEdges(allEdges);
          }
        } else {
          // Full re-parse path: rebuild everything
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
        }
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch (error) {
      setDbSchema(null);
      setNodes([]);
      setEdges([]);
    }
  }, []); // Disabled - no dependencies so it only runs once
  
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
      
      // Update canonical entities with new position
      setCanonicalEntities(prev => prev.map(entity => 
        entity.name === node.id 
          ? { ...entity, position: node.position }
          : entity
      ));
      
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
      if (selectedNode) {
        console.log("[ERDiagram] Updating entity via EntityEditor:", updatedEntity);
        
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
      console.log("[ERDiagram] Deleting entity from EntityEditor:", selectedNode);
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
});

ERDiagram.displayName = 'ERDiagram';

export default ERDiagram; 