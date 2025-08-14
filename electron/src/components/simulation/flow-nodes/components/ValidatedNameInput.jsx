import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * ValidatedNameInput Component
 * 
 * A reusable form input component for step names with built-in validation feedback.
 * Shows real-time validation status and error messages for step name conflicts.
 * 
 * @param {string} value - Current input value
 * @param {function} onChange - Callback when input value changes
 * @param {object} validation - Validation object with { valid: boolean, error: string }
 * @param {string} label - Form label text
 * @param {string} placeholder - Input placeholder text
 * @param {boolean} disabled - Whether the input is disabled
 * @param {string} className - Additional CSS classes
 */
const ValidatedNameInput = ({
  value = '',
  onChange,
  validation = { valid: true, error: null },
  label = 'Step Name',
  placeholder = 'Enter step name',
  disabled = false,
  className = ''
}) => {
  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <Form.Group className={`mb-3 ${className}`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        isInvalid={!validation.valid}
        isValid={validation.valid && value.length > 0}
      />
      {!validation.valid && validation.error && (
        <Form.Control.Feedback type="invalid">
          {validation.error}
        </Form.Control.Feedback>
      )}
      {validation.valid && value.length > 0 && (
        <Form.Control.Feedback type="valid">
          Step name is valid
        </Form.Control.Feedback>
      )}
    </Form.Group>
  );
};

export default ValidatedNameInput;