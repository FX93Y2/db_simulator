import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';

const CreateStepEditor = ({ 
  formData, 
  onFormDataChange,
  availableSteps,
  availableEntityTables = [] // Entity tables from database config
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
                  value={formData.interarrival_mean || 2}
                  onChange={(e) => onFormDataChange({ interarrival_mean: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Standard Deviation</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={formData.interarrival_stddev || 0.5}
                  onChange={(e) => onFormDataChange({ interarrival_stddev: e.target.value })}
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
              value={formData.interarrival_scale || 2}
              onChange={(e) => onFormDataChange({ interarrival_scale: e.target.value })}
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
                  value={formData.interarrival_min || 1}
                  onChange={(e) => onFormDataChange({ interarrival_min: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Maximum (Days)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={formData.interarrival_max || 3}
                  onChange={(e) => onFormDataChange({ interarrival_max: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>
        );
      default:
        return null;
    }
  };

  return (
    <div className="create-step-editor">
      {/* Display Name */}
      <Form.Group className="mb-4">
        <Form.Label>Display Name</Form.Label>
        <Form.Control
          type="text"
          value={formData.display_name || ''}
          onChange={(e) => onFormDataChange({ display_name: e.target.value })}
          placeholder="Enter a display name for this module"
        />
      </Form.Group>

      {/* Entity Table Selection */}
      <Form.Group className="mb-4">
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

      {/* Interarrival Time Configuration */}
      <div className="mb-4">
        <h6 className="mb-3">Interarrival Time</h6>
        
        <Form.Group className="mb-3">
          <Form.Label>Distribution Type</Form.Label>
          <Form.Select
            value={formData.distribution_type || 'exponential'}
            onChange={(e) => onFormDataChange({ distribution_type: e.target.value })}
          >
            <option value="exponential">Exponential</option>
            <option value="normal">Normal</option>
            <option value="uniform">Uniform</option>
          </Form.Select>
        </Form.Group>

        {renderDistributionFields()}
      </div>

      {/* Max Entities */}
      <Form.Group className="mb-4">
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

      {/* Next Steps Selection */}
      <Form.Group className="mb-3">
        <Form.Label>Next Step</Form.Label>
        <Form.Select
          value={formData.next_step || ''}
          onChange={(e) => onFormDataChange({ next_step: e.target.value })}
          required
        >
          <option value="">Select next step...</option>
          {availableSteps.map((stepName) => (
            <option key={stepName} value={stepName}>{stepName}</option>
          ))}
        </Form.Select>
      </Form.Group>
    </div>
  );
};

export default CreateStepEditor;