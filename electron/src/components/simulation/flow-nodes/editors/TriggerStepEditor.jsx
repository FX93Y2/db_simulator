import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import ValidatedNameInput from '../components/ValidatedNameInput';

const TriggerStepEditor = ({
  formData,
  onFormDataChange,
  availableSteps,
  availableTargetTables = [], // Related tables sourced from database config
  nameValidation = { valid: true, error: null }
}) => {
  return (
    <div className="trigger-step-editor">
      <div className="step-info-section">
        <ValidatedNameInput
          value={formData.name || ''}
          onChange={(name) => onFormDataChange({ name })}
          validation={nameValidation}
          label="Trigger Module Name"
          placeholder="Enter a name for this trigger"
          className="mb-3"
        />

        <Row>
          <Col md={6}>
            {/* Target Table Selection */}
            <Form.Group className="mb-3">
              <Form.Label>
                Target Table <span className="text-danger">*</span>
              </Form.Label>
              {availableTargetTables.length > 0 ? (
                <Form.Select
                  value={formData.target_table || ''}
                  onChange={(e) => onFormDataChange({ target_table: e.target.value })}
                  required
                >
                  <option value="">Select target table...</option>
                  {availableTargetTables.map((table) => (
                    <option key={table} value={table}>{table}</option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  type="text"
                  value={formData.target_table || ''}
                  onChange={(e) => onFormDataChange({ target_table: e.target.value })}
                  placeholder="Enter target table name"
                  required
                />
              )}
              <Form.Text className="text-muted">
                Table to generate data for
              </Form.Text>
            </Form.Group>
          </Col>

          <Col md={6}>
            {/* Count Input (supports int or formula) */}
            <Form.Group className="mb-3">
              <Form.Label>
                Count <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.count !== undefined ? formData.count : ''}
                onChange={(e) => onFormDataChange({ count: e.target.value })}
                placeholder="e.g., 3 or UNIF(1, 5)"
                required
              />
              <Form.Text className="text-muted">
                Fixed number or formula
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={12}>
            {/* FK Column (optional) */}
            <Form.Group className="mb-3">
              <Form.Label>Foreign Key Column (Optional)</Form.Label>
              <Form.Control
                type="text"
                value={formData.fk_column || ''}
                onChange={(e) => onFormDataChange({ fk_column: e.target.value })}
              />
              <Form.Text className="text-muted">
                Leave empty to auto-detect
              </Form.Text>
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
          {availableSteps.length === 0 ? 'Trigger module can be saved without next step when no other steps exist' : 'Select the next step in the flow'}
        </Form.Text>
      </Form.Group>
    </div>
  );
};

export default TriggerStepEditor;
