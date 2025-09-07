import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle, FiCode, FiCheck } from 'react-icons/fi';
import { SharedHelpPanel } from '../../../shared/help';
import SQLEditorModal from '../../../shared/SQLEditorModal';

const FormulaGeneratorEditor = ({ generator, onExpressionChange }) => {
  // Local state for expression, help panel, and SQL modal
  const [expression, setExpression] = useState('');
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  
  // Initialize expression from generator when component mounts or generator changes
  useEffect(() => {
    const initialExpression = generator.expression || '';
    setExpression(initialExpression);
  }, [generator.expression]);

  const handleSqlSave = (newExpression) => {
    setExpression(newExpression);
    onExpressionChange(newExpression);
  };

  const handleSqlEdit = () => {
    setShowSqlModal(true);
  };

  // Get display text for the SQL button - show truncated SQL content
  const getSqlButtonText = () => {
    if (expression && expression.trim()) {
      // Truncate long expressions for display
      const maxLength = 50;
      return expression.trim().length > maxLength 
        ? expression.trim().substring(0, maxLength) + '...'
        : expression.trim();
    }
    return 'Enter SQL expression...';
  };

  const isPlaceholder = !expression || !expression.trim();

  return (
    <>
      <Form.Group className="mb-3" controlId="formula-expression-input">
        <Form.Label>
          Formula Expression
        </Form.Label>
        <div className="position-relative">
          <Button
            id="formula-expression-input"
            variant="outline-secondary"
            onClick={handleSqlEdit}
            className={`formula-expression-button d-flex align-items-center justify-content-start ${isPlaceholder ? 'is-placeholder' : ''}`}
            style={{
              width: '100%',
              height: '38px',
              textAlign: 'left',
              paddingRight: '40px',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            <FiCode className="me-2 flex-shrink-0" size={14} />
            <span className="text-truncate">
              {getSqlButtonText()}
            </span>
            {expression && expression.trim() && (
              <FiCheck className="ms-auto flex-shrink-0" size={12} />
            )}
          </Button>
          <Button
            variant=""
            size="sm"
            onClick={() => setShowHelpPanel(!showHelpPanel)}
            className={`position-absolute top-50 translate-middle-y border-0 help-toggle-btn ${showHelpPanel ? 'active' : ''}`}
            style={{
              right: '8px',
              zIndex: 5,
              padding: '4px',
              borderRadius: 'inherit'
            }}
            title={showHelpPanel ? "Hide formula expression help" : "Show formula expression help"}
          >
            <FiHelpCircle size={18} />
          </Button>
        </div>
      </Form.Group>

      <SharedHelpPanel 
        show={showHelpPanel}
        onHide={() => setShowHelpPanel(false)}
        helpType="formula"
      />

      {/* SQL Editor Modal */}
      <SQLEditorModal
        show={showSqlModal}
        onHide={() => setShowSqlModal(false)}
        onSave={handleSqlSave}
        initialValue={expression}
        title="Edit Formula Expression"
      />
    </>
  );
};

export default FormulaGeneratorEditor;
