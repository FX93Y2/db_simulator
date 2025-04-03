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
            width: 200,
            height: 100 + (entity.attributes?.length || 0) * 25,
          });
          
          // Create edges for relationships
          if (entity.attributes) {
            entity.attributes.forEach(attr => {
              if (attr.type === 'fk' && attr.ref) {
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
        type: 'smoothstep',
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

  // Handle node deletion
  const onNodesDelete = useCallback(
    (deleted) => {
      if (!dbSchema || !dbSchema.entities) return;
      
      // Create a copy of the schema to modify
      const updatedSchema = { ...dbSchema };
      
      // Remove the deleted entities
      updatedSchema.entities = updatedSchema.entities.filter(
        entity => !deleted.some(node => node.id === entity.name)
      );
      
      // Update the schema state
      setDbSchema(updatedSchema);
      
      // Convert to YAML and notify parent
      const updatedYaml = jsYaml.dump(updatedSchema, { lineWidth: 120 });
      if (onDiagramChange) {
        onDiagramChange(updatedYaml);
      }
    },
    [dbSchema, onDiagramChange]
  );

  // Handle node double click
  const onNodeDoubleClick = useCallback(
    (event, node) => {
      setSelectedNode(node);
      setShowNodeModal(true);
    },
    []
  );

  // Handle node update from modal
  const handleNodeUpdate = useCallback(
    (updatedNode) => {
      if (!dbSchema || !dbSchema.entities) return;
      
      // Create a copy of the schema to modify
      const updatedSchema = { ...dbSchema };
      
      // Find the entity corresponding to the node
      const entityIndex = updatedSchema.entities.findIndex(
        entity => entity.name === selectedNode.id
      );
      
      if (entityIndex !== -1) {
        // Update the entity
        updatedSchema.entities[entityIndex] = {
          name: updatedNode.data.label,
          attributes: updatedNode.data.attributes
        };
        
        // Update related foreign keys if name changed
        if (selectedNode.id !== updatedNode.data.label) {
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
          
          setNodes(updatedNodes);
          
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
          
          setEdges(updatedEdges);
        } else {
          // Just update the node data
          setNodes(
            nodes.map(n => {
              if (n.id === selectedNode.id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    attributes: updatedNode.data.attributes
                  }
                };
              }
              return n;
            })
          );
        }
        
        // Update the schema state
        setDbSchema(updatedSchema);
        
        // Convert to YAML and notify parent
        const updatedYaml = jsYaml.dump(updatedSchema, { lineWidth: 120 });
        if (onDiagramChange) {
          onDiagramChange(updatedYaml);
        }
      }
    },
    [dbSchema, selectedNode, nodes, edges, setNodes, setEdges, onDiagramChange]
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