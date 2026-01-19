import React from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';
import ValidatedNameInput from '../components/ValidatedNameInput';
import InlineCodeEditor from '../../../shared/InlineCodeEditor';
import { DistributionFormulaInput, convertDistributionToFormula, getDefaultFormula } from '../../../shared/distribution';

const EventStepEditor = ({
  formData,
  onFormDataChange,
  resourceRequirements,
  onResourceRequirementChange,
  onAddResourceRequirement,
  onRemoveResourceRequirement,
  resourceDefinitions,
  queueDefinitions = [],
  nameValidation = { valid: true, error: null },
  bridgeTables = []
}) => {
  // Get current formula value
  const getCurrentFormula = () => {
    return formData.duration_formula || '';
  };

  const handleFormulaChange = (newFormula) => {
    onFormDataChange({ duration_formula: newFormula });
  };

  return (
    <>
      <div className="step-info-section">
        <ValidatedNameInput
          value={formData.name || ''}
          onChange={(name) => onFormDataChange({ name })}
          validation={nameValidation}
          label="Event Name"
          placeholder="Enter event name"
          className="mb-3"
        />

        <Form.Group className="mb-3">
          <Form.Label>Target Bridge Table (Optional)</Form.Label>
          {bridgeTables.length > 0 ? (
            <Form.Select
              value={formData.bridge_table || ''}
              onChange={(e) => onFormDataChange({ bridge_table: e.target.value })}
            >
              <option value="">Default (Auto-detect)</option>
              {bridgeTables.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </Form.Select>
          ) : (
            <Form.Control
              type="text"
              placeholder="Enter bridge table name (optional)"
              value={formData.bridge_table || ''}
              onChange={(e) => onFormDataChange({ bridge_table: e.target.value })}
            />
          )}
          <Form.Text className="text-muted">
            Specify which table to record this event in.
          </Form.Text>
        </Form.Group>

        <Row>
          <Col md={8}>
            <DistributionFormulaInput
              value={getCurrentFormula()}
              onChange={handleFormulaChange}
              label="Duration Distribution"
              singleLine={true}
            />
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Units</Form.Label>
              <Form.Select
                value={formData.duration_time_unit || ''}
                onChange={(e) => onFormDataChange({ duration_time_unit: e.target.value || undefined })}
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
      <div className="step-editor-section">
        <div className="section-header">
          <h6>Resource Requirements</h6>
        </div>

        <div className="step-editor-grid-container">
          {/* Header */}
          <div className="step-editor-grid-header resource-requirements">
            <div className="grid-header-cell">Resource Table</div>
            <div className="grid-header-cell">Resource Type</div>
            <div className="grid-header-cell">Queue (optional)</div>
            <div className="grid-header-cell">Count</div>
            <div className="grid-header-cell"></div>
          </div>

          {/* Data Rows */}
          {resourceRequirements.map((req, index) => {
            const availableResourceTables = Object.keys(resourceDefinitions);
            const selectedResourceTable = req.resource_table || '';
            const availableResourceTypes = selectedResourceTable && resourceDefinitions[selectedResourceTable]
              ? resourceDefinitions[selectedResourceTable].resourceTypes
              : [];
            const queueOptions = Array.isArray(queueDefinitions) ? queueDefinitions : [];
            const hasQueues = queueOptions.length > 0;
            const formatQueueLabel = (queue) => {
              if (!queue) return '';
              const baseLabel = queue.name || '';
              if (!queue.type) {
                return baseLabel;
              }
              if (queue.attribute) {
                return `${baseLabel} (${queue.type} • ${queue.attribute})`;
              }
              return `${baseLabel} (${queue.type})`;
            };

            return (
              <div key={index} className="step-editor-grid-row resource-requirements">
                <div className="grid-cell">
                  <div style={{ width: '100%' }}>
                    {availableResourceTables.length > 0 ? (
                      <Form.Select
                        value={selectedResourceTable}
                        onChange={(e) => {
                          onResourceRequirementChange(index, 'resource_table', e.target.value);
                          // Reset resource type when table changes
                          onResourceRequirementChange(index, 'value', '');
                        }}
                        size="sm"
                        style={{ width: '100%' }}
                      >
                        <option value="">Select resource table...</option>
                        {availableResourceTables.map((tableName) => (
                          <option key={tableName} value={tableName}>
                            {tableName}
                          </option>
                        ))}
                      </Form.Select>
                    ) : (
                      <div>
                        <Form.Control
                          type="text"
                          value={selectedResourceTable}
                          onChange={(e) => onResourceRequirementChange(index, 'resource_table', e.target.value)}
                          size="sm"
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid-cell">
                  {availableResourceTypes.length > 0 ? (
                    <Form.Select
                      value={req.value || ''}
                      onChange={(e) => onResourceRequirementChange(index, 'value', e.target.value)}
                      size="sm"
                      style={{ width: '100%' }}
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
                      onChange={(e) => onResourceRequirementChange(index, 'value', e.target.value)}
                      disabled={selectedResourceTable && availableResourceTypes.length === 0}
                      size="sm"
                      style={{ width: '100%' }}
                    />
                  )}
                </div>

                <div className="grid-cell">
                  {hasQueues ? (
                    <Form.Select
                      value={req.queue || ''}
                      onChange={(e) => onResourceRequirementChange(index, 'queue', e.target.value)}
                      size="sm"
                      style={{ width: '100%' }}
                    >
                      <option value="">No queue (default order)</option>
                      {queueOptions.map((queue) => (
                        <option key={queue.name} value={queue.name}>
                          {formatQueueLabel(queue)}
                        </option>
                      ))}
                    </Form.Select>
                  ) : (
                    <span className="cell-content muted-text small">
                      No queues defined
                    </span>
                  )}
                </div>

                <div className="grid-cell">
                  <div style={{ width: '100%', height: '32px' }}>
                    <InlineCodeEditor
                      value={req.count ? req.count.toString() : '1'}
                      onChange={(val) => {
                        // If it looks like a simple integer, store as int for cleaner YAML
                        // Otherwise store as string (formula)
                        const trimmed = val ? val.trim() : '';
                        const intVal = parseInt(trimmed, 10);
                        if (!isNaN(intVal) && intVal.toString() === trimmed) {
                          onResourceRequirementChange(index, 'count', intVal);
                        } else {
                          onResourceRequirementChange(index, 'count', trimmed);
                        }
                      }}
                      height={32}
                      singleLine={true}
                      language="pgsql"
                    />
                  </div>
                </div>

                <div className="grid-cell cell-center">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => onRemoveResourceRequirement(index)}
                  >
                    <FiTrash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={onAddResourceRequirement}
            className="add-step-item-btn"
            disabled={!resourceDefinitions || Object.keys(resourceDefinitions).length === 0}
          >
            + Add Resource
          </Button>
          {(!resourceDefinitions || Object.keys(resourceDefinitions).length === 0) && (
            <Form.Text className="text-muted ms-2" style={{ fontSize: '0.75rem' }}>
              Add resource table in database configuration first
            </Form.Text>
          )}
        </div>
      </div>
    </>
  );
};

export default EventStepEditor;
