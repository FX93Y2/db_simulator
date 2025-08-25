import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';
import { SharedHelpPanel } from '../help';

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


  return (
    <>
      <Form.Group className={`mb-3 ${className}`}>
        <Form.Label>
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </Form.Label>
        <div className="position-relative">
          <Form.Control
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="pe-5"
            style={{ paddingRight: '40px' }}
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
            title={showHelpPanel ? "Hide distribution formula help" : "Show distribution formula help"}
          >
            <FiHelpCircle size={18} />
          </Button>
        </div>
        {helpText && (
          <Form.Text className="text-muted">
            {helpText}
          </Form.Text>
        )}
      </Form.Group>

      <SharedHelpPanel 
        show={showHelpPanel}
        onHide={() => setShowHelpPanel(false)}
        helpType="distribution"
      />
    </>
  );
};

export default DistributionFormulaInput;