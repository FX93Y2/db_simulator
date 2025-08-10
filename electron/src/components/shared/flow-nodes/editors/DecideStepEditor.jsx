import React from 'react';
import { Form, Button } from 'react-bootstrap';
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
      {/* Name */}
      <Form.Group className="mb-4">
        <Form.Label>Name</Form.Label>
        <Form.Control
          type="text"
          value={formData.name || ''}
          onChange={(e) => onFormDataChange({ name: e.target.value })}
          placeholder="Enter a name for this decision"
        />
        <Form.Text className="text-muted">
          Name shown on the node and used in step ID
        </Form.Text>
      </Form.Group>

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
      <div className="step-editor-section">
        <div className="section-header">
          <h6>Decision Outcomes</h6>
          <Button 
            variant="outline-primary"
            size="sm" 
            onClick={onAddOutcome}
            className="add-step-item-btn"
          >
            + Add Outcome
          </Button>
        </div>

        <div className="step-editor-grid-container">
          {/* Header */}
          <div className={`step-editor-grid-header ${formData.decision_type === 'condition' ? 'decide-condition' : 'decide-probability'}`}>
            <div className="grid-header-cell">Next Step</div>
            <div className="grid-header-cell">
              {formData.decision_type === 'condition' ? 'Condition' : 'Probability'}
            </div>
            <div className="grid-header-cell"></div>
          </div>
          
          {/* Data Rows */}
          {outcomes.map((outcome, index) => (
            <div key={index} className={`step-editor-grid-row ${formData.decision_type === 'condition' ? 'decide-condition' : 'decide-probability'}`}>
              <div className="grid-cell">
                <Form.Select
                  value={outcome.next_event_name || ''}
                  onChange={(e) => onOutcomeChange(index, 'next_event_name', e.target.value)}
                  size="sm"
                  style={{ width: '100%' }}
                >
                  <option value="">Select next step...</option>
                  {availableSteps.map((stepName, stepIndex) => (
                    <option key={stepIndex} value={stepName}>
                      {stepName}
                    </option>
                  ))}
                </Form.Select>
              </div>
              
              {formData.decision_type === 'probability' ? (
                <div className="grid-cell">
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={outcome.probability || 0}
                    onChange={(e) => onOutcomeChange(index, 'probability', e.target.value)}
                    size="sm"
                    style={{ width: '100%' }}
                  />
                </div>
              ) : (
                <div className="grid-cell">
                  <div className="condition-fields">
                    <Form.Select
                      value={outcome.if || 'Attribute'}
                      onChange={(e) => onOutcomeChange(index, 'if', e.target.value)}
                      size="sm"
                    >
                      <option value="Attribute">Attribute</option>
                    </Form.Select>
                    
                    <Form.Select
                      value={outcome.name || ''}
                      onChange={(e) => onOutcomeChange(index, 'name', e.target.value)}
                      size="sm"
                    >
                      <option value="">Select attribute...</option>
                      {availableAttributes.map(attr => (
                        <option key={attr} value={attr}>{attr}</option>
                      ))}
                    </Form.Select>
                    
                    <Form.Select
                      value={outcome.is || '=='}
                      onChange={(e) => onOutcomeChange(index, 'is', e.target.value)}
                      size="sm"
                    >
                      <option value="==">=</option>
                      <option value="<>">&lt;&gt;</option>
                      <option value=">">&gt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="<">&lt;</option>
                      <option value="<=">&lt;=</option>
                    </Form.Select>
                    
                    <Form.Control
                      type="text"
                      value={outcome.value || ''}
                      onChange={(e) => onOutcomeChange(index, 'value', e.target.value)}
                      size="sm"
                    />
                  </div>
                </div>
              )}
              
              <div className="grid-cell cell-center">
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={() => onRemoveOutcome(index)}
                  disabled={outcomes.length <= 1}
                >
                  <FiTrash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default DecideStepEditor;