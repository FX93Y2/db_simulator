import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import ValidatedNameInput from '../components/ValidatedNameInput';
import { DistributionFormulaInput, convertDistributionToFormula, getDefaultFormula } from '../../../shared/distribution';

const CreateStepEditor = ({
  formData,
  onFormDataChange,
  availableSteps,
  availableEntityTables = [], // Entity tables from database config
  nameValidation = { valid: true, error: null },
  stepTypes = {} // Map of step_id -> step_type for validation
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
            {/* Event Flow Label */}
            <Form.Group className="mb-3">
              <Form.Label>Event Flow</Form.Label>
              <Form.Control
                type="text"
                value={formData.event_flow || ''}
                onChange={(e) => onFormDataChange({ event_flow: e.target.value })}
                placeholder="Optional label for this flow (defaults to flow id)"
              />
              <Form.Text className="text-muted">
                Flow label used for tracking and resource allocation keys
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

        <Row>
          <Col md={12}>
            {/* Creation Mode Selection */}
            <Form.Group className="mb-3">
              <Form.Label>Creation Mode</Form.Label>
              <div>
                <Form.Check
                  inline
                  type="radio"
                  label="Standard (Time-based Arrival)"
                  name="creationMode"
                  id="mode-standard"
                  checked={!formData.is_triggered}
                  onChange={() => onFormDataChange({ is_triggered: false })}
                />
                <Form.Check
                  inline
                  type="radio"
                  label="Triggered (Parent Entity Span)"
                  name="creationMode"
                  id="mode-triggered"
                  checked={formData.is_triggered}
                  onChange={() => onFormDataChange({ is_triggered: true, interarrival_formula: null, interarrival_time_unit: null })}
                />
              </div>
              <Form.Text className="text-muted">
                {formData.is_triggered
                  ? "Entities are created when triggered by a parent entity flow (requires incoming connection)."
                  : "Entities are created based on a time distribution (entry point)."}
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
      </div>

      {/* Interarrival Time Section - Only show for Standard Mode */}
      {!formData.is_triggered && (
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
      )}

      {/* Next Steps Selection (supports forking) */}
      <Form.Group className="mb-3">
        <Form.Label>Next Steps (Forking)</Form.Label>
        {/* Render existing next steps */}
        <div className="mb-2">
          {(formData.next_steps || (formData.next_step ? [formData.next_step] : [])).map((stepId, index) => (
            <div key={index} className="d-flex align-items-center mb-1">
              <span className="badge bg-secondary me-2">{stepId}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger py-0 px-1"
                onClick={() => {
                  const currentSteps = formData.next_steps || (formData.next_step ? [formData.next_step] : []);
                  const newSteps = currentSteps.filter((_, i) => i !== index);
                  onFormDataChange({ next_steps: newSteps, next_step: newSteps[0] || null });
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Add new next step */}
        <Form.Select
          value=""
          onChange={(e) => {
            const stepToAdd = e.target.value;
            if (stepToAdd) {
              const currentSteps = formData.next_steps || (formData.next_step ? [formData.next_step] : []);

              // Validation: "As long as the next node connected isn't create, it can only connect with one node"
              // Implementation: Max 1 non-create step allowed. Unlimited create steps allowed.
              const stepType = stepTypes[stepToAdd];
              const isCreateStep = stepType === 'create';

              if (!isCreateStep) {
                const hasExistingNonCreate = currentSteps.some(s => stepTypes[s] !== 'create');
                if (hasExistingNonCreate) {
                  // Already has a non-create step, cannot add another
                  return;
                }
              }

              if (!currentSteps.includes(stepToAdd)) {
                const newSteps = [...currentSteps, stepToAdd];
                // Keep next_step synced as the first non-create step, or just the first step
                const primaryStep = newSteps.find(s => stepTypes[s] !== 'create') || newSteps[0];
                onFormDataChange({ next_steps: newSteps, next_step: primaryStep });
              }
            }
          }}
        >
          <option value="">+ Add Next Step...</option>
          {availableSteps
            .filter(step => !(formData.next_steps || (formData.next_step ? [formData.next_step] : [])).includes(step))
            .map((stepName) => {
              const type = stepTypes[stepName];
              const isCreate = type === 'create';
              const currentSteps = formData.next_steps || (formData.next_step ? [formData.next_step] : []);
              const hasNonCreate = currentSteps.some(s => stepTypes[s] !== 'create');

              // Disable non-create steps if one is already selected
              const disabled = !isCreate && hasNonCreate;

              return (
                <option key={stepName} value={stepName} disabled={disabled}>
                  {stepName} {isCreate ? '(Sub-Flow)' : ''} {disabled ? '(Limit 1)' : ''}
                </option>
              );
            })}
        </Form.Select>
        <Form.Text className="text-muted">
          Connect to a standard flow step (max 1) and/or multiple sub-flow creation steps (forking).
        </Form.Text>
      </Form.Group>
    </div>
  );
};

export default CreateStepEditor;
