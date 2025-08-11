import React from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';
import ValidatedNameInput from '../components/ValidatedNameInput';

const EventStepEditor = ({ 
  formData, 
  onFormDataChange,
  resourceRequirements,
  onResourceRequirementChange,
  onAddResourceRequirement,
  onRemoveResourceRequirement,
  resourceDefinitions,
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
                  value={formData.duration_mean || 1}
                  onChange={(e) => onFormDataChange({ duration_mean: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Standard Deviation</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={formData.duration_stddev || 0.1}
                  onChange={(e) => onFormDataChange({ duration_stddev: e.target.value })}
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
              value={formData.duration_scale || 1}
              onChange={(e) => onFormDataChange({ duration_scale: e.target.value })}
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
                  value={formData.duration_min || 0}
                  onChange={(e) => onFormDataChange({ duration_min: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Maximum (Days)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={formData.duration_max || 10}
                  onChange={(e) => onFormDataChange({ duration_max: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>
        );
      case 'choice':
        return (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Values (comma-separated)</Form.Label>
              <Form.Control
                type="text"
                value={formData.duration_values || '1, 2, 3'}
                onChange={(e) => onFormDataChange({ duration_values: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Weights (comma-separated, must sum to 1)</Form.Label>
              <Form.Control
                type="text"
                value={formData.duration_weights || '0.5, 0.3, 0.2'}
                onChange={(e) => onFormDataChange({ duration_weights: e.target.value })}
              />
            </Form.Group>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ValidatedNameInput
        value={formData.name || ''}
        onChange={(name) => onFormDataChange({ name })}
        validation={nameValidation}
        label="Event Name"
        placeholder="Enter event name"
      />

      <Form.Group className="mb-3">
        <Form.Label>Duration Distribution Type</Form.Label>
        <Form.Select
          value={formData.distribution_type || 'normal'}
          onChange={(e) => onFormDataChange({ distribution_type: e.target.value })}
        >
          <option value="normal">Normal</option>
          <option value="exponential">Exponential</option>
          <option value="uniform">Uniform</option>
          <option value="choice">Choice (Discrete)</option>
        </Form.Select>
      </Form.Group>

      {renderDistributionFields()}

      <hr />
      <div className="step-editor-section">
        <div className="section-header">
          <h6>Resource Requirements</h6>
          <Button 
            variant="outline-primary"
            size="sm" 
            onClick={onAddResourceRequirement}
            className="add-step-item-btn"
          >
            + Add Resource
          </Button>
        </div>

        <div className="step-editor-grid-container">
          {/* Header */}
          <div className="step-editor-grid-header resource-requirements">
            <div className="grid-header-cell">Resource Table</div>
            <div className="grid-header-cell">Resource Type</div>
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
                        <Form.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
                          No resources found in database configuration.
                        </Form.Text>
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
                  <Form.Control
                    type="number"
                    min="1"
                    value={req.count || 1}
                    onChange={(e) => onResourceRequirementChange(index, 'count', parseInt(e.target.value) || 1)}
                    size="sm"
                    style={{ width: '100%' }}
                  />
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
      </div>
    </>
  );
};

export default EventStepEditor;