import React from 'react';
import { Form } from 'react-bootstrap';

const TemplateGeneratorEditor = ({ generator, onGeneratorChange }) => {
  return (
    <Form.Group className="mb-3">
      <Form.Label>Template String</Form.Label>
      <Form.Control
        type="text"
        value={generator.template || ''}
        onChange={(e) => onGeneratorChange('template', e.target.value)}
      />
      <Form.Text className="text-muted">
        Template string with {'{id}'} placeholder for auto-increment
      </Form.Text>
    </Form.Group>
  );
};

export default TemplateGeneratorEditor;