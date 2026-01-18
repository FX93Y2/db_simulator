import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';
import { SharedHelpPanel } from '../help';
import InlineCodeEditor from '../InlineCodeEditor';

const DistributionFormulaInput = ({
  value = '',
  onChange,
  label = 'Distribution Formula',
  placeholder = 'e.g., UNIF(3, 10) or NORM(5, 1)',
  className = '',
  required = false,
  singleLine = false,
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
        <div className="d-flex align-items-center justify-content-between mb-1">
          <Form.Label className="mb-0">
            {label}
            {required && <span className="text-danger ms-1">*</span>}
          </Form.Label>
          <Button
            variant=""
            size="sm"
            onClick={() => setShowHelpPanel(!showHelpPanel)}
            className={`border-0 help-toggle-btn ${showHelpPanel ? 'active' : ''}`}
            title={showHelpPanel ? "Hide distribution formula help" : "Show distribution formula help"}
          >
            <FiHelpCircle size={18} />
          </Button>
        </div>

        <InlineCodeEditor
          value={value}
          onChange={onChange}
          language="pgsql"
          height={singleLine ? 32 : 100}
          singleLine={singleLine}
          lineNumbers="off"
        />

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