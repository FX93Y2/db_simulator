import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import ValidatedNameInput from '../components/ValidatedNameInput';
import { DistributionFormulaInput, convertDistributionToFormula, getDefaultFormula } from '../../../shared/distribution';

const CreateStepEditor = ({ 
  formData, 
  onFormDataChange,
  availableSteps,
  availableEntityTables = [], // Entity tables from database config
  availableEventTables = [], // Event tables from database config
  nameValidation = { valid: true, error: null }
}) => {
  // Get current formula value
  const getCurrentFormula = () => {
    return formData.interarrival_formula || '';
  };
  
  const handleFormulaChange = (newFormula) => {
    onFormDataChange({ interarrival_formula: newFormula });
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
        
        <Row>
          <Col md={8}>
            <DistributionFormulaInput
              value={getCurrentFormula()}
              onChange={handleFormulaChange}
              label="Interarrival Time Distribution"
              placeholder="e.g., NORM(5, 1) or UNIF(1, 10)"
              required
              helpText="Distribution for time between entity arrivals"
            />
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Units</Form.Label>
              <Form.Select
                value={formData.interarrival_time_unit || ''}
                onChange={(e) => onFormDataChange({ interarrival_time_unit: e.target.value || undefined })}
              >
                <option value="">Select time unit...</option>
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
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