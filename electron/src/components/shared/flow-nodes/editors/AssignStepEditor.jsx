import React from 'react';
import { Form, Row, Col, Button, InputGroup, DropdownButton, Dropdown } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';

const AssignStepEditor = ({ 
  formData, 
  onFormDataChange,
  assignments,
  onAssignmentChange,
  onAddAssignment,
  onRemoveAssignment,
  availableAttributes
}) => {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Module ID</Form.Label>
        <Form.Control
          type="text"
          value={formData.module_id || ''}
          onChange={(e) => onFormDataChange({ module_id: e.target.value })}
        />
        <Form.Text className="text-muted">
          Unique identifier for this assign module.
        </Form.Text>
      </Form.Group>

      <hr />
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Attribute Assignments</h6>
        <Button size="sm" onClick={onAddAssignment}>Add Assignment</Button>
      </div>

      {assignments.map((assignment, index) => (
        <div key={index} className="border p-3 mb-3 rounded">
          <Row>
            <Col md={4}>
              <Form.Group className="mb-2">
                <Form.Label>Assignment Type</Form.Label>
                <Form.Select
                  value={assignment.assignment_type || 'attribute'}
                  onChange={(e) => onAssignmentChange(index, 'assignment_type', e.target.value)}
                  disabled
                >
                  <option value="attribute">Attribute</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  Only attribute assignments are currently supported.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-2">
                <Form.Label>Attribute Name</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={assignment.attribute_name || ''}
                    onChange={(e) => onAssignmentChange(index, 'attribute_name', e.target.value)}
                    placeholder="Type attribute name..."
                    isInvalid={!assignment.attribute_name}
                  />
                  {availableAttributes.length > 0 && (
                    <DropdownButton
                      variant="outline-secondary"
                      title=""
                      id={`attribute-dropdown-${index}`}
                      align="end"
                    >
                      {availableAttributes.map(attr => (
                        <Dropdown.Item 
                          key={attr}
                          onClick={() => onAssignmentChange(index, 'attribute_name', attr)}
                        >
                          {attr}
                        </Dropdown.Item>
                      ))}
                    </DropdownButton>
                  )}
                </InputGroup>
                <Form.Control.Feedback type="invalid">
                  Attribute name is required.
                </Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-2">
                <Form.Label>Value</Form.Label>
                <Form.Control
                  type="text"
                  value={assignment.value || ''}
                  onChange={(e) => onAssignmentChange(index, 'value', e.target.value)}
                  isInvalid={!assignment.value}
                />
                <Form.Control.Feedback type="invalid">
                  Value is required.
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={1}>
              <div className="d-flex align-items-end h-100 pb-2">
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={() => onRemoveAssignment(index)}
                  disabled={assignments.length <= 1}
                >
                  <FiTrash2 />
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      ))}

      <Form.Text className="text-muted">
        Assign module sets custom attributes on entities that can be used for conditional routing in Decide modules.
      </Form.Text>
    </>
  );
};

export default AssignStepEditor;