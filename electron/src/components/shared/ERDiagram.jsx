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
  const [schemaId, setSchemaId] = useState(null);

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

  // Parse YAML to extract entities
  useEffect(() => {
    console.log(`[ERDiagram] useEffect triggered by yamlContent change: ${yamlContent ? yamlContent.substring(0, 50) : 'null'}...`);
    try {
      if (!yamlContent) {
        setDbSchema(null);
        setNodes([]);
        setEdges([]);
        return;
      }
      console.log('[ERDiagram] Parsing YAML content...');
      const parsedDoc = yaml.parseDocument(yamlContent);
      const parsedYaml = parsedDoc.toJSON();
      console.log('[ERDiagram] Parsed YAML:', parsedYaml);

      setDbSchema(parsedYaml);
      
      if (parsedYaml && parsedYaml.entities) {
        console.log("[ERDiagram] Processing entities and relationships...");
        const entityNodes = [];
        const relationEdges = [];
        
        // Try to load saved positions from localStorage
        let savedPositions = {};
        if (schemaId) {
          try {
            const savedData = localStorage.getItem(schemaId);
            if (savedData) {
              savedPositions = JSON.parse(savedData);
              console.log("[ERDiagram] Loaded saved positions:", savedPositions);
            }
          } catch (err) {
            console.error("[ERDiagram] Error loading saved positions:", err);
            savedPositions = {};
          }
        }
        
        // Create nodes for each entity
        parsedYaml.entities.forEach((entity, index) => {
          // Use saved position if available, otherwise use default positioning
          const position = savedPositions[entity.name] 
            ? savedPositions[entity.name] 
            : { x: (index % 3) * 300 + 50, y: Math.floor(index / 3) * 300 + 50 };
          
          entityNodes.push({
            id: entity.name,
            type: 'entity',
            position: position,
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
        
        console.log("[ERDiagram] Setting nodes:", entityNodes);
        console.log("[ERDiagram] Setting edges:", relationEdges);
        setNodes(entityNodes);
        setEdges(relationEdges);
        console.log("[ERDiagram] Nodes and Edges state updated.");
      } else {
        console.warn("[ERDiagram] Parsed YAML missing expected structure (entities).");
      }
    } catch (error) {
      console.error('[ERDiagram] Error parsing YAML for ER diagram:', error);
      setDbSchema(null);
      setNodes([]);
      setEdges([]);
    }
  }, [yamlContent, theme, schemaId]);
  
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
      
      // Save positions to localStorage
      if (schemaId) {
        try {
          // Get existing positions or initialize empty object
          const savedData = localStorage.getItem(schemaId);
          let positions = savedData ? JSON.parse(savedData) : {};
          
          // Update position for the dragged node
          positions[node.id] = node.position;
          
          // Save back to localStorage
          localStorage.setItem(schemaId, JSON.stringify(positions));
          console.log(`[ERDiagram] Saved positions to localStorage with key: ${schemaId}`);
        } catch (err) {
          console.error('[ERDiagram] Error saving positions to localStorage:', err);
        }
      }
    },
    [setNodes, schemaId]
  );

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

  // Handle node update from modal
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