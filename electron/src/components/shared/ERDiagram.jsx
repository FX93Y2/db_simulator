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
import jsYaml from 'js-yaml';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { FiTrash2, FiEdit, FiX } from 'react-icons/fi';

// Node Details Modal Component
const NodeDetailsModal = ({ show, onHide, node, onNodeUpdate, onNodeDelete, theme }) => {
  const [name, setName] = useState('');
  const [attributes, setAttributes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form when node changes
  useEffect(() => {
    if (node) {
      setName(node.id || '');
      setAttributes(node.data?.attributes || []);
    }
  }, [node]);

  const handleSubmit = () => {
    setIsLoading(true);
    try {
      // Update node data
      const updatedNode = {
        ...node,
        id: name,
        data: {
          ...node.data,
          label: name,
          attributes: attributes
        }
      };
      
      onNodeUpdate(updatedNode);
      setIsLoading(false);
      onHide();
    } catch (error) {
      console.error('Error updating node:', error);
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setIsLoading(true);
    try {
      onNodeDelete(node);
      setIsLoading(false);
      onHide();
    } catch (error) {
      console.error('Error deleting node:', error);
      setIsLoading(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      backdrop="static"
      className="node-details-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>Entity Details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!node ? (
          <div className="text-center">
            <Spinner animation="border" />
          </div>
        ) : (
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Entity Name</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter entity name"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Attributes</Form.Label>
              <div className="attribute-list">
                {attributes.map((attr, index) => (
                  <div key={index} className="attribute-item d-flex align-items-center mb-2">
                    <Form.Control
                      className="me-2"
                      type="text"
                      value={attr.name}
                      onChange={(e) => {
                        const newAttrs = [...attributes];
                        newAttrs[index] = { ...attr, name: e.target.value };
                        setAttributes(newAttrs);
                      }}
                      placeholder="Attribute name"
                    />
                    <Form.Select
                      value={attr.type}
                      onChange={(e) => {
                        const newAttrs = [...attributes];
                        newAttrs[index] = { ...attr, type: e.target.value };
                        setAttributes(newAttrs);
                      }}
                    >
                      <option value="string">string</option>
                      <option value="integer">integer</option>
                      <option value="float">float</option>
                      <option value="boolean">boolean</option>
                      <option value="date">date</option>
                      <option value="pk">Primary Key</option>
                      <option value="fk">Foreign Key</option>
                    </Form.Select>
                    <Button
                      variant="link"
                      className="text-danger"
                      onClick={() => {
                        const newAttrs = attributes.filter((_, i) => i !== index);
                        setAttributes(newAttrs);
                      }}
                    >
                      <FiX />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setAttributes([...attributes, { name: '', type: 'string' }])}
                >
                  Add Attribute
                </Button>
              </div>
            </Form.Group>
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-danger" onClick={handleDelete} disabled={isLoading}>
          <FiTrash2 className="me-2" /> Delete Entity
        </Button>
        <Button variant="secondary" onClick={onHide} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? <Spinner size="sm" animation="border" className="me-2" /> : <FiEdit className="me-2" />}
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Custom Entity Node component
const EntityNode = ({ data, theme }) => {
  return (
    <div className="entity-node">
      <Handle type="target" position={Position.Top} id="target-top" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
      
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

const ERDiagram = ({ yamlContent, onDiagramChange, theme }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dbSchema, setDbSchema] = useState(null);
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const instanceId = useRef(`erdiagram-${Math.random().toString(36).substr(2, 9)}`);
  const lastYamlContent = useRef(yamlContent);
  const yamlParsingInProgress = useRef(false);

  // Log component mount/unmount
  useEffect(() => {
    console.log(`[ERDiagram ${instanceId.current}] Component mounted, initial YAML length: ${yamlContent ? yamlContent.length : 0}`);
    return () => {
      console.log(`[ERDiagram ${instanceId.current}] Component unmounting`);
    };
  }, []);

  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      console.log(`[ERDiagram ${instanceId.current}] Container ref initialized, setting initialized flag`);
      setInitialized(true);
    }
  }, []);

  // Parse YAML to extract entities
  useEffect(() => {
    try {
      console.log(`[ERDiagram ${instanceId.current}] YAML content effect triggered`, {
        hasContent: !!yamlContent,
        yamlLength: yamlContent ? yamlContent.length : 0,
        hasChanged: yamlContent !== lastYamlContent.current
      });

      if (!yamlContent) {
        console.log(`[ERDiagram ${instanceId.current}] No YAML content provided, skipping update`);
        return;
      }
      
      // Force parse on first run, or if content changed
      const shouldForceUpdate = !lastYamlContent.current || yamlContent !== lastYamlContent.current;
      
      // Skip only if the exact same content is already in progress
      if (!shouldForceUpdate && yamlParsingInProgress.current) {
        console.log(`[ERDiagram ${instanceId.current}] YAML parsing already in progress, skipping`);
        return;
      }

      // Update the ref to track current content
      lastYamlContent.current = yamlContent;
      yamlParsingInProgress.current = true;
      
      console.log(`[ERDiagram ${instanceId.current}] Processing YAML content...`);
      let parsedYaml;
      try {
        parsedYaml = jsYaml.load(yamlContent);
        console.log(`[ERDiagram ${instanceId.current}] YAML parsed successfully:`, {
          hasEntities: parsedYaml && !!parsedYaml.entities,
          entityCount: parsedYaml && parsedYaml.entities ? parsedYaml.entities.length : 0,
          yaml: yamlContent.substring(0, 100) + (yamlContent.length > 100 ? '...' : '')
        });
      } catch (parseError) {
        console.error(`[ERDiagram ${instanceId.current}] Error parsing YAML:`, parseError);
        yamlParsingInProgress.current = false;
        return;
      }
      
      // Always update dbSchema, even if it appears to be the same object
      // This ensures React will register the change
      setDbSchema(JSON.parse(JSON.stringify(parsedYaml)));
      
      if (parsedYaml && parsedYaml.entities) {
        console.log(`[ERDiagram ${instanceId.current}] Processing ${parsedYaml.entities.length} entities...`);
        const entityNodes = [];
        const relationEdges = [];
        
        // Create nodes for each entity
        parsedYaml.entities.forEach((entity, index) => {
          const xPos = (index % 3) * 300 + 50;
          const yPos = Math.floor(index / 3) * 300 + 50;
          
          console.log(`[ERDiagram ${instanceId.current}] Creating node for entity: ${entity.name}`);
          entityNodes.push({
            id: entity.name,
            type: 'entity',
            position: { x: xPos, y: yPos },
            data: { 
              label: entity.name,
              attributes: entity.attributes || []
            },
            width: 200,
            height: 100 + (entity.attributes?.length || 0) * 25,
          });
          
          // Create edges for relationships
          if (entity.attributes) {
            entity.attributes.forEach(attr => {
              if (attr.type === 'fk' && attr.ref) {
                const [targetEntity] = attr.ref.split('.');
                console.log(`[ERDiagram ${instanceId.current}] Creating edge: ${entity.name} -> ${targetEntity}`);
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
        
        console.log(`[ERDiagram ${instanceId.current}] Setting nodes (${entityNodes.length}) and edges (${relationEdges.length})`);
        setNodes(entityNodes);
        setEdges(relationEdges);
      } else {
        console.log(`[ERDiagram ${instanceId.current}] No entities found in YAML, clearing diagram`);
        setNodes([]);
        setEdges([]);
      }
      yamlParsingInProgress.current = false;
    } catch (error) {
      yamlParsingInProgress.current = false;
      console.error(`[ERDiagram ${instanceId.current}] Error processing YAML:`, error);
    }
  }, [yamlContent]);
  
  // Handle connecting nodes
  const onConnect = useCallback(
    (params) => {
      // Validate connection params
      if (!params.source || !params.target) {
        console.error(`[ERDiagram ${instanceId.current}] Invalid connection params:`, params);
        return;
      }
      
      console.log(`[ERDiagram ${instanceId.current}] Connection created: ${params.source} -> ${params.target}`);
      
      // When a connection is made, we need to update the YAML
      const newEdge = { 
        ...params, 
        id: `${params.source}-${params.target}`,
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#3498db' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#3498db',
        },
      };
      
      // Only proceed if dbSchema exists
      if (!dbSchema || !dbSchema.entities) {
        console.error(`[ERDiagram ${instanceId.current}] No schema available for edge creation`);
        return;
      }
      
      // Find the source and target entities
      const sourceEntity = dbSchema.entities.find(e => e.name === params.source);
      const targetEntity = dbSchema.entities.find(e => e.name === params.target);
      
      if (sourceEntity && targetEntity) {
        console.log(`[ERDiagram ${instanceId.current}] Updating schema to add FK from ${sourceEntity.name} to ${targetEntity.name}`);
        
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
            console.log(`[ERDiagram ${instanceId.current}] Notifying parent of YAML change from connection`);
            lastYamlContent.current = updatedYaml; // Update ref to prevent reprocessing
            onDiagramChange(updatedYaml);
          }
        }
      }
    },
    [dbSchema, onDiagramChange]
  );
  
  // Handle node movement
  const onNodeDragStop = useCallback(
    (event, node) => {
      console.log(`[ERDiagram ${instanceId.current}] Node moved: ${node.id}`, node.position);
      
      // Update the position in our node state
      setNodes(nds => 
        nds.map(n => {
          if (n.id === node.id) {
            n.position = node.position;
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    (deleted) => {
      console.log(`[ERDiagram ${instanceId.current}] Nodes deleted:`, deleted.map(n => n.id));
      
      if (!dbSchema || !dbSchema.entities) return;
      
      // Create a copy of the schema to modify
      const updatedSchema = { ...dbSchema };
      
      // Remove the deleted entities
      updatedSchema.entities = updatedSchema.entities.filter(
        entity => !deleted.some(node => node.id === entity.name)
      );
      
      console.log(`[ERDiagram ${instanceId.current}] Updated schema after deletion:`, {
        originalCount: dbSchema.entities.length,
        newCount: updatedSchema.entities.length
      });
      
      // Update the schema state
      setDbSchema(updatedSchema);
      
      // Convert to YAML and notify parent
      const updatedYaml = jsYaml.dump(updatedSchema, { lineWidth: 120 });
      if (onDiagramChange) {
        console.log(`[ERDiagram ${instanceId.current}] Notifying parent of YAML change from deletion`);
        lastYamlContent.current = updatedYaml; // Update ref to prevent reprocessing
        onDiagramChange(updatedYaml);
      }
    },
    [dbSchema, onDiagramChange]
  );

  // Handle node double click
  const onNodeDoubleClick = useCallback(
    (event, node) => {
      console.log(`[ERDiagram ${instanceId.current}] Node double-clicked: ${node.id}`);
      setSelectedNode(node);
      setShowNodeModal(true);
    },
    []
  );

  // Handle node update from modal
  const handleNodeUpdate = useCallback(
    (updatedNode) => {
      console.log(`[ERDiagram ${instanceId.current}] Node update requested:`, {
        nodeId: updatedNode.id,
        newLabel: updatedNode.data.label,
        attributeCount: updatedNode.data.attributes.length
      });
      
      if (!dbSchema || !dbSchema.entities) {
        console.warn(`[ERDiagram ${instanceId.current}] Cannot update node, schema not available`);
        return;
      }
      
      // Create a copy of the schema to modify
      const updatedSchema = { ...dbSchema };
      
      // Find the entity corresponding to the node
      const entityIndex = updatedSchema.entities.findIndex(
        entity => entity.name === selectedNode.id
      );
      
      if (entityIndex !== -1) {
        const oldName = updatedSchema.entities[entityIndex].name;
        const newName = updatedNode.data.label;
        
        console.log(`[ERDiagram ${instanceId.current}] Updating entity:`, {
          entityIndex,
          oldName,
          newName,
          nameChanged: oldName !== newName
        });
        
        // Update the entity
        updatedSchema.entities[entityIndex] = {
          name: updatedNode.data.label,
          attributes: updatedNode.data.attributes
        };
        
        // Update related foreign keys if name changed
        if (selectedNode.id !== updatedNode.data.label) {
          console.log(`[ERDiagram ${instanceId.current}] Entity name changed, updating references`);
          
          // Update nodes with new ID
          const updatedNodes = nodes.map(n => {
            if (n.id === selectedNode.id) {
              return {
                ...n,
                id: updatedNode.data.label,
                data: {
                  ...n.data,
                  label: updatedNode.data.label
                }
              };
            }
            return n;
          });
          
          // Update edges if entity name changed
          const updatedEdges = edges.map(edge => {
            let newEdge = { ...edge };
            
            if (edge.source === selectedNode.id) {
              newEdge.source = updatedNode.data.label;
              newEdge.id = `${updatedNode.data.label}-${edge.target}`;
            }
            
            if (edge.target === selectedNode.id) {
              newEdge.target = updatedNode.data.label;
              newEdge.id = `${edge.source}-${updatedNode.data.label}`;
            }
            
            return newEdge;
          });
          
          console.log(`[ERDiagram ${instanceId.current}] Setting updated nodes and edges`);
          setNodes(updatedNodes);
          setEdges(updatedEdges);
        } else {
          console.log(`[ERDiagram ${instanceId.current}] Only attributes changed, no need to update references`);
        }
        
        // Update the schema state
        setDbSchema(updatedSchema);
        
        // Convert to YAML and notify parent
        const updatedYaml = jsYaml.dump(updatedSchema, { lineWidth: 120 });
        if (onDiagramChange) {
          console.log(`[ERDiagram ${instanceId.current}] Notifying parent of YAML change from node update`);
          lastYamlContent.current = updatedYaml; // Update ref to prevent reprocessing
          onDiagramChange(updatedYaml);
        }
      } else {
        console.warn(`[ERDiagram ${instanceId.current}] Entity not found for update:`, selectedNode.id);
      }
    },
    [dbSchema, selectedNode, nodes, edges, onDiagramChange]
  );

  // Handle node deletion from modal
  const handleNodeDelete = useCallback(
    (nodeToDelete) => {
      onNodesDelete([nodeToDelete]);
    },
    [onNodesDelete]
  );

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
    <div 
      className="er-diagram-container" 
      style={{ 
        width: '100%', 
        // height: '600px', // Let parent control height
        // border: '1px solid #ddd', // REMOVE inline border
        borderRadius: '4px',
        overflow: 'hidden'
      }} 
      ref={containerRef}
    >
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
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
      >
        <Controls />
        <MiniMap />
        <Background color="var(--theme-border)" gap={16} />
      </ReactFlow>
      
      <NodeDetailsModal
        show={showNodeModal}
        onHide={() => setShowNodeModal(false)}
        node={selectedNode}
        onNodeUpdate={handleNodeUpdate}
        onNodeDelete={handleNodeDelete}
        theme={theme}
      />
    </div>
  );
};

export default ERDiagram; 