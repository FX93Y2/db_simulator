import React, { useState } from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';
import ValidatedNameInput from '../components/ValidatedNameInput';
import InlineCodeEditor from '../../../shared/InlineCodeEditor';
import { SharedHelpPanel } from '../../../shared/help';

const TriggerStepEditor = ({
  formData,
  onFormDataChange,
  availableSteps,
  availableTargetTables = [], // Related tables sourced from database config
  nameValidation = { valid: true, error: null }
}) => {
  const [showHelpPanel, setShowHelpPanel] = useState(false);

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
              <div className="d-flex align-items-center justify-content-between mb-1">
                <Form.Label className="mb-0">
                  Count <span className="text-danger">*</span>
                </Form.Label>
                <Button
                  variant=""
                  size="sm"
                  onClick={() => setShowHelpPanel(!showHelpPanel)}
                  className={`border-0 help-toggle-btn ${showHelpPanel ? 'active' : ''}`}
                  title={showHelpPanel ? "Hide distribution formula help" : "Show distribution formula help"}
                >
                  <FiHelpCircle size={18} />
                </Button>
              </div>

              <InlineCodeEditor
                value={formData.count !== undefined ? formData.count.toString() : ''}
                onChange={(val) => {
                  const trimmed = val ? val.trim() : '';
                  const intVal = parseInt(trimmed, 10);
                  if (!isNaN(intVal) && intVal.toString() === trimmed) {
                    onFormDataChange({ count: intVal });
                  } else {
                    onFormDataChange({ count: trimmed });
                  }
                }}
                height={32}
                singleLine={true}
                language="pgsql"
                placeholder="e.g., 3 or UNIF(1, 5)"
              />
              <Form.Text className="text-muted">
                Fixed number or formula
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>

        <SharedHelpPanel
          show={showHelpPanel}
          onHide={() => setShowHelpPanel(false)}
          helpType="distribution"
        />

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

      {/* Next Step selection hidden in editor as requested */}
    </div>
  );
};

export default TriggerStepEditor;
