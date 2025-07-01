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
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import yaml from 'yaml';
import { Modal, Button, Form, Spinner, InputGroup } from 'react-bootstrap';
import { FiTrash2, FiEdit, FiX, FiPlus } from 'react-icons/fi';

// Transition Probability Editor Modal
const TransitionProbabilityModal = ({ show, onHide, edge, onEdgeUpdate, theme }) => {
  const [probability, setProbability] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form when edge changes
  useEffect(() => {
    if (edge && edge.data && edge.data.probability !== undefined) {
      setProbability(edge.data.probability);
    } else {
      setProbability(1.0);
    }
  }, [edge]);

  const handleSubmit = () => {
    setIsLoading(true);
    try {
      const updatedEdge = {
        ...edge,
        data: {
          ...edge.data,
          probability: probability
        },
        label: `${(probability * 100).toFixed(0)}%`
      };
      
      onEdgeUpdate(updatedEdge);
      setIsLoading(false);
      onHide();
    } catch (error) {
      console.error('Error updating transition probability:', error);
      setIsLoading(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="sm"
      backdrop="static"
      className="transition-probability-modal"
    >
      <Modal.Header closeButton className={theme === 'dark' ? 'bg-dark text-light' : ''}>
        <Modal.Title>Edit Transition Probability</Modal.Title>
      </Modal.Header>
      <Modal.Body className={theme === 'dark' ? 'bg-dark text-light' : ''}>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Probability (0.0 - 1.0)</Form.Label>
            <Form.Control
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={probability}
              onChange={(e) => setProbability(parseFloat(e.target.value) || 0)}
              className={theme === 'dark' ? 'bg-secondary text-light border-secondary' : ''}
            />
            <Form.Text className="text-muted">
              {(probability * 100).toFixed(1)}%
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer className={theme === 'dark' ? 'bg-dark' : ''}>
        <Button variant="secondary" onClick={onHide} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? <Spinner animation="border" size="sm" /> : 'Save'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Decision Node Probabilities Editor Modal
const DecisionNodeProbabilitiesModal = ({ show, onHide, node, outgoingEdges, onProbabilitiesUpdate, theme }) => {
  const [probabilities, setProbabilities] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Initialize probabilities when modal opens
  useEffect(() => {
    if (show && outgoingEdges && outgoingEdges.length > 0) {
      const initialProbs = {};
      outgoingEdges.forEach(edge => {
        initialProbs[edge.target] = edge.data?.probability || 0;
      });
      setProbabilities(initialProbs);
    }
  }, [show, outgoingEdges]);

  const handleProbabilityChange = (targetId, value) => {
    setProbabilities(prev => ({
      ...prev,
      [targetId]: parseFloat(value) || 0
    }));
  };

  const getTotalProbability = () => {
    return Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
  };

  const handleSubmit = () => {
    const total = getTotalProbability();
    if (Math.abs(total - 1.0) > 0.001) {
      alert('Probabilities must sum to 100% (1.0)');
      return;
    }

    setIsLoading(true);
    try {
      onProbabilitiesUpdate(probabilities);
      setIsLoading(false);
      onHide();
    } catch (error) {
      console.error('Error updating decision probabilities:', error);
      setIsLoading(false);
    }
  };

  const total = getTotalProbability();
  const isValidTotal = Math.abs(total - 1.0) <= 0.001;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="md"
      backdrop="static"
      className="decision-probabilities-modal"
    >
      <Modal.Header closeButton className={theme === 'dark' ? 'bg-dark text-light' : ''}>
        <Modal.Title>Edit Decision Probabilities - {node?.data?.label}</Modal.Title>
      </Modal.Header>
      <Modal.Body className={theme === 'dark' ? 'bg-dark text-light' : ''}>
        <Form>
          <div className="mb-3">
            <h6>Outgoing Transitions:</h6>
            {outgoingEdges && outgoingEdges.map((edge, index) => (
              <div key={edge.target} className="mb-2">
                <Form.Label>To: {edge.target}</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={probabilities[edge.target] || 0}
                  onChange={(e) => handleProbabilityChange(edge.target, e.target.value)}
                  className={theme === 'dark' ? 'bg-secondary text-light border-secondary' : ''}
                />
                <Form.Text className="text-muted">
                  {((probabilities[edge.target] || 0) * 100).toFixed(1)}%
                </Form.Text>
              </div>
            ))}
          </div>
          <div className={`alert ${isValidTotal ? 'alert-success' : 'alert-warning'}`}>
            Total: {(total * 100).toFixed(1)}% {isValidTotal ? '✓' : '(Must equal 100%)'}
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer className={theme === 'dark' ? 'bg-dark' : ''}>
        <Button variant="secondary" onClick={onHide} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={isLoading || !isValidTotal}
        >
          {isLoading ? <Spinner animation="border" size="sm" /> : 'Save'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Event Node Details Modal
const EventNodeDetailsModal = ({ show, onHide, node, onNodeUpdate, onNodeDelete, theme, availableResourceTypes }) => {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState({ distribution: { type: 'normal', mean: 1, stddev: 0.5 } });
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form when node changes
  useEffect(() => {
    if (node && node.data) {
      setName(node.data.label || '');
      setDuration(node.data.duration || {
        distribution: { type: 'normal', mean: 1, stddev: 0.5 }
      });
      // Properly sync resources from the node data
      setResources(node.data.resource_requirements || []);
    }
  }, [node]);

  const handleSubmit = () => {
    setIsLoading(true);
    try {
      // Update node data
      const updatedNode = {
        ...node,
        data: {
          ...node.data,
          label: name,
          duration: duration,
          resource_requirements: resources
        }
      };
      
      onNodeUpdate(updatedNode);
      setIsLoading(false);
      onHide();
    } catch (error) {
      console.error('Error updating event node:', error);
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
      console.error('Error deleting event node:', error);
      setIsLoading(false);
    }
  };

  const handleDurationChange = (field, value) => {
    setDuration(prev => ({
      ...prev,
      distribution: {
        ...prev.distribution,
        [field]: value
      }
    }));
  };

  const handleAddResource = () => {
    // Get the first available resource type as default
    const defaultResourceType = availableResourceTypes && availableResourceTypes.length > 0
      ? availableResourceTypes[0]
      : '';
    setResources([...resources, { resource_table: 'Consultant', value: defaultResourceType, count: 1 }]);
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
        <Modal.Title>Event Details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!node ? (
          <div className="text-center">
            <Spinner animation="border" />
          </div>
        ) : (
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Event Name</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter event name"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Duration</Form.Label>
              <div className="mb-2">
                <Form.Select 
                  value={duration.distribution.type}
                  onChange={(e) => handleDurationChange('type', e.target.value)}
                  className="mb-2"
                >
                  <option value="normal">Normal Distribution</option>
                  <option value="uniform">Uniform Distribution</option>
                  <option value="exponential">Exponential Distribution</option>
                  <option value="constant">Constant</option>
                </Form.Select>
                
                {duration.distribution.type === 'normal' && (
                  <>
                    <InputGroup className="mb-2">
                      <InputGroup.Text>Mean</InputGroup.Text>
                      <Form.Control 
                        type="number" 
                        value={duration.distribution.mean} 
                        onChange={(e) => handleDurationChange('mean', parseFloat(e.target.value))}
                        min="0.1" 
                        step="0.1"
                      />
                    </InputGroup>
                    <InputGroup>
                      <InputGroup.Text>Std Dev</InputGroup.Text>
                      <Form.Control 
                        type="number" 
                        value={duration.distribution.stddev}
                        onChange={(e) => handleDurationChange('stddev', parseFloat(e.target.value))}
                        min="0.1" 
                        step="0.1" 
                      />
                    </InputGroup>
                  </>
                )}
                
                {duration.distribution.type === 'uniform' && (
                  <>
                    <InputGroup className="mb-2">
                      <InputGroup.Text>Min</InputGroup.Text>
                      <Form.Control 
                        type="number" 
                        value={duration.distribution.min || 0.5} 
                        onChange={(e) => handleDurationChange('min', parseFloat(e.target.value))}
                        min="0.1" 
                        step="0.1"
                      />
                    </InputGroup>
                    <InputGroup>
                      <InputGroup.Text>Max</InputGroup.Text>
                      <Form.Control 
                        type="number" 
                        value={duration.distribution.max || 1.5}
                        onChange={(e) => handleDurationChange('max', parseFloat(e.target.value))}
                        min="0.1" 
                        step="0.1" 
                      />
                    </InputGroup>
                  </>
                )}
                
                {duration.distribution.type === 'exponential' && (
                  <InputGroup>
                    <InputGroup.Text>Scale</InputGroup.Text>
                    <Form.Control 
                      type="number" 
                      value={duration.distribution.scale || 1.0}
                      onChange={(e) => handleDurationChange('scale', parseFloat(e.target.value))}
                      min="0.1" 
                      step="0.1" 
                    />
                  </InputGroup>
                )}
                
                {duration.distribution.type === 'constant' && (
                  <InputGroup>
                    <InputGroup.Text>Value</InputGroup.Text>
                    <Form.Control 
                      type="number" 
                      value={duration.distribution.value || 1.0}
                      onChange={(e) => handleDurationChange('value', parseFloat(e.target.value))}
                      min="0.1" 
                      step="0.1" 
                    />
                  </InputGroup>
                )}
              </div>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Resources</Form.Label>
              <div className="resource-list">
                {resources.map((resource, index) => (
                  <div key={index} className="resource-item d-flex align-items-center mb-2">
                    <Form.Select
                      className="me-2"
                      value={resource.value}
                      onChange={(e) => {
                        const newResources = [...resources];
                        newResources[index] = { ...resource, value: e.target.value };
                        setResources(newResources);
                      }}
                    >
                      <option value="">Select resource type</option>
                      {availableResourceTypes && availableResourceTypes.map(resourceType => (
                        <option key={resourceType} value={resourceType}>
                          {resourceType}
                        </option>
                      ))}
                    </Form.Select>
                    <InputGroup className="me-2" style={{ maxWidth: "150px" }}>
                      <InputGroup.Text>Count</InputGroup.Text>
                      <Form.Control
                        type="number"
                        value={resource.count}
                        onChange={(e) => {
                          const newResources = [...resources];
                          newResources[index] = { 
                            ...resource, 
                            count: parseInt(e.target.value, 10) 
                          };
                          setResources(newResources);
                        }}
                        min="1"
                        step="1"
                      />
                    </InputGroup>
                    <Button
                      variant="link"
                      className="text-danger"
                      onClick={() => {
                        const newResources = resources.filter((_, i) => i !== index);
                        setResources(newResources);
                      }}
                    >
                      <FiX />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleAddResource}
                >
                  <FiPlus className="me-1" /> Add Resource
                </Button>
              </div>
            </Form.Group>
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-danger" onClick={handleDelete} disabled={isLoading}>
          <FiTrash2 className="me-2" /> Delete Event
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

// Custom Event Node component
const EventNode = ({ data }) => {
  const theme = data.theme; // Get theme from data
  return (
    <div className="event-node">
      <Handle type="target" position={Position.Top} id="target-top" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
      
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

// Custom Decision Node component (rhombus shape)
const DecisionNode = ({ data }) => {
  const theme = data.theme; // Get theme from data
  const style = {
    width: '180px',
    height: '90px',
    background: theme === 'dark' ? '#b38600' : '#f0ad4e',
    border: '2px solid ' + (theme === 'dark' ? '#d4a017' : '#d4a017'),
    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const textStyle = {
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    color: theme === 'dark' ? '#e0e0e0' : '#333',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <div className="decision-node" style={{ position: 'relative' }}>
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{ left: '-10px', top: '45px' }}
      />
      <div style={style}>
        <div style={textStyle}>{data.label}</div>
      </div>
      
      {/* Single source handle on the right for ALL outgoing transitions */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{ right: '-90px', top: '45px' }}
      />
      
      {/* Reserved bottom handle for future "False" condition - not connected to regular outputs */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-false"
        style={{ bottom: '0px', left: '90px', opacity: 0.3 }}
      />
    </div>
  );
};

// Node types definition
const nodeTypes = {
  event: EventNode,
  decision: DecisionNode,
};

const EventFlow = ({ yamlContent, parsedSchema, onDiagramChange, theme, dbConfigContent }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [simSchema, setSimSchema] = useState(null);
  const containerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [selectedDecisionNode, setSelectedDecisionNode] = useState(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [schemaId, setSchemaId] = useState(null);
  const [availableResourceTypes, setAvailableResourceTypes] = useState([]);
  
  // Use layout effect to ensure container is measured before rendering
  useLayoutEffect(() => {
    if (containerRef.current) {
      setInitialized(true);
    }
  }, []);
  
  // Generate consistent ID for schema based on event types
  useEffect(() => {
    if (yamlContent) {
      try {
        // Generate a more stable ID that doesn't change when events are added/removed
        // This uses a hash of the first part of the YAML content
        const yamlPrefix = yamlContent.substring(0, 100).replace(/\s+/g, '');
        let stableId = '';
        
        // Simple hash function to create a stable ID
        for (let i = 0; i < yamlPrefix.length; i++) {
          stableId += yamlPrefix.charCodeAt(i);
        }
        
        const id = `event_flow_positions_${stableId}`;
        console.log('[EventFlow] Generated stable schema ID:', id);
        setSchemaId(id);
      } catch(e) {
        console.error('[EventFlow] Error generating schema ID:', e);
      }
    }
  }, [yamlContent]);
  
  // Extract available resource types from database configuration
  useEffect(() => {
    if (dbConfigContent) {
      try {
        const dbParsed = yaml.parse(dbConfigContent);
        const resourceTypes = [];
        
        // Find entities with type: resource
        if (dbParsed?.entities) {
          const resourceEntities = dbParsed.entities.filter(entity => entity.type === 'resource');
          
          resourceEntities.forEach(entity => {
            // Find attributes with type: resource_type
            const resourceTypeAttributes = entity.attributes?.filter(attr => attr.type === 'resource_type') || [];
            
            if (resourceTypeAttributes.length > 0) {
              const resourceTypeAttr = resourceTypeAttributes[0];
              
              if (resourceTypeAttr.generator?.distribution?.type === 'choice' && resourceTypeAttr.generator.distribution.values) {
                // Extract the possible values from the choice distribution
                const values = resourceTypeAttr.generator.distribution.values;
                if (Array.isArray(values) && values.length > 0) {
                  resourceTypes.push(...values);
                }
              }
            }
          });
        }
        
        setAvailableResourceTypes(resourceTypes);
        console.log('[EventFlow] Extracted resource types:', resourceTypes);
      } catch (error) {
        console.error('[EventFlow] Error parsing database config for resource types:', error);
        setAvailableResourceTypes([]);
      }
    } else {
      setAvailableResourceTypes([]);
    }
  }, [dbConfigContent]);
  
  // Effect to update internal state and generate graph when props change
  useEffect(() => {
    console.log("[EventFlow] useEffect triggered by prop change");
    let schemaToUse = parsedSchema;

    // If parsedSchema is not valid, try parsing yamlContent as a fallback
    if (!schemaToUse && yamlContent) {
         console.warn("[EventFlow] parsedSchema prop is invalid or null, attempting to parse yamlContent fallback.");
         try {
            const doc = yaml.parseDocument(yamlContent);
            if (doc.errors && doc.errors.length > 0) {
                 console.error('[EventFlow] Fallback parse error:', doc.errors);
                 schemaToUse = null; // Ensure schema is null on error
            } else {
                 schemaToUse = doc.toJSON();
            }
         } catch(e) {
             console.error('[EventFlow] Fallback parse exception:', e);
             schemaToUse = null; // Ensure schema is null on error
         }
    }

     // Update internal schema state
     setSimSchema(schemaToUse);

     // Generate nodes and edges based on schemaToUse
     if (schemaToUse && schemaToUse.event_simulation &&
         schemaToUse.event_simulation.event_sequence &&
         schemaToUse.event_simulation.event_sequence.event_types) {

         const eventTypes = schemaToUse.event_simulation.event_sequence.event_types;
         const transitions = schemaToUse.event_simulation.event_sequence.transitions || [];

         // Try to load saved positions from localStorage
         let savedPositions = {};
         if (schemaId) {
            try {
               const savedData = localStorage.getItem(schemaId);
               if (savedData) {
                 savedPositions = JSON.parse(savedData);
                 console.log("[EventFlow] Loaded saved positions:", savedPositions);
               }
            } catch (err) {
               console.error("[EventFlow] Error loading saved positions:", err);
               savedPositions = {};
            }
         }

         // Create nodes for each event type
         const eventNodes = eventTypes.map((event, index) => {
           // Position events in a more linear/grid pattern
           const row = Math.floor(index / 3);
           const col = index % 3;
           
           // Use saved position if available, otherwise use default
           const position = savedPositions[event.name] 
             ? savedPositions[event.name] 
             : { x: 100 + col * 300, y: 100 + row * 200 };
           
           // Format resource requirements for display
           let resourcesText = '';
           if (event.resource_requirements && event.resource_requirements.length > 0) {
             resourcesText = event.resource_requirements
               .map(req => `${req.count || 1} ${req.value || req.resource_table || 'Resource'}`)
               .join(', ');
           }
           
           return {
             id: event.name,
             type: 'event',
             position: position,
             data: {
               label: event.name,
               duration: event.duration,
               resource_requirements: event.resource_requirements || [], // Include the actual resource requirements
               resources: resourcesText,
               theme: theme
             },
             width: 200,
             height: 120,
           };
         });
         
         // Create decision nodes and edges
         const decisionNodes = [];
         const transitionEdges = [];
         
         transitions.forEach((transition, idx) => {
           const source = transition.from;
           
           // If there are multiple destinations, create a decision node
           if (transition.to && Array.isArray(transition.to) && transition.to.length > 1) {
             // Find the source node position
             const sourceNode = eventNodes.find(node => node.id === source);
             if (!sourceNode) return;
             
             // Create decision node with a unique ID
             const decisionId = `decision-${source}-${idx}`;
             
             // Format label to show the decision context
             const decisionLabel = `${source} Branch`;
             
             // Check for saved position for this decision node
             const decisionPosition = savedPositions[decisionId]
               ? savedPositions[decisionId]
               : { 
                 x: sourceNode.position.x + 250,
                 y: sourceNode.position.y + 20 // Center it vertically to the source node
               };
             
             // Position decision node to the right of the source event
             const decisionNode = {
               id: decisionId,
               type: 'decision',
               position: decisionPosition,
               data: { 
                 label: decisionLabel,
                 outputs: transition.to,
                 source: source,
                 theme: theme
               },
               width: 180,
               height: 90,
             };
             
             decisionNodes.push(decisionNode);
             
             // Create edge from source to decision
             transitionEdges.push({
               id: `${source}-${decisionId}`,
               source,
               sourceHandle: 'source-right',
               target: decisionId,
               targetHandle: 'target-left',
               type: 'smoothstep',
               style: { stroke: '#2ecc71', strokeWidth: 2 },
               markerEnd: {
                 type: MarkerType.ArrowClosed,
                 width: 20,
                 height: 20,
                 color: '#2ecc71',
               },
             });
             
             // Create edges from decision to each destination using "bus" style
             transition.to.forEach((dest, destIdx) => {
               const targetNode = eventNodes.find(node => node.id === dest.event_type);
               if (!targetNode) return;
               
               // ALL outgoing connections use the right handle for clean "bus" style
               const sourceHandle = 'source-right';
               
               // Determine edge color based on probability
               let edgeColor;
               if (dest.probability >= 0.7) {
                 edgeColor = '#5cb85c'; // Green for high probability
               } else if (dest.probability >= 0.3) {
                 edgeColor = '#f0ad4e'; // Orange for medium probability
               } else {
                 edgeColor = '#d9534f'; // Red for low probability
               }
               
               // Create intermediate waypoint for "bus" style routing
               // This creates the parallel lines effect before branching
               const decisionPos = decisionPosition;
               const targetPos = targetNode.position;
               
               // Calculate waypoint for bus-style routing
               const busLength = 60; // Length of parallel bus section
               const verticalSpacing = 30; // Vertical spacing between parallel lines
               const busEndX = decisionPos.x + 80 + busLength; // End of bus section
               const busY = decisionPos.y + 40 + (destIdx - (transition.to.length - 1) / 2) * verticalSpacing;
               
               // Create edge with waypoints for bus-style routing
               transitionEdges.push({
                 id: `${decisionId}-${dest.event_type}`,
                 source: decisionId,
                 sourceHandle,
                 target: dest.event_type,
                 targetHandle: 'target-left',
                 type: 'smoothstep', // Use smoothstep for better routing
                 data: {
                   probability: dest.probability,
                   busStyle: true // Mark as bus-style edge
                 },
                 style: {
                   stroke: edgeColor,
                   strokeWidth: 2,
                 },
                 markerEnd: {
                   type: MarkerType.ArrowClosed,
                   width: 20,
                   height: 20,
                   color: edgeColor,
                 },
               });
             });
           } else if (transition.to && Array.isArray(transition.to) && transition.to.length === 1) {
             // Direct connection for single destination
             const dest = transition.to[0];
             transitionEdges.push({
               id: `${source}-${dest.event_type}`,
               source,
               sourceHandle: 'source-right',
               target: dest.event_type,
               targetHandle: 'target-left',
               type: 'step',
               data: { probability: dest.probability }, // Store probability in data
               style: { stroke: '#2ecc71', strokeWidth: 2 },
               markerEnd: {
                 type: MarkerType.ArrowClosed,
                 width: 20,
                 height: 20,
                 color: '#2ecc71',
               },
             });
           }
         });
         
         // Combine all nodes and set state
         setNodes([...eventNodes, ...decisionNodes]);
         setEdges(transitionEdges);
         console.log("[EventFlow] Nodes/Edges updated from schema.");

     } else {
         // Clear graph if schema is invalid or empty
         console.log("[EventFlow] Schema invalid or empty, clearing nodes/edges.");
         setNodes([]);
         setEdges([]);
     }
 }, [yamlContent, parsedSchema, theme, schemaId]); // Depend on props
  
  // Helper function to determine the best target handle based on node positions
  const getTargetHandle = (sourceNode, targetNode) => {
    // Compare positions to determine best connection point
    if (targetNode.position.x < sourceNode.position.x - 100) {
      return 'target-right'; // Target is to the left
    } else if (targetNode.position.y < sourceNode.position.y - 100) {
      return 'target-bottom'; // Target is above
    } else if (targetNode.position.y > sourceNode.position.y + 100) {
      return 'target-top'; // Target is below
    } else {
      return 'target-left'; // Target is to the right (default)
    }
  };
  
  // Handle connecting nodes
  const onConnect = useCallback(
    (params) => {
      // Validate connection
      if (!params.source || !params.target) {
        console.error('Invalid connection params:', params);
        return;
      }
      
      // Check if source is a decision node
      const isDecisionSource = params.source.startsWith('decision-');
      
      // Create a new edge with styling
      const newEdge = { 
        ...params, 
        id: `${params.source}-${params.target}`,
        type: 'step',
        label: isDecisionSource ? '0%' : '100%',
        labelStyle: { fill: '#333', fontWeight: 'bold' },
        style: { stroke: '#2ecc71', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#2ecc71',
        },
      };
      
      // If the schema exists and connection is not from/to a decision node, update it
      if (simSchema && !isDecisionSource && !params.target.startsWith('decision-')) {
        // Deep copy
        const updatedSchema = JSON.parse(JSON.stringify(simSchema));
        
        // Ensure the transitions array exists
        if (!updatedSchema.event_simulation) updatedSchema.event_simulation = {};
        if (!updatedSchema.event_simulation.event_sequence) updatedSchema.event_simulation.event_sequence = {};
        if (!updatedSchema.event_simulation.event_sequence.transitions) updatedSchema.event_simulation.event_sequence.transitions = [];
        
        const transitions = updatedSchema.event_simulation.event_sequence.transitions;
        
        // Check if we already have a transition from this source
        let sourceTransition = transitions.find(t => t.from === params.source);
        
        if (!sourceTransition) {
          // Create a new transition entry
          sourceTransition = {
            from: params.source,
            to: []
          };
          transitions.push(sourceTransition);
        }
        
        // Check if the target is already in the "to" array
        const existingTarget = sourceTransition.to.find(t => t.event_type === params.target);
        
        if (!existingTarget) {
          // Add the new target with 100% probability
          sourceTransition.to.push({
            event_type: params.target,
            probability: 1.0
          });
          
          // If there were already other targets, adjust probabilities
          if (sourceTransition.to.length > 1) {
            const newProb = 1.0 / sourceTransition.to.length;
            sourceTransition.to.forEach(target => {
              target.probability = newProb;
            });
          }
        }
        
        // Update the schema state
        setSimSchema(updatedSchema);
        
        // Call callback with OBJECT
        if (onDiagramChange) {
           console.log("[EventFlow] Calling onDiagramChange with updated schema object after connect:", updatedSchema);
           onDiagramChange(updatedSchema);
        }
      }
    },
    [simSchema, onDiagramChange] // Depend on internal state and callback
  );
  
  // Handle node drag end
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
      
      console.log('Node moved in EventFlow:', node);
      
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
          console.log(`[EventFlow] Saved positions to localStorage with key: ${schemaId}`);
        } catch (err) {
          console.error('[EventFlow] Error saving positions to localStorage:', err);
        }
      }
    },
    [setNodes, schemaId]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    (deletedNodes) => {
     if (simSchema) { // Use internal simSchema state
         // Deep copy
        const updatedSchema = JSON.parse(JSON.stringify(simSchema));
        const eventSequence = updatedSchema.event_simulation?.event_sequence;

        if (eventSequence) {
            const deletedEvents = deletedNodes.filter(node => !node.id.startsWith('decision-'));
            const deletedEventIds = deletedEvents.map(n => n.id);

            // Remove the deleted event types
            if (eventSequence.event_types) {
                eventSequence.event_types = eventSequence.event_types.filter(
                  event => !deletedEventIds.includes(event.name)
                );
              }
             if (eventSequence.transitions) {
                 // Remove transitions FROM deleted events
                 eventSequence.transitions = eventSequence.transitions.filter(
                   transition => !deletedEventIds.includes(transition.from)
                 );
                 // Remove transitions TO deleted events and adjust probabilities
                 eventSequence.transitions.forEach(transition => {
                   if (transition.to) {
                     transition.to = transition.to.filter(
                       dest => !deletedEventIds.includes(dest.event_type)
                     );
                     
                     // If any destinations remain, recalculate probabilities
                     if (transition.to.length > 0) {
                       const totalProb = transition.to.reduce((sum, dest) => sum + dest.probability, 0);
                       if (totalProb > 0 && totalProb < 1.0) {
                         // Normalize probabilities to sum to 1.0
                         transition.to.forEach(dest => {
                           dest.probability = dest.probability / totalProb;
                         });
                       }
                     }
                   }
                 });
                 
                 // Remove transitions with no remaining destinations
                 eventSequence.transitions = eventSequence.transitions.filter(
                   transition => transition.to && transition.to.length > 0
                 );
             }
        }

        // Update internal state FIRST
        setSimSchema(updatedSchema);

         // Call callback with OBJECT
         if (onDiagramChange) {
           console.log("[EventFlow] Calling onDiagramChange with updated schema object after delete:", updatedSchema);
           onDiagramChange(updatedSchema);
         }
         
         // Remove the deleted node positions from localStorage
         if (schemaId) {
           try {
             const savedData = localStorage.getItem(schemaId);
             if (savedData) {
               let positions = JSON.parse(savedData);
               
               // Get all deleted node IDs including both events and decision nodes
               const allDeletedIds = deletedNodes.map(n => n.id);
               
               // Remove positions for all deleted nodes
               allDeletedIds.forEach(id => {
                 if (positions[id]) {
                   console.log(`[EventFlow] Removing position for deleted node: ${id}`);
                   delete positions[id];
                 }
               });
               
               // Save the updated positions back to localStorage
               localStorage.setItem(schemaId, JSON.stringify(positions));
             }
           } catch (err) {
             console.error('[EventFlow] Error updating positions in localStorage after deletion:', err);
           }
         }
     }
    },
    [simSchema, onDiagramChange, schemaId] // Added schemaId to dependencies
  );

  // Handle node double click
  const onNodeDoubleClick = useCallback(
    (event, node) => {
      if (node.type === 'decision') {
        // Handle decision nodes - open probabilities editor
        const outgoingEdges = edges.filter(edge => edge.source === node.id);
        setSelectedDecisionNode(node);
        setShowDecisionModal(true);
      } else {
        // Handle event nodes - open event details editor
        setSelectedNode(node);
        setShowNodeModal(true);
      }
    },
    [edges]
  );

  // Handle edge click for probability editing
  const onEdgeClick = useCallback(
    (event, edge) => {
      // Only allow editing for non-decision node edges (regular transitions)
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode && sourceNode.type !== 'decision') {
        setSelectedEdge(edge);
        setShowTransitionModal(true);
      }
    },
    [nodes]
  );

  // Handler for node updates from modal
  const handleNodeUpdate = useCallback((updatedNode) => {
     // This function receives the updated node data from the modal
     if (simSchema) {
         const updatedSchema = JSON.parse(JSON.stringify(simSchema));
         const eventSequence = updatedSchema.event_simulation?.event_sequence;

         if (eventSequence && eventSequence.event_types) {
             const eventIndex = eventSequence.event_types.findIndex(e => e.name === updatedNode.id);
             if (eventIndex !== -1) {
                 // Update the event in the schema based on modal data (updatedNode.data)
                 eventSequence.event_types[eventIndex] = {
                     name: updatedNode.data.label,
                     duration: updatedNode.data.duration,
                     resource_requirements: updatedNode.data.resource_requirements // Assuming modal provides this structure
                 };
                 // If name changed, need to update transitions as well (complex, omitted for brevity)
             }
         }

         setSimSchema(updatedSchema); // Update internal state

         // Call the callback with the updated OBJECT
         if (onDiagramChange) {
             console.log("[EventFlow] Calling onDiagramChange with updated schema object after node update:", updatedSchema);
             onDiagramChange(updatedSchema); // Pass object up
         }
     }
  }, [simSchema, onDiagramChange]);

 // Handle edge probability update
 const handleEdgeUpdate = useCallback((updatedEdge) => {
   if (simSchema) {
     const updatedSchema = JSON.parse(JSON.stringify(simSchema));
     const transitions = updatedSchema.event_simulation?.event_sequence?.transitions;
     
     if (transitions) {
       // Find the transition that corresponds to this edge
       const transition = transitions.find(t =>
         t.from === updatedEdge.source &&
         t.to && t.to.some(dest => dest.event_type === updatedEdge.target)
       );
       
       if (transition && transition.to) {
         const destIndex = transition.to.findIndex(dest => dest.event_type === updatedEdge.target);
         if (destIndex !== -1) {
           transition.to[destIndex].probability = updatedEdge.data.probability;
         }
       }
     }
     
     setSimSchema(updatedSchema);
     if (onDiagramChange) {
       onDiagramChange(updatedSchema);
     }
   }
 }, [simSchema, onDiagramChange]);

 // Handle decision node probabilities update
 const handleDecisionProbabilitiesUpdate = useCallback((probabilities) => {
   if (simSchema && selectedDecisionNode) {
     const updatedSchema = JSON.parse(JSON.stringify(simSchema));
     const transitions = updatedSchema.event_simulation?.event_sequence?.transitions;
     
     if (transitions) {
       // Find the transition that corresponds to this decision node
       const transition = transitions.find(t => t.from === selectedDecisionNode.data.source);
       
       if (transition && transition.to) {
         // Update probabilities for each destination
         Object.entries(probabilities).forEach(([targetId, probability]) => {
           const destIndex = transition.to.findIndex(dest => dest.event_type === targetId);
           if (destIndex !== -1) {
             transition.to[destIndex].probability = probability;
           }
         });
       }
     }
     
     setSimSchema(updatedSchema);
     if (onDiagramChange) {
       onDiagramChange(updatedSchema);
     }
   }
 }, [simSchema, selectedDecisionNode, onDiagramChange]);

 // Handle node deletion from modal callback
 const handleNodeDelete = useCallback((nodeToDelete) => {
    // Trigger the main deletion logic
    onNodesDelete([{ id: nodeToDelete.id }]); // Pass it in the expected array format
 }, [onNodesDelete]);

  // Effect to populate the graph based on the schema
  useEffect(() => {
    console.log("[EventFlow] Nodes/Edges updated from schema.");
  }, [nodes, edges, simSchema, theme, schemaId]);  // Make sure schemaId triggers recomputation

  // If not initialized, just show the container to get dimensions
  if (!initialized) {
    return (
      <div 
        ref={containerRef} 
        className="event-flow-container" 
        style={{ 
          width: '100%',
          borderRadius: '4px',
          overflow: 'hidden'
        }} 
      />
    );
  }
  
  return (
    <div className="event-flow-container" ref={containerRef}>
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
            onEdgeClick={onEdgeClick}
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
      <EventNodeDetailsModal
        show={showNodeModal}
        onHide={() => setShowNodeModal(false)}
        node={selectedNode}
        onNodeUpdate={handleNodeUpdate}
        onNodeDelete={handleNodeDelete}
        theme={theme}
        availableResourceTypes={availableResourceTypes}
      />
      <TransitionProbabilityModal
        show={showTransitionModal}
        onHide={() => setShowTransitionModal(false)}
        edge={selectedEdge}
        onEdgeUpdate={handleEdgeUpdate}
        theme={theme}
      />
      <DecisionNodeProbabilitiesModal
        show={showDecisionModal}
        onHide={() => setShowDecisionModal(false)}
        node={selectedDecisionNode}
        outgoingEdges={selectedDecisionNode ? edges.filter(edge => edge.source === selectedDecisionNode.id) : []}
        onProbabilitiesUpdate={handleDecisionProbabilitiesUpdate}
        theme={theme}
      />
    </div>
  );
};

export default EventFlow; 