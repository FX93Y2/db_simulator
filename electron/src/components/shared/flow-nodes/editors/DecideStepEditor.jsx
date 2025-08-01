import React from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';

const DecideStepEditor = ({ 
  formData, 
  onFormDataChange,
  outcomes,
  onOutcomeChange,
  onAddOutcome,
  onRemoveOutcome,
  availableSteps,
  availableAttributes
}) => {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Decision Type</Form.Label>
        <Form.Select
          value={formData.decision_type || 'probability'}
          onChange={(e) => onFormDataChange({ decision_type: e.target.value })}
        >
          <option value="probability">Probability-based</option>
          <option value="condition">Condition-based</option>
        </Form.Select>
      </Form.Group>

      <hr />
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Decision Outcomes</h6>
        <Button size="sm" onClick={onAddOutcome}>Add Outcome</Button>
      </div>

      {outcomes.map((outcome, index) => (
        <div key={index} className="border p-3 mb-3 rounded">
          <Row>
            <Col md={formData.decision_type === 'condition' ? 6 : 8}>
              <Form.Group className="mb-2">
                <Form.Label>Next Step</Form.Label>
                <Form.Select
                  value={outcome.next_event_name || ''}
                  onChange={(e) => onOutcomeChange(index, 'next_event_name', e.target.value)}
                >
                  <option value="">Select next step...</option>
                  {availableSteps.map((stepName, stepIndex) => (
                    <option key={stepIndex} value={stepName}>
                      {stepName}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            {formData.decision_type === 'probability' ? (
              <Col md={3}>
                <Form.Group className="mb-2">
                  <Form.Label>Probability</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={outcome.probability || 0}
                    onChange={(e) => onOutcomeChange(index, 'probability', e.target.value)}
                  />
                </Form.Group>
              </Col>
            ) : (
              <Col md={8}>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-2">
                      <Form.Label>If</Form.Label>
                      <Form.Select
                        value={outcome.if || 'Attribute'}
                        onChange={(e) => onOutcomeChange(index, 'if', e.target.value)}
                      >
                        <option value="Attribute">Attribute</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-2">
                      <Form.Label>Name</Form.Label>
                      <Form.Select
                        value={outcome.name || ''}
                        onChange={(e) => onOutcomeChange(index, 'name', e.target.value)}
                      >
                        <option value="">Select attribute...</option>
                        {availableAttributes.map(attr => (
                          <option key={attr} value={attr}>{attr}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-2">
                      <Form.Label>Is</Form.Label>
                      <Form.Select
                        value={outcome.is || '=='}
                        onChange={(e) => onOutcomeChange(index, 'is', e.target.value)}
                      >
                        <option value="==">=</option>
                        <option value="<>">&lt;&gt;</option>
                        <option value=">">&gt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&lt;=</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-2">
                      <Form.Label>Value</Form.Label>
                      <Form.Control
                        type="text"
                        value={outcome.value || ''}
                        onChange={(e) => onOutcomeChange(index, 'value', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Col>
            )}

            <Col md={1}>
              <div className="d-flex align-items-end h-100 pb-2">
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={() => onRemoveOutcome(index)}
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
};

export default DecideStepEditor;