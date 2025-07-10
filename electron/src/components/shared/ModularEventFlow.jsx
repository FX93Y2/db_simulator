import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { Modal, Button, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { FiTrash2, FiEdit } from 'react-icons/fi';

// Process (Event) Node Component - Rectangle
const ProcessNode = ({ data, selected }) => {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete();
    }
  };

  return (
    <div className={`custom-node process-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      {selected && (
        <button className="node-delete-btn" onClick={handleDelete} title="Delete node (or press Delete key)">
          <FiTrash2 size={14} />
        </button>
      )}
      <div className="node-header">
        <span className="node-type">Process</span>
      </div>
      <div className="node-content">
        <div className="node-title">{data.stepConfig?.event_config?.name || data.label}</div>
        <div className="node-details">
          {data.stepConfig?.event_config?.duration && (
            <div className="detail-item">
              <strong>Duration:</strong> {data.stepConfig.event_config.duration.distribution?.mean || 1} days
            </div>
          )}
          {data.stepConfig?.event_config?.resource_requirements?.length > 0 && (
            <div className="detail-item">
              <strong>Resources:</strong> {data.stepConfig.event_config.resource_requirements.length}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Decide Node Component - Diamond
const DecideNode = ({ data, selected }) => {
  const outcomes = data.stepConfig?.decide_config?.outcomes || [];
  
  const handleDelete = (e) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete();
    }
  };
  
  return (
    <div className={`custom-node decide-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ left: '0%', top: '50%' }} />
      {selected && (
        <button className="node-delete-btn" onClick={handleDelete} title="Delete node (or press Delete key)">
          <FiTrash2 size={14} />
        </button>
      )}
      <div className="diamond-shape">
        <div className="diamond-content">
          <div className="node-title">Decision</div>
        </div>
      </div>
      {/* All source handles on the right point */}
      <Handle type="source" position={Position.Right} id="outcome-0" style={{ right: '0%', top: '45%' }} />
      <Handle type="source" position={Position.Right} id="outcome-1" style={{ right: '0%', top: '55%' }} />
      {outcomes.length > 2 && (
        <Handle type="source" position={Position.Right} id="outcome-2" style={{ right: '0%', top: '50%' }} />
      )}
    </div>
  );
};

// Release Node Component - Dispose shape (rectangle with angled side)
const ReleaseNode = ({ data, selected }) => {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete();
    }
  };

  return (
    <div className={`custom-node release-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      {selected && (
        <button className="node-delete-btn" onClick={handleDelete} title="Delete node (or press Delete key)">
          <FiTrash2 size={14} />
        </button>
      )}
      <div className="dispose-shape">
        <div className="dispose-content">
          <div className="node-title">{data.label}</div>
          <div className="node-details">
            <div className="detail-item">End of flow</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Node Edit Modal
const NodeEditModal = ({ show, onHide, node, onNodeUpdate, theme, parsedSchema, resourceDefinitions }) => {
  const [formData, setFormData] = useState({});
  const [resourceRequirements, setResourceRequirements] = useState([]);
  const [outcomes, setOutcomes] = useState([]);

  // Helper function to get event name from step ID
  const getEventNameFromStepId = (stepId) => {
    if (!parsedSchema?.event_simulation?.event_flows) return '';
    const flow = parsedSchema.event_simulation.event_flows[0];
    const step = flow?.steps?.find(s => s.step_id === stepId);
    return step?.event_config?.name || step?.step_id || '';
  };

  // Helper function to get step ID from event name
  const getStepIdFromEventName = (eventName) => {
    if (!parsedSchema?.event_simulation?.event_flows) return '';
    const flow = parsedSchema.event_simulation.event_flows[0];
    const step = flow?.steps?.find(s => s.event_config?.name === eventName);
    return step?.step_id || '';
  };

  // Get all available event names for dropdowns
  const getAvailableEventNames = () => {
    if (!parsedSchema?.event_simulation?.event_flows) return [];
    const flow = parsedSchema.event_simulation.event_flows[0];
    return flow?.steps?.filter(s => s.step_type === 'event' || s.step_type === 'release')
      .map(s => s.event_config?.name || s.step_id) || [];
  };

  useEffect(() => {
    if (node && node.data.stepConfig) {
      const stepConfig = node.data.stepConfig;
      
      if (stepConfig.step_type === 'event') {
        const eventConfig = stepConfig.event_config || {};
        const duration = eventConfig.duration?.distribution || {};
        
        setFormData({
          name: eventConfig.name || '',
          distribution_type: duration.type || 'normal',
          duration_mean: duration.mean || 1,
          duration_stddev: duration.stddev || 0.1,
          duration_scale: duration.scale || 1,
          duration_min: duration.min || 0,
          duration_max: duration.max || 10,
          duration_values: duration.values ? duration.values.join(', ') : '1, 2, 3',
          duration_weights: duration.weights ? duration.weights.join(', ') : '0.5, 0.3, 0.2'
        });
        
        setResourceRequirements(eventConfig.resource_requirements || []);
        
      } else if (stepConfig.step_type === 'decide') {
        const decideConfig = stepConfig.decide_config || {};
        
        setFormData({
          decision_type: decideConfig.decision_type || 'probability'
        });
        
        // Convert outcomes to use event names instead of step IDs
        const convertedOutcomes = (decideConfig.outcomes || []).map((outcome, index) => {
          const nextStepId = outcome.next_step_id;
          const nextEventName = getEventNameFromStepId(nextStepId);
          
          return {
            next_event_name: nextEventName,
            probability: outcome.conditions?.[0]?.probability || 0.5
          };
        });
        
        // Ensure at least 2 outcomes
        if (convertedOutcomes.length === 0) {
          setOutcomes([
            { next_event_name: '', probability: 0.5 },
            { next_event_name: '', probability: 0.5 }
          ]);
        } else {
          setOutcomes(convertedOutcomes);
        }
        
      } else if (stepConfig.step_type === 'release') {
        setFormData({
          name: stepConfig.event_config?.name || 'Release'
        });
      }
    }
  }, [node, parsedSchema]);

  const handleSubmit = () => {
    if (!node) return;

    // Generate step ID from name for simplicity (auto-generated)
    const generateStepId = (name, stepType) => {
      if (!name) return `${stepType}_${Date.now()}`;
      return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    };

    const stepId = generateStepId(formData.name, node.data.stepConfig.step_type);
    const updatedStepConfig = { 
      ...node.data.stepConfig,
      step_id: stepId
    };
    
    if (updatedStepConfig.step_type === 'event') {
      const distributionConfig = {
        type: formData.distribution_type
      };
      
      // Add distribution-specific parameters
      if (formData.distribution_type === 'normal') {
        distributionConfig.mean = parseFloat(formData.duration_mean) || 1;
        distributionConfig.stddev = parseFloat(formData.duration_stddev) || 0.1;
      } else if (formData.distribution_type === 'exponential') {
        distributionConfig.scale = parseFloat(formData.duration_scale) || 1;
      } else if (formData.distribution_type === 'uniform') {
        distributionConfig.min = parseFloat(formData.duration_min) || 0;
        distributionConfig.max = parseFloat(formData.duration_max) || 10;
      } else if (formData.distribution_type === 'choice') {
        try {
          distributionConfig.values = formData.duration_values.split(',').map(v => parseFloat(v.trim()));
          distributionConfig.weights = formData.duration_weights.split(',').map(w => parseFloat(w.trim()));
        } catch (e) {
          distributionConfig.values = [1, 2, 3];
          distributionConfig.weights = [0.5, 0.3, 0.2];
        }
      }
      
      updatedStepConfig.event_config = {
        name: formData.name,
        duration: { distribution: distributionConfig },
        resource_requirements: resourceRequirements
      };
      
    } else if (updatedStepConfig.step_type === 'decide') {
      // Convert outcomes back to step IDs
      const convertedOutcomes = outcomes.map((outcome, index) => ({
        outcome_id: `outcome_${index + 1}`,
        next_step_id: getStepIdFromEventName(outcome.next_event_name),
        conditions: [{ 
          condition_type: 'probability', 
          probability: parseFloat(outcome.probability) || 0.5 
        }]
      }));

      updatedStepConfig.decide_config = {
        module_id: stepId, // Auto-generated same as step_id
        decision_type: formData.decision_type,
        outcomes: convertedOutcomes
      };
      
    } else if (updatedStepConfig.step_type === 'release') {
      updatedStepConfig.event_config = {
        name: formData.name
      };
    }

    const updatedNode = {
      ...node,
      id: stepId,
      data: {
        ...node.data,
        stepConfig: updatedStepConfig,
        label: formData.name || stepId
      }
    };

    onNodeUpdate(updatedNode);
    onHide();
  };

  const addResourceRequirement = () => {
    setResourceRequirements([...resourceRequirements, {
      resource_table: 'Consultant',
      value: 'Developer',
      count: 1
    }]);
  };

  const updateResourceRequirement = (index, field, value) => {
    const updated = [...resourceRequirements];
    updated[index] = { ...updated[index], [field]: value };
    setResourceRequirements(updated);
  };

  const removeResourceRequirement = (index) => {
    setResourceRequirements(resourceRequirements.filter((_, i) => i !== index));
  };

  const addOutcome = () => {
    setOutcomes([...outcomes, {
      next_event_name: '',
      probability: 0.5
    }]);
  };

  const updateOutcome = (index, field, value) => {
    const updated = [...outcomes];
    updated[index] = { ...updated[index], [field]: value };
    setOutcomes(updated);
  };

  const removeOutcome = (index) => {
    if (outcomes.length > 1) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  const renderDistributionFields = () => {
    switch (formData.distribution_type) {
      case 'normal':
        return (
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Mean (Days)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={formData.duration_mean || 1}
                  onChange={(e) => setFormData({ ...formData, duration_mean: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Standard Deviation</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={formData.duration_stddev || 0.1}
                  onChange={(e) => setFormData({ ...formData, duration_stddev: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>
        );
      case 'exponential':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Scale (Days)</Form.Label>
            <Form.Control
              type="number"
              step="0.1"
              value={formData.duration_scale || 1}
              onChange={(e) => setFormData({ ...formData, duration_scale: e.target.value })}
            />
          </Form.Group>
        );
      case 'uniform':
        return (
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Minimum (Days)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={formData.duration_min || 0}
                  onChange={(e) => setFormData({ ...formData, duration_min: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Maximum (Days)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={formData.duration_max || 10}
                  onChange={(e) => setFormData({ ...formData, duration_max: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>
        );
      case 'choice':
        return (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Values (comma-separated)</Form.Label>
              <Form.Control
                type="text"
                value={formData.duration_values || '1, 2, 3'}
                onChange={(e) => setFormData({ ...formData, duration_values: e.target.value })}
                placeholder="1, 2, 3"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Weights (comma-separated, must sum to 1)</Form.Label>
              <Form.Control
                type="text"
                value={formData.duration_weights || '0.5, 0.3, 0.2'}
                onChange={(e) => setFormData({ ...formData, duration_weights: e.target.value })}
                placeholder="0.5, 0.3, 0.2"
              />
            </Form.Group>
          </>
        );
      default:
        return null;
    }
  };

  const renderForm = () => {
    if (!node) return null;

    const stepType = node.data.stepConfig?.step_type;

    if (stepType === 'event') {
      return (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Event Name</Form.Label>
            <Form.Control
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Display name for this event"
            />
            <Form.Text className="text-muted">
              This name will be used to identify the event in decision outcomes.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Duration Distribution Type</Form.Label>
            <Form.Select
              value={formData.distribution_type || 'normal'}
              onChange={(e) => setFormData({ ...formData, distribution_type: e.target.value })}
            >
              <option value="normal">Normal</option>
              <option value="exponential">Exponential</option>
              <option value="uniform">Uniform</option>
              <option value="choice">Choice (Discrete)</option>
            </Form.Select>
          </Form.Group>

          {renderDistributionFields()}

          <hr />
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6>Resource Requirements</h6>
            <Button size="sm" onClick={addResourceRequirement}>Add Resource</Button>
          </div>

          {resourceRequirements.map((req, index) => {
            const availableResourceTables = Object.keys(resourceDefinitions);
            const selectedResourceTable = req.resource_table || '';
            const availableResourceTypes = selectedResourceTable && resourceDefinitions[selectedResourceTable] 
              ? resourceDefinitions[selectedResourceTable].resourceTypes 
              : [];

            return (
              <div key={index} className="border p-3 mb-3 rounded">
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-2">
                      <Form.Label>Resource Table</Form.Label>
                      {availableResourceTables.length > 0 ? (
                        <Form.Select
                          value={selectedResourceTable}
                          onChange={(e) => {
                            updateResourceRequirement(index, 'resource_table', e.target.value);
                            // Reset resource type when table changes
                            updateResourceRequirement(index, 'value', '');
                          }}
                        >
                          <option value="">Select resource table...</option>
                          {availableResourceTables.map((tableName) => (
                            <option key={tableName} value={tableName}>
                              {tableName}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <Form.Control
                          type="text"
                          value={selectedResourceTable}
                          onChange={(e) => updateResourceRequirement(index, 'resource_table', e.target.value)}
                          placeholder="e.g., Consultant"
                        />
                      )}
                      {availableResourceTables.length === 0 && (
                        <Form.Text className="text-muted">
                          No resources found in database configuration. Using text input.
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-2">
                      <Form.Label>Resource Type</Form.Label>
                      {availableResourceTypes.length > 0 ? (
                        <Form.Select
                          value={req.value || ''}
                          onChange={(e) => updateResourceRequirement(index, 'value', e.target.value)}
                        >
                          <option value="">Select resource type...</option>
                          {availableResourceTypes.map((typeName) => (
                            <option key={typeName} value={typeName}>
                              {typeName}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <Form.Control
                          type="text"
                          value={req.value || ''}
                          onChange={(e) => updateResourceRequirement(index, 'value', e.target.value)}
                          placeholder={selectedResourceTable ? "Select resource table first" : "e.g., Developer"}
                          disabled={selectedResourceTable && availableResourceTypes.length === 0}
                        />
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-2">
                      <Form.Label>Count</Form.Label>
                      <Form.Control
                        type="number"
                        min="1"
                        value={req.count || 1}
                        onChange={(e) => updateResourceRequirement(index, 'count', parseInt(e.target.value) || 1)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={1}>
                    <div className="d-flex align-items-end h-100 pb-2">
                      <Button 
                        variant="outline-danger" 
                        size="sm" 
                        onClick={() => removeResourceRequirement(index)}
                      >
                        <FiTrash2 />
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>
            );
          })}
        </>
      );

    } else if (stepType === 'decide') {
      const availableEvents = getAvailableEventNames();
      
      return (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Decision Type</Form.Label>
            <Form.Select
              value={formData.decision_type || 'probability'}
              onChange={(e) => setFormData({ ...formData, decision_type: e.target.value })}
            >
              <option value="probability">Probability-based</option>
              <option value="condition">Condition-based (future)</option>
            </Form.Select>
          </Form.Group>

          <hr />
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6>Decision Outcomes</h6>
            <Button size="sm" onClick={addOutcome}>Add Outcome</Button>
          </div>

          {outcomes.map((outcome, index) => (
            <div key={index} className="border p-3 mb-3 rounded">
              <Row>
                <Col md={8}>
                  <Form.Group className="mb-2">
                    <Form.Label>Next Event</Form.Label>
                    <Form.Select
                      value={outcome.next_event_name || ''}
                      onChange={(e) => updateOutcome(index, 'next_event_name', e.target.value)}
                    >
                      <option value="">Select next event...</option>
                      {availableEvents.map((eventName, eventIndex) => (
                        <option key={eventIndex} value={eventName}>
                          {eventName}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Probability</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={outcome.probability || 0}
                      onChange={(e) => updateOutcome(index, 'probability', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={1}>
                  <div className="d-flex align-items-end h-100 pb-2">
                    <Button 
                      variant="outline-danger" 
                      size="sm" 
                      onClick={() => removeOutcome(index)}
                      disabled={outcomes.length <= 1}
                    >
                      <FiTrash2 />
                    </Button>
                  </div>
                </Col>
              </Row>
            </div>
          ))}
        </>
      );

    } else if (stepType === 'release') {
      return (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Release Name</Form.Label>
            <Form.Control
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Display name for this release step"
            />
          </Form.Group>
          
          <Form.Text className="text-muted">
            Release steps mark the end of the flow and release all resources occupied by the entity.
          </Form.Text>
        </>
      );
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Edit {node?.data.stepConfig?.step_type || 'Step'} Step</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {renderForm()}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>
      </Modal.Footer>
    </Modal>
  );
};

// Node types definition
const nodeTypes = {
  process: ProcessNode,
  decide: DecideNode,
  release: ReleaseNode,
};

const ModularEventFlow = ({ yamlContent, parsedSchema, onDiagramChange, theme }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [flowData, setFlowData] = useState(null);
  const [resourceDefinitions, setResourceDefinitions] = useState({});
  const [schemaId, setSchemaId] = useState(null);
  const [layoutMap, setLayoutMap] = useState({});

  // Generate a consistent ID for the schema based on flow content
  useEffect(() => {
    if (yamlContent) {
      try {
        // Generate a stable ID that doesn't change when positions are modified
        const yamlPrefix = yamlContent.substring(0, 200).replace(/\s+/g, '');
        let stableId = '';
        
        // Simple hash function to create a stable ID
        for (let i = 0; i < yamlPrefix.length; i++) {
          stableId += yamlPrefix.charCodeAt(i);
        }
        
        const id = `modular_flow_positions_${stableId}`;
        setSchemaId(id);
      } catch (error) {
        console.error('Error generating schema ID:', error);
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

  // Debounced save to localStorage
  const debounceRef = useRef();
  const saveLayoutToLocalStorage = useCallback((layout, key) => {
    if (!key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(layout));
      } catch (err) {
        console.error('Error saving layout to localStorage:', err);
      }
    }, 300);
  }, []);

  // Save layout to localStorage whenever layoutMap changes
  useEffect(() => {
    if (schemaId) {
      saveLayoutToLocalStorage(layoutMap, schemaId);
    }
  }, [layoutMap, schemaId, saveLayoutToLocalStorage]);

  // Extract resource definitions from simulation configuration resource_capacities
  useEffect(() => {
    if (!parsedSchema?.event_simulation?.resource_capacities) {
      setResourceDefinitions({});
      return;
    }

    try {
      const resourceCapacities = parsedSchema.event_simulation.resource_capacities;
      const definitions = {};
      
      // Extract resource tables and their types from capacity rules
      Object.keys(resourceCapacities).forEach(resourceTable => {
        const capacityRules = resourceCapacities[resourceTable]?.capacity_rules || [];
        
        const resourceTypes = capacityRules.map(rule => rule.resource_type).filter(Boolean);
        
        if (resourceTypes.length > 0) {
          definitions[resourceTable] = {
            resourceTypes: resourceTypes,
            attributeName: 'resource_type'
          };
        }
      });
      
      setResourceDefinitions(definitions);
    } catch (error) {
      console.error('Error extracting resource definitions from simulation config:', error);
      setResourceDefinitions({});
    }
  }, [parsedSchema]);

  // Parse event_flows from schema and build diagram
  useEffect(() => {
    if (!parsedSchema?.event_simulation?.event_flows) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const eventFlows = parsedSchema.event_simulation.event_flows;
    if (eventFlows.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Use first flow for now
    const flow = eventFlows[0];
    setFlowData(flow);
    
    // Store current node positions before rebuilding
    const currentPositions = {};
    nodes.forEach(node => {
      currentPositions[node.id] = node.position;
    });
    
    buildNodesAndEdges(flow, currentPositions);
  }, [parsedSchema]);

  const buildNodesAndEdges = useCallback((flow, currentPositions = {}) => {
    const newNodes = [];
    const newEdges = [];

    // Create nodes from steps
    flow.steps.forEach((step, index) => {
      // Use position from localStorage if available, then current positions, then default layout
      const savedPosition = layoutMap[step.step_id];
      const currentPosition = currentPositions[step.step_id];
      const defaultX = 100 + (index % 3) * 300;
      const defaultY = 100 + Math.floor(index / 3) * 200;
      
      const position = savedPosition || currentPosition || { x: defaultX, y: defaultY };

      let nodeType = 'process';
      if (step.step_type === 'decide') nodeType = 'decide';
      if (step.step_type === 'release') nodeType = 'release';

      const node = {
        id: step.step_id,
        type: nodeType,
        position: position,
        data: {
          label: step.step_id,
          stepConfig: step,
          theme: theme,
          onDelete: () => onNodesDelete([{ id: step.step_id }])
        }
      };

      newNodes.push(node);
    });

    // Create edges from step connections
    flow.steps.forEach((step) => {
      if (step.step_type === 'decide' && step.decide_config?.outcomes) {
        // Handle decide step outcomes
        step.decide_config.outcomes.forEach((outcome, index) => {
          if (outcome.next_step_id) {
            newEdges.push({
              id: `${step.step_id}-${outcome.next_step_id}`,
              source: step.step_id,
              target: outcome.next_step_id,
              sourceHandle: `outcome-${index}`,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#ed8936', strokeWidth: 2 }
            });
          }
        });
      } else if (step.next_steps && step.next_steps.length > 0) {
        // Handle regular next_steps
        step.next_steps.forEach((nextStepId) => {
          newEdges.push({
            id: `${step.step_id}-${nextStepId}`,
            source: step.step_id,
            target: nextStepId,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#38a169', strokeWidth: 2 }
          });
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [onNodesDelete, theme, layoutMap]);

  const onConnect = useCallback((params) => {
    // Add visual edge
    const newEdge = {
      ...params,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#38a169', strokeWidth: 2 }
    };
    setEdges((eds) => addEdge(newEdge, eds));

    // Update YAML schema
    if (flowData && parsedSchema) {
      const updatedSchema = { ...parsedSchema };
      const flow = updatedSchema.event_simulation.event_flows[0];
      const sourceStep = flow.steps.find(s => s.step_id === params.source);

      if (sourceStep) {
        if (sourceStep.step_type === 'decide') {
          // Handle decide step connections through outcomes
          const outcomeIndex = parseInt(params.sourceHandle?.replace('outcome-', '') || '0');
          if (sourceStep.decide_config?.outcomes?.[outcomeIndex]) {
            sourceStep.decide_config.outcomes[outcomeIndex].next_step_id = params.target;
          }
        } else {
          // Handle regular next_steps
          if (!sourceStep.next_steps) sourceStep.next_steps = [];
          if (!sourceStep.next_steps.includes(params.target)) {
            sourceStep.next_steps.push(params.target);
          }
        }

        onDiagramChange(updatedSchema);
      }
    }
  }, [flowData, parsedSchema, onDiagramChange]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onNodeDoubleClick = useCallback((event, node) => {
    setSelectedNode(node);
    setShowEditModal(true);
  }, []);

  // Handle keyboard shortcuts
  const onKeyDown = useCallback((event) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
      onNodesDelete([selectedNode]);
      setSelectedNode(null);
    }
  }, [selectedNode, onNodesDelete]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  const handleNodeUpdate = (updatedNode) => {
    const oldNodeId = selectedNode?.id;
    const newNodeId = updatedNode.id;
    
    // Update visual node
    setNodes((nds) =>
      nds.map((node) =>
        node.id === oldNodeId ? updatedNode : node
      )
    );

    // Update edges if node ID changed
    if (oldNodeId !== newNodeId) {
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          source: edge.source === oldNodeId ? newNodeId : edge.source,
          target: edge.target === oldNodeId ? newNodeId : edge.target,
          id: edge.id.replace(oldNodeId, newNodeId)
        }))
      );
    }

    // Update YAML schema
    if (flowData && parsedSchema) {
      const updatedSchema = { ...parsedSchema };
      const flow = updatedSchema.event_simulation.event_flows[0];
      const stepIndex = flow.steps.findIndex(s => s.step_id === oldNodeId);
      
      if (stepIndex !== -1) {
        // Update the step configuration
        flow.steps[stepIndex] = updatedNode.data.stepConfig;
        
        // Update references to this step in other steps if ID changed
        if (oldNodeId !== newNodeId) {
          flow.steps.forEach(step => {
            // Update next_steps references
            if (step.next_steps) {
              step.next_steps = step.next_steps.map(id => id === oldNodeId ? newNodeId : id);
            }
            // Update decide outcomes references
            if (step.decide_config?.outcomes) {
              step.decide_config.outcomes.forEach(outcome => {
                if (outcome.next_step_id === oldNodeId) {
                  outcome.next_step_id = newNodeId;
                }
              });
            }
          });
          
          // Update initial_step if it was changed
          if (flow.initial_step === oldNodeId) {
            flow.initial_step = newNodeId;
          }
        }
        
        onDiagramChange(updatedSchema);
      }
    }
  };

  // Handle node drag end to save positions to localStorage
  const onNodeDragStop = useCallback((event, node) => {
    setNodes(nds =>
      nds.map(n => n.id === node.id ? { ...n, position: node.position } : n)
    );
    // Update layoutMap in state (triggers debounced save)
    setLayoutMap(prev => ({
      ...prev,
      [node.id]: { ...node.position }
    }));
  }, [setNodes]);

  const onNodesDelete = useCallback((deletedNodes) => {
    if (flowData && parsedSchema) {
      const updatedSchema = { ...parsedSchema };
      const flow = updatedSchema.event_simulation.event_flows[0];
      
      const deletedIds = deletedNodes.map(n => n.id);
      
      // Remove deleted steps
      flow.steps = flow.steps.filter(step => !deletedIds.includes(step.step_id));
      
      // Clean up references in remaining steps
      flow.steps.forEach(step => {
        if (step.next_steps) {
          step.next_steps = step.next_steps.filter(id => !deletedIds.includes(id));
        }
        if (step.decide_config?.outcomes) {
          step.decide_config.outcomes.forEach(outcome => {
            if (deletedIds.includes(outcome.next_step_id)) {
              outcome.next_step_id = "";
            }
          });
        }
      });

      // Update initial_step if it was deleted
      if (deletedIds.includes(flow.initial_step)) {
        flow.initial_step = flow.steps.length > 0 ? flow.steps[0].step_id : '';
      }

      onDiagramChange(updatedSchema);
    }
  }, [flowData, parsedSchema, onDiagramChange]);

  return (
    <div className="modular-event-flow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        className={theme === 'dark' ? 'dark-theme' : ''}
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>

      <NodeEditModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        node={selectedNode}
        onNodeUpdate={handleNodeUpdate}
        theme={theme}
        parsedSchema={parsedSchema}
        resourceDefinitions={resourceDefinitions}
      />
    </div>
  );
};

export default ModularEventFlow;