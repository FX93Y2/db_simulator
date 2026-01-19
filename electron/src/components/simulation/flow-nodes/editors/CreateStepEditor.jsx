import React from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';
import ValidatedNameInput from '../components/ValidatedNameInput';
import { DistributionFormulaInput } from '../../../shared/distribution';

const CreateStepEditor = ({
  formData,
  onFormDataChange,
  availableSteps,
  availableEntityTables = [],
  nameValidation = { valid: true, error: null },
  stepTypes = {}
}) => {
  // Get current formula value
  const getCurrentFormula = () => {
    return formData.interarrival_formula || '';
  };

  const handleFormulaChange = (newFormula) => {
    onFormDataChange({ interarrival_formula: newFormula });
  };

  return (
    <>
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
            <Form.Group className="mb-3">
              <Form.Label>Event Flow</Form.Label>
              <Form.Control
                type="text"
                value={formData.event_flow || ''}
                onChange={(e) => onFormDataChange({ event_flow: e.target.value })}
                placeholder="Optional label for this flow"
              />
            </Form.Group>
          </Col>
        </Row>

        <div className="mt-4 mb-3">
          <h6 className="text-uppercase text-muted small fw-bold mb-3">Creation Configuration</h6>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Max Entities</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.max_entities || 'n/a'}
                  onChange={(e) => onFormDataChange({ max_entities: e.target.value })}
                  placeholder="Enter number or 'n/a' for unlimited"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Creation Mode</Form.Label>
                <div>
                  <Form.Check
                    inline
                    type="radio"
                    label="Standard"
                    name="creationMode"
                    id="mode-standard"
                    checked={!formData.is_triggered}
                    onChange={() => onFormDataChange({ is_triggered: false })}
                  />
                  <Form.Check
                    inline
                    type="radio"
                    label="Triggered"
                    name="creationMode"
                    id="mode-triggered"
                    checked={formData.is_triggered}
                    onChange={() => onFormDataChange({ is_triggered: true, interarrival_formula: null, interarrival_time_unit: null })}
                  />
                </div>
              </Form.Group>
            </Col>
          </Row>

          {!formData.is_triggered && (
            <div className="p-3 bg-light rounded bg-opacity-10 border">
              <h6 className="small text-muted mb-3 text-uppercase fw-bold">Interarrival Settings</h6>
              <Row>
                <Col md={8}>
                  <DistributionFormulaInput
                    value={getCurrentFormula()}
                    onChange={handleFormulaChange}
                    label="Time Distribution"
                    required
                    singleLine={true}
                    helpText="Distribution for time between entity arrivals"
                  />
                </Col>
                <Col md={4}>
                  <Form.Group>
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
          )}
        </div>
      </div>
    </>
  );
};

export default CreateStepEditor;
