import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';
import { SharedHelpPanel } from '../../../shared/help';

const FormulaGeneratorEditor = ({ generator, onExpressionChange }) => {
  // Local state for expression and help panel
  const [expression, setExpression] = useState('');
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  
  // Initialize expression from generator when component mounts or generator changes
  useEffect(() => {
    const initialExpression = generator.expression || '';
    setExpression(initialExpression);
  }, [generator.expression]);

  // Close panel when component unmounts (modal closes)
  useEffect(() => {
    return () => {
      setShowHelpPanel(false);
    };
  }, []);

  const handleExpressionChange = (e) => {
    const newExpression = e.target.value;
    setExpression(newExpression);
    onExpressionChange(newExpression);
  };

  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>
          Formula Expression
        </Form.Label>
        <div className="position-relative">
          <Form.Control
            as="textarea"
            rows={3}
            value={expression}
            onChange={handleExpressionChange}
            placeholder="e.g., MIN(SELECT created_at FROM Tickets WHERE user_id = @id) - DAYS(RANDOM(30, 365))"
            className="pe-5"
            style={{
              paddingRight: '40px',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '13px',
              resize: 'vertical'
            }}
          />
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
    </>
  );
};

export default FormulaGeneratorEditor;