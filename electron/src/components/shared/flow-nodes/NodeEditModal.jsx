import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';
import ConfirmationModal from '../ConfirmationModal';
import UnsavedChangesModal from '../../modals/UnsavedChangesModal';

const NodeEditModal = ({ show, onHide, node, onNodeUpdate, onNodeDelete, theme, parsedSchema, resourceDefinitions }) => {
  const [formData, setFormData] = useState({});
  const [resourceRequirements, setResourceRequirements] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [lastNodeId, setLastNodeId] = useState(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);

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
    // Only reset form data when node actually changes (new node opened), not during auto-updates
    if (node && node.data.stepConfig && (!lastNodeId || node.id !== lastNodeId)) {
      setLastNodeId(node.id);
      setIsUserEditing(false);
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
        const convertedOutcomes = (decideConfig.outcomes || []).map((outcome) => {
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
  }, [node, parsedSchema, lastNodeId]);


  // Helper function to handle form data changes and mark as user editing
  const handleFormDataChange = (newData) => {
    setIsUserEditing(true);
    setFormData({ ...formData, ...newData });
  };

  // Helper function to handle resource requirement changes and mark as user editing
  const handleResourceRequirementChange = (index, field, value) => {
    setIsUserEditing(true);
    updateResourceRequirement(index, field, value);
  };

  // Helper function to handle outcome changes and mark as user editing
  const handleOutcomeChange = (index, field, value) => {
    setIsUserEditing(true);
    updateOutcome(index, field, value);
  };

  // Handle node deletion
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    try {
      onNodeDelete([node]); // Pass as array since onNodesDelete expects array
      setShowDeleteConfirm(false);
      onHide();
    } catch (error) {
      console.error('Error deleting node:', error);
      setShowDeleteConfirm(false);
    }
  };

  // Force immediate save without debounce
  const forceSave = () => {
    if (!node || !formData.name) {
      return false; // Don't save if basic validation fails
    }

    try {
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
      return true;
    } catch (error) {
      console.error('Error saving node:', error);
      return false;
    }
  };

  // Handle save and close
  const handleSaveAndClose = () => {
    if (forceSave()) {
      onHide();
    }
    // If save fails, modal stays open
  };

  // Handle close button (X) - check for unsaved changes
  const handleCloseButton = () => {
    if (isUserEditing) {
      setShowUnsavedChangesModal(true);
    } else {
      onHide();
    }
  };

  // Confirm discard changes
  const handleDiscardChanges = () => {
    setShowUnsavedChangesModal(false);
    onHide();
  };

  const addResourceRequirement = () => {
    setIsUserEditing(true);
    // Get the first available resource table and type from the database config
    const availableResourceTables = Object.keys(resourceDefinitions);
    const defaultResourceTable = availableResourceTables.length > 0 ? availableResourceTables[0] : 'Consultant';
    const defaultResourceType = availableResourceTables.length > 0 && resourceDefinitions[defaultResourceTable]?.resourceTypes?.length > 0
      ? resourceDefinitions[defaultResourceTable].resourceTypes[0]
      : 'Developer';
    
    setResourceRequirements([...resourceRequirements, {
      resource_table: defaultResourceTable,
      value: defaultResourceType,
      count: 1
    }]);
  };

  const updateResourceRequirement = (index, field, value) => {
    const updated = [...resourceRequirements];
    updated[index] = { ...updated[index], [field]: value };
    setResourceRequirements(updated);
  };

  const removeResourceRequirement = (index) => {
    setIsUserEditing(true);
    setResourceRequirements(resourceRequirements.filter((_, i) => i !== index));
  };

  const addOutcome = () => {
    setIsUserEditing(true);
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
      setIsUserEditing(true);
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
                  onChange={(e) => handleFormDataChange({ duration_mean: e.target.value })}
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
                  onChange={(e) => handleFormDataChange({ duration_stddev: e.target.value })}
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
              onChange={(e) => handleFormDataChange({ duration_scale: e.target.value })}
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
                  onChange={(e) => handleFormDataChange({ duration_min: e.target.value })}
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
                  onChange={(e) => handleFormDataChange({ duration_max: e.target.value })}
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
                onChange={(e) => handleFormDataChange({ duration_values: e.target.value })}
                placeholder="1, 2, 3"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Weights (comma-separated, must sum to 1)</Form.Label>
              <Form.Control
                type="text"
                value={formData.duration_weights || '0.5, 0.3, 0.2'}
                onChange={(e) => handleFormDataChange({ duration_weights: e.target.value })}
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
              onChange={(e) => handleFormDataChange({ name: e.target.value })}
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
              onChange={(e) => handleFormDataChange({ distribution_type: e.target.value })}
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
                            handleResourceRequirementChange(index, 'resource_table', e.target.value);
                            // Reset resource type when table changes
                            handleResourceRequirementChange(index, 'value', '');
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
                          onChange={(e) => handleResourceRequirementChange(index, 'resource_table', e.target.value)}
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
                          onChange={(e) => handleResourceRequirementChange(index, 'value', e.target.value)}
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
                          onChange={(e) => handleResourceRequirementChange(index, 'value', e.target.value)}
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
                        onChange={(e) => handleResourceRequirementChange(index, 'count', parseInt(e.target.value) || 1)}
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
              onChange={(e) => handleFormDataChange({ decision_type: e.target.value })}
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
                      onChange={(e) => handleOutcomeChange(index, 'next_event_name', e.target.value)}
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
                      onChange={(e) => handleOutcomeChange(index, 'probability', e.target.value)}
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
              onChange={(e) => handleFormDataChange({ name: e.target.value })}
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
    <>
    <Modal show={show} onHide={handleCloseButton} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Edit {node?.data.stepConfig?.step_type || 'Step'} Step</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {renderForm()}
      </Modal.Body>
      <Modal.Footer>
        {node && (
          <Button 
            variant="outline-danger" 
            onClick={handleDelete}
            className="me-auto"
          >
            <FiTrash2 className="me-2" /> Delete Step
          </Button>
        )}
        <Button variant="primary" onClick={handleSaveAndClose}>Save & Close</Button>
      </Modal.Footer>
    </Modal>

    <ConfirmationModal
      show={showDeleteConfirm}
      onHide={() => setShowDeleteConfirm(false)}
      onConfirm={confirmDelete}
      title="Delete Step"
      message={`Are you sure you want to delete this ${node?.data.stepConfig?.step_type || 'step'}? This action cannot be undone and will remove all connections to this step.`}
      confirmText="Delete Step"
      cancelText="Cancel"
      variant="danger"
      theme={theme}
    />

    <UnsavedChangesModal
      show={showUnsavedChangesModal}
      onHide={() => setShowUnsavedChangesModal(false)}
      onSave={handleSaveAndClose}
      onDiscard={handleDiscardChanges}
      theme={theme}
    />
  </>
  );
};

export default NodeEditModal;