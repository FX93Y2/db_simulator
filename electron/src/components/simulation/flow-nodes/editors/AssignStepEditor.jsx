import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup, DropdownButton, Dropdown } from 'react-bootstrap';
import { FiTrash2, FiCode, FiCheck } from 'react-icons/fi';
import ValidatedNameInput from '../components/ValidatedNameInput';
import SQLEditorModal from '../../../shared/SQLEditorModal';

const AssignStepEditor = ({
  formData,
  onFormDataChange,
  assignments,
  onAssignmentChange,
  onAddAssignment,
  onRemoveAssignment,
  availableAttributes,
  nameValidation = { valid: true, error: null }
}) => {
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [editingSqlIndex, setEditingSqlIndex] = useState(-1);
  const [currentSqlValue, setCurrentSqlValue] = useState('');

  const handleSqlEdit = (index) => {
    setEditingSqlIndex(index);
    // Capture the SQL value immediately to avoid timing issues on first open
    const assignment = assignments[index];
    const sqlValue = assignment?.expression || '';
    setCurrentSqlValue(sqlValue);
    setShowSqlModal(true);
  };

  const handleSqlSave = (sqlValue) => {
    if (editingSqlIndex >= 0) {
      onAssignmentChange(editingSqlIndex, 'expression', sqlValue);
    }
  };

  const getSqlButtonText = (assignment) => {
    if (assignment.expression && assignment.expression.trim()) {
      return 'SQL Set';
    }
    return 'Edit SQL';
  };

  const getSqlButtonVariant = (assignment) => {
    if (assignment.expression && assignment.expression.trim()) {
      return 'success';
    }
    return 'outline-secondary';
  };

  // Keep currentSqlValue in sync if the selected index or assignments change
  useEffect(() => {
    if (editingSqlIndex >= 0 && assignments[editingSqlIndex]) {
      setCurrentSqlValue(assignments[editingSqlIndex].expression || '');
    }
  }, [editingSqlIndex, assignments]);
  return (
    <>
      <div className="step-info-section">
        <ValidatedNameInput
          value={formData.name || ''}
          onChange={(name) => onFormDataChange({ name })}
          validation={nameValidation}
          label="Assignment Name"
          placeholder="Enter a name for this assignment"
          className="mb-3"
        />
      </div>
      <div className="step-editor-section">
        <div className="section-header">
          <h6 className="text-uppercase text-muted small fw-bold mb-3">Attribute Assignments</h6>
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
                    size="sm"
                    style={{ width: '100%' }}
                  >
                    <option value="attribute">Attribute</option>
                    <option value="sql">SQL</option>
                  </Form.Select>
                </div>
              </div>

              <div className="grid-cell">
                <InputGroup size="sm" style={{ width: '100%' }}>
                  <Form.Control
                    type="text"
                    value={assignment.attribute_name || ''}
                    onChange={(e) => onAssignmentChange(index, 'attribute_name', e.target.value)}
                    placeholder={assignment.assignment_type === 'sql' ? 'optional for SQL...' : 'Type attribute name...'}
                    isInvalid={assignment.assignment_type !== 'sql' && !assignment.attribute_name}
                  />
                  {availableAttributes.length > 0 && (
                    <DropdownButton
                      variant="outline-secondary"
                      title=""
                      id={`attribute-dropdown-${index}`}
                      align="end"
                      size="sm"
                      // Render menu in body to avoid clipping by overflow/scroll containers
                      container={typeof document !== 'undefined' ? document.body : undefined}
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
              </div>

              <div className="grid-cell">
                {assignment.assignment_type === 'sql' ? (
                  <Button
                    variant={getSqlButtonVariant(assignment)}
                    size="sm"
                    onClick={() => handleSqlEdit(index)}
                    className="d-flex align-items-center"
                    style={{ width: '100%', height: '31px' }}
                  >
                    <FiCode className="me-1" />
                    {getSqlButtonText(assignment)}
                    {assignment.expression && assignment.expression.trim() && (
                      <FiCheck className="ms-1" size={12} />
                    )}
                  </Button>
                ) : (
                  <>
                    <Form.Control
                      type="text"
                      value={assignment.value ?? ''}
                      onChange={(e) => onAssignmentChange(index, 'value', e.target.value)}
                      isInvalid={assignment.value === undefined || assignment.value === '' || assignment.value === null}
                      size="sm"
                      style={{ width: '100%' }}
                    />
                  </>
                )}
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

        <div className="mt-3">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={onAddAssignment}
            className="add-step-item-btn"
          >
            + Add Assignment
          </Button>
        </div>
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

export default AssignStepEditor;
