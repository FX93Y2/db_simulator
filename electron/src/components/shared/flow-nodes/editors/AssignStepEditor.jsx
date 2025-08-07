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
      <div className="step-editor-section">
        <div className="section-header">
          <h6>Attribute Assignments</h6>
          <Button size="sm" onClick={onAddAssignment}>Add Assignment</Button>
        </div>

        <div className="step-editor-grid-container">
          {/* Header */}
          <div className="step-editor-grid-header assign-attributes">
            <div className="grid-header-cell">Assignment Type</div>
            <div className="grid-header-cell">Attribute Name</div>
            <div className="grid-header-cell">Value</div>
            <div className="grid-header-cell"></div>
          </div>
          
          {/* Data Rows */}
          {assignments.map((assignment, index) => (
            <div key={index} className="step-editor-grid-row assign-attributes">
              <div className="grid-cell">
                <div style={{ width: '100%' }}>
                  <Form.Select
                    value={assignment.assignment_type || 'attribute'}
                    onChange={(e) => onAssignmentChange(index, 'assignment_type', e.target.value)}
                    disabled
                    size="sm"
                    style={{ width: '100%' }}
                  >
                    <option value="attribute">Attribute</option>
                  </Form.Select>
                </div>
              </div>
              
              <div className="grid-cell">
                <InputGroup size="sm" style={{ width: '100%' }}>
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
                      size="sm"
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
                  <Form.Control.Feedback type="invalid">
                    Attribute name is required.
                  </Form.Control.Feedback>
                </InputGroup>
              </div>

              <div className="grid-cell">
                <Form.Control
                  type="text"
                  value={assignment.value || ''}
                  onChange={(e) => onAssignmentChange(index, 'value', e.target.value)}
                  isInvalid={!assignment.value}
                  size="sm"
                  style={{ width: '100%' }}
                />
                <Form.Control.Feedback type="invalid">
                  Value is required.
                </Form.Control.Feedback>
              </div>
              
              <div className="grid-cell cell-center">
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={() => onRemoveAssignment(index)}
                  disabled={assignments.length <= 1}
                >
                  <FiTrash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Form.Text className="text-muted">
        Assign module sets custom attributes on entities that can be used for conditional routing in Decide modules.
      </Form.Text>
    </>
  );
};

export default AssignStepEditor;