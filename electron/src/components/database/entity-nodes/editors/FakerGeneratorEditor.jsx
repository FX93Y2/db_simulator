import React from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';
import InlineCodeEditor from '../../../shared/InlineCodeEditor';

const FakerGeneratorEditor = ({ generator, onGeneratorChange }) => {
  const openFakerDocs = async () => {
    try {
      const result = await window.api.openExternalUrl('https://fakerjs.dev/api/');
      if (!result.success) {
        console.warn('Failed to open Faker.js documentation:', result.error);
      }
    } catch (e) {
      console.error('Error opening Faker.js documentation:', e);
    }
  };

  return (
    <Form.Group className="mb-3">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <Form.Label className="mb-0">Faker Method</Form.Label>
        <Button
          variant=""
          size="sm"
          onClick={openFakerDocs}
          className="border-0 help-toggle-btn"
          title="Open Faker.js API documentation"
        >
          <FiHelpCircle size={18} />
        </Button>
      </div>

      <InlineCodeEditor
        value={generator.method}
        onChange={(val) => onGeneratorChange('method', val)}
        language="pgsql" // Using PGSQL for now as it gives some syntax coloring, ideally 'javascript' or custom
        height={100} // Shorter than formula as typically just one line
        lineNumbers="off" // Simple input doesn't need line numbers usually
        minimap={false}
      />
      <Form.Text className="text-muted">
        Faker.js method name (e.g., name, email, phone, address)
      </Form.Text>
    </Form.Group>
  );
};

export default FakerGeneratorEditor;
