import React, { useState, useEffect } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import { BsQuestionCircle } from 'react-icons/bs';
import DistributionHelpPanel from './DistributionHelpPanel';

const DistributionFormulaInput = ({ 
  value = '', 
  onChange, 
  label = 'Distribution Formula', 
  placeholder = 'e.g., UNIF(3, 10) or NORM(5, 1)',
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
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="formula-input"
          />
          <Button
            variant="outline-secondary"
            onClick={handleHelpClick}
            size="sm"
            className="help-button"
            title="Show distribution help"
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

      <DistributionHelpPanel
        show={showHelpPanel}
        onHide={handleHelpClose}
      />
    </>
  );
};

export default DistributionFormulaInput;