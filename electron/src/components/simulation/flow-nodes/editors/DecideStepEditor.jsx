import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiTrash2, FiCode } from 'react-icons/fi';
import ValidatedNameInput from '../components/ValidatedNameInput';
import SQLEditorModal from '../../../shared/SQLEditorModal';

const DecideStepEditor = ({
  formData,
  onFormDataChange,
  outcomes,
  onOutcomeChange,
  onAddOutcome,
  onRemoveOutcome,
  availableSteps,
  availableAttributes,
  nameValidation = { valid: true, error: null }
}) => {
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [editingSqlIndex, setEditingSqlIndex] = useState(-1);
  const [currentSqlValue, setCurrentSqlValue] = useState('');

  const handleSqlEdit = (index) => {
    setEditingSqlIndex(index);
    // Immediately capture the SQL value when opening the editor
    const outcome = outcomes[index];
    const sqlValue = (outcome && isSQL(outcome.if)) ? outcome.if : '';
    setCurrentSqlValue(sqlValue);
    setShowSqlModal(true);
  };

  // Update currentSqlValue when editingSqlIndex or outcomes change
  useEffect(() => {
    if (editingSqlIndex >= 0 && outcomes[editingSqlIndex]) {
      const outcome = outcomes[editingSqlIndex];
      const sqlValue = isSQL(outcome.if) ? outcome.if : '';
      setCurrentSqlValue(sqlValue);
    }
  }, [editingSqlIndex, outcomes]);

  const handleSqlSave = (sqlValue) => {
    if (editingSqlIndex >= 0) {
      // Store the SQL directly in the outcome's 'if' field
      onOutcomeChange(editingSqlIndex, 'if', sqlValue);
    }
  };

  // Helper function to detect if a string is SQL
  const isSQL = (str) => {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim().toUpperCase();
    return trimmed.includes('SELECT') || trimmed.includes('UPDATE') || trimmed.includes('INSERT') || trimmed.includes('DELETE');
  };

  const getSqlButtonText = (outcome) => {
    if (outcome && isSQL(outcome.if)) {
      return 'SQL Set';
    }
    return 'Edit SQL';
  };

  const getSqlButtonVariant = (outcome) => {
    if (outcome && isSQL(outcome.if)) {
      return 'success';
    }
    return 'outline-secondary';
  };
  return (
    <>
      <div className="step-info-section">
        <ValidatedNameInput
          value={formData.name || ''}
          onChange={(name) => onFormDataChange({ name })}
          validation={nameValidation}
          label="Decision Name"
          placeholder="Enter a name for this decision"
          className="mb-3"
        />

        <Form.Group className="mb-3">
          <Form.Label>Decision Type</Form.Label>
          <Form.Select
            value={formData.decision_type || '2way-chance'}
            onChange={(e) => onFormDataChange({ decision_type: e.target.value })}
          >
            <option value="2way-chance">2-way by chance</option>
            <option value="2way-condition">2-way by condition</option>
            <option value="nway-chance">N-way by chance</option>
            <option value="nway-condition">N-way by condition</option>
          </Form.Select>
        </Form.Group>
      </div>
      <div className="step-editor-section">
        <div className="section-header">
          <h6 className="text-uppercase text-muted small fw-bold mb-3">Decision Outcomes</h6>
        </div>

        <div className="step-editor-grid-container">
          {/* Header */}
          <div className={`step-editor-grid-header ${formData.decision_type?.includes('condition') ? 'decide-condition' : 'decide-probability'}`}>
            <div className="grid-header-cell">Next Step</div>
            <div className="grid-header-cell">
              {formData.decision_type?.includes('condition') ? 'Condition' : 'Probability'}
            </div>
            <div className="grid-header-cell"></div>
          </div>

          {/* Data Rows */}
          {outcomes.filter((_, index) => !formData.decision_type?.startsWith('2way') || index === 0).map((outcome, index) => (
            <div key={index} className={`step-editor-grid-row ${formData.decision_type?.includes('condition') ? 'decide-condition' : 'decide-probability'}`}>
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

              {formData.decision_type?.includes('chance') ? (
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
                      value={isSQL(outcome.if) ? 'SQL' : (outcome.if || 'Attribute')}
                      onChange={(e) => onOutcomeChange(index, 'if', e.target.value)}
                      size="sm"
                    >
                      <option value="Attribute">Attribute</option>
                      <option value="SQL">SQL</option>
                    </Form.Select>

                    {outcome.if === 'SQL' || isSQL(outcome.if) ? (
                      <Button
                        variant={getSqlButtonVariant(outcome)}
                        size="sm"
                        onClick={() => handleSqlEdit(index)}
                        className="d-flex align-items-center"
                        style={{ width: '100%', height: '31px' }}
                      >
                        <FiCode className="me-1" />
                        {getSqlButtonText(outcome)}
                      </Button>
                    ) : (
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
                    )}

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
                  disabled={formData.decision_type?.startsWith('2way') || outcomes.length <= 2}
                >
                  <FiTrash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Show "else" outcome info for 2-way decisions */}
        {formData.decision_type?.startsWith('2way') && outcomes.length > 1 && (
          <div className="mt-2">
            <small className="text-muted">
              Else outcome: {outcomes[1]?.next_event_name || 'No step selected'}
              {formData.decision_type === '2way-chance' && outcomes[0]?.probability &&
                ` (${(1 - parseFloat(outcomes[0].probability || 0)).toFixed(2)} probability)`
              }
            </small>
          </div>
        )}

        {formData.decision_type?.startsWith('nway') && (
          <div className="mt-3">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={onAddOutcome}
              className="add-step-item-btn"
            >
              + Add Outcome
            </Button>
          </div>
        )}
      </div>

      {/* SQL Editor Modal */}
      <SQLEditorModal
        show={showSqlModal}
        onHide={() => setShowSqlModal(false)}
        onSave={handleSqlSave}
        initialValue={currentSqlValue}
        title="Edit SQL Expression"
      />
    </>
  );
};

export default DecideStepEditor;
