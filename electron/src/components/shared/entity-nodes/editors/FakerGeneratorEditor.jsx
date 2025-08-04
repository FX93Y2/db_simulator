import React from 'react';
import { Form } from 'react-bootstrap';

const FakerGeneratorEditor = ({ generator, onGeneratorChange }) => {
  return (
    <Form.Group className="mb-3">
      <Form.Label>Faker Method</Form.Label>
      <Form.Control
        type="text"
        value={generator.method || ''}
        onChange={(e) => onGeneratorChange('method', e.target.value)}
        placeholder="e.g., name, email, address"
      />
      <Form.Text className="text-muted">
        Faker.js method name (e.g., name, email, phone, address)
      </Form.Text>
    </Form.Group>
  );
};

export default FakerGeneratorEditor;