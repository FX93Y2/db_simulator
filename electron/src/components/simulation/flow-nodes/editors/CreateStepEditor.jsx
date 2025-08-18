import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import ValidatedNameInput from '../components/ValidatedNameInput';

const CreateStepEditor = ({ 
  formData, 
  onFormDataChange,
  availableSteps,
  availableEntityTables = [], // Entity tables from database config
  availableEventTables = [], // Event tables from database config
  nameValidation = { valid: true, error: null }
}) => {
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
                  value={formData.interarrival_mean || 2}
                  onChange={(e) => onFormDataChange({ interarrival_mean: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Standard Deviation</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={formData.interarrival_stddev || 0.5}
                  onChange={(e) => onFormDataChange({ interarrival_stddev: e.target.value })}
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
              value={formData.interarrival_scale || 2}
              onChange={(e) => onFormDataChange({ interarrival_scale: e.target.value })}
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
                  value={formData.interarrival_min || 1}
                  onChange={(e) => onFormDataChange({ interarrival_min: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Maximum (Days)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={formData.interarrival_max || 3}
                  onChange={(e) => onFormDataChange({ interarrival_max: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>
        );
      default:
        return null;
    }
  };

  return (
    <div className="create-step-editor">
      <div className="step-info-section">
        <ValidatedNameInput
          value={formData.name || ''}
          onChange={(name) => onFormDataChange({ name })}
          validation={nameValidation}
          label="Create Module Name"
          placeholder="Enter a name for this module"
          className="mb-3"
        />

        <Row>
          <Col md={6}>
            {/* Entity Table Selection */}
            <Form.Group className="mb-3">
        <Form.Label>Entity Table</Form.Label>
        {availableEntityTables.length > 0 ? (
          <Form.Select
            value={formData.entity_table || ''}
            onChange={(e) => onFormDataChange({ entity_table: e.target.value })}
            required
          >
            <option value="">Select entity table...</option>
            {availableEntityTables.map((table) => (
              <option key={table} value={table}>{table}</option>
            ))}
          </Form.Select>
        ) : (
          <Form.Control
            type="text"
            value={formData.entity_table || ''}
            onChange={(e) => onFormDataChange({ entity_table: e.target.value })}
            placeholder="Enter entity table name"
            required
          />
        )}
            </Form.Group>
          </Col>
          
          <Col md={6}>
            {/* Event Table Selection */}
            <Form.Group className="mb-3">
              <Form.Label>Event Table</Form.Label>
              {availableEventTables.length > 0 ? (
                <Form.Select
                  value={formData.event_table || ''}
                  onChange={(e) => onFormDataChange({ event_table: e.target.value })}
                  required
                >
                  <option value="">Select event table...</option>
                  {availableEventTables.map((table) => (
                    <option key={table} value={table}>{table}</option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  type="text"
                  value={formData.event_table || ''}
                  onChange={(e) => onFormDataChange({ event_table: e.target.value })}
                  placeholder="Enter event table name"
                  required
                />
              )}
              <Form.Text className="text-muted">
                Event table for tracking flow events
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
        
        <Row>
          <Col md={6}>
            {/* Max Entities */}
            <Form.Group className="mb-3">
              <Form.Label>Max Entities</Form.Label>
              <Form.Control
                type="text"
                value={formData.max_entities || 'n/a'}
                onChange={(e) => onFormDataChange({ max_entities: e.target.value })}
                placeholder="Enter number or 'n/a' for unlimited"
              />
              <Form.Text className="text-muted">
                Maximum entities to create ('n/a' for unlimited)
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
      </div>
      
      {/* Interarrival Time Section */}
      <div className="step-info-section">
        <div className="section-title">Interarrival Time</div>
        
        <Form.Group className="mb-3">
          <Form.Label>Distribution Type</Form.Label>
          <Form.Select
            value={formData.distribution_type || 'exponential'}
            onChange={(e) => onFormDataChange({ distribution_type: e.target.value })}
          >
            <option value="exponential">Exponential</option>
            <option value="normal">Normal</option>
            <option value="uniform">Uniform</option>
          </Form.Select>
        </Form.Group>

        {renderDistributionFields()}
      </div>

      {/* Next Steps Selection */}
      <Form.Group className="mb-3">
        <Form.Label>Next Step</Form.Label>
        <Form.Select
          value={formData.next_step || ''}
          onChange={(e) => onFormDataChange({ next_step: e.target.value })}
        >
          <option value="">
            {availableSteps.length > 0 ? 'Select next step...' : 'No steps available (add other steps first)'}
          </option>
          {availableSteps.map((stepName) => (
            <option key={stepName} value={stepName}>{stepName}</option>
          ))}
        </Form.Select>
        <Form.Text className="text-muted">
          {availableSteps.length === 0 ? 'Create module can be saved without next step when no other steps exist' : 'Select the next step in the flow'}
        </Form.Text>
      </Form.Group>
    </div>
  );
};

export default CreateStepEditor;