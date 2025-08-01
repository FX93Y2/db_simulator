import React from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';

const EventStepEditor = ({ 
  formData, 
  onFormDataChange,
  resourceRequirements,
  onResourceRequirementChange,
  onAddResourceRequirement,
  onRemoveResourceRequirement,
  resourceDefinitions
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
      <Form.Group className="mb-3">
        <Form.Label>Event Name</Form.Label>
        <Form.Control
          type="text"
          value={formData.name || ''}
          onChange={(e) => onFormDataChange({ name: e.target.value })}
        />
        <Form.Text className="text-muted">
          This name will be used to identify the event in decision outcomes.
        </Form.Text>
      </Form.Group>

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
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Resource Requirements</h6>
        <Button size="sm" onClick={onAddResourceRequirement}>Add Resource</Button>
      </div>

      {resourceRequirements.map((req, index) => {
        const availableResourceTables = Object.keys(resourceDefinitions);
        const selectedResourceTable = req.resource_table || '';
        const availableResourceTypes = selectedResourceTable && resourceDefinitions[selectedResourceTable] 
          ? resourceDefinitions[selectedResourceTable].resourceTypes 
          : [];

        return (
          <div key={index} className="border p-3 mb-3 rounded">
            <Row>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Resource Table</Form.Label>
                  {availableResourceTables.length > 0 ? (
                    <Form.Select
                      value={selectedResourceTable}
                      onChange={(e) => {
                        onResourceRequirementChange(index, 'resource_table', e.target.value);
                        // Reset resource type when table changes
                        onResourceRequirementChange(index, 'value', '');
                      }}
                    >
                      <option value="">Select resource table...</option>
                      {availableResourceTables.map((tableName) => (
                        <option key={tableName} value={tableName}>
                          {tableName}
                        </option>
                      ))}
                    </Form.Select>
                  ) : (
                    <Form.Control
                      type="text"
                      value={selectedResourceTable}
                      onChange={(e) => onResourceRequirementChange(index, 'resource_table', e.target.value)}
                    />
                  )}
                  {availableResourceTables.length === 0 && (
                    <Form.Text className="text-muted">
                      No resources found in database configuration. Using text input.
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Resource Type</Form.Label>
                  {availableResourceTypes.length > 0 ? (
                    <Form.Select
                      value={req.value || ''}
                      onChange={(e) => onResourceRequirementChange(index, 'value', e.target.value)}
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
                    />
                  )}
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-2">
                  <Form.Label>Count</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    value={req.count || 1}
                    onChange={(e) => onResourceRequirementChange(index, 'count', parseInt(e.target.value) || 1)}
                  />
                </Form.Group>
              </Col>
              <Col md={1}>
                <div className="d-flex align-items-end h-100 pb-2">
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={() => onRemoveResourceRequirement(index)}
                  >
                    <FiTrash2 />
                  </Button>
                </div>
              </Col>
            </Row>
          </div>
        );
      })}
    </>
  );
};

export default EventStepEditor;