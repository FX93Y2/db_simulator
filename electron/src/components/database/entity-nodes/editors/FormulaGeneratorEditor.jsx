import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';
import { SharedHelpPanel } from '../../../shared/help';
import InlineCodeEditor from '../../../shared/InlineCodeEditor';

const FormulaGeneratorEditor = ({ generator, onExpressionChange }) => {
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  return (
    <>
      <Form.Group className="mb-3" controlId="formula-expression-inline">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <Form.Label className="mb-0">Formula Expression</Form.Label>
          <Button
            variant=""
            size="sm"
            onClick={() => setShowHelpPanel(!showHelpPanel)}
            className={`border-0 help-toggle-btn ${showHelpPanel ? 'active' : ''}`}
            title={showHelpPanel ? 'Hide formula expression help' : 'Show formula expression help'}
          >
            <FiHelpCircle size={18} />
          </Button>
        </div>

        <InlineCodeEditor
          value={generator.expression}
          onChange={onExpressionChange}
          language="pgsql"
          height={190}
        />
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
