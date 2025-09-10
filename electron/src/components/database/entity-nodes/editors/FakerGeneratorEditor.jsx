import React from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';

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
      <Form.Label>Faker Method</Form.Label>
      <div className="position-relative">
        <Form.Control
          type="text"
          value={generator.method || ''}
          onChange={(e) => onGeneratorChange('method', e.target.value)}
          placeholder="e.g., name, email, address"
          className="pe-5"
          style={{ paddingRight: '40px' }}
        />
        <Button
          variant=""
          size="sm"
          onClick={openFakerDocs}
          className="position-absolute top-50 translate-middle-y border-0 help-toggle-btn"
          style={{ right: '8px', zIndex: 5, padding: '4px', borderRadius: 'inherit' }}
          title="Open Faker.js API documentation"
        >
          <FiHelpCircle size={18} />
        </Button>
      </div>
      <Form.Text className="text-muted">
        Faker.js method name (e.g., name, email, phone, address)
      </Form.Text>
    </Form.Group>
  );
};

export default FakerGeneratorEditor;
