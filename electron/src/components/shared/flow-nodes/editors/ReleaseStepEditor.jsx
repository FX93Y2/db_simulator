import React from 'react';
import { Form } from 'react-bootstrap';

const ReleaseStepEditor = ({ formData, onFormDataChange }) => {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Release Name</Form.Label>
        <Form.Control
          type="text"
          value={formData.name || ''}
          onChange={(e) => onFormDataChange({ name: e.target.value })}
        />
      </Form.Group>
      
      <Form.Text className="text-muted">
        Release steps mark the end of the flow and release all resources occupied by the entity.
      </Form.Text>
    </>
  );
};

export default ReleaseStepEditor;