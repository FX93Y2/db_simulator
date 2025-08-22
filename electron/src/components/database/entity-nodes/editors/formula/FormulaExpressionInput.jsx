import React, { useState, useEffect } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import { BsQuestionCircle } from 'react-icons/bs';
import FormulaHelpPanel from './FormulaHelpPanel';

const FormulaExpressionInput = ({ 
  value = '', 
  onChange, 
  label = 'Formula Expression', 
  placeholder = 'e.g., MIN(SELECT created_at FROM Tickets WHERE user_id = @id)',
  className = '',
  required = false,
  helpText = ''
}) => {
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  // Close panel when component unmounts (modal closes)
  useEffect(() => {
    return () => {
      setShowHelpPanel(false);
    };
  }, []);

  const handleHelpClick = () => {
    setShowHelpPanel(!showHelpPanel);
  };

  const handleHelpClose = () => {
    setShowHelpPanel(false);
  };

  return (
    <>
      <Form.Group className={`mb-3 ${className}`}>
        <Form.Label>
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </Form.Label>
        <InputGroup>
          <Form.Control
            as="textarea"
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="formula-input"
            style={{
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '13px',
              resize: 'vertical'
            }}
          />
          <Button
            variant="outline-secondary"
            onClick={handleHelpClick}
            size="sm"
            className="help-button align-self-start"
            title="Show formula help"
            style={{
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              marginTop: '1px'
            }}
          >
            <BsQuestionCircle />
          </Button>
        </InputGroup>
        {helpText && (
          <Form.Text className="text-muted">
            {helpText}
          </Form.Text>
        )}
      </Form.Group>

      <FormulaHelpPanel
        show={showHelpPanel}
        onHide={handleHelpClose}
      />
    </>
  );
};

export default FormulaExpressionInput;