import React from 'react';
import ValidatedNameInput from '../components/ValidatedNameInput';

const ReleaseStepEditor = ({ 
  formData, 
  onFormDataChange,
  nameValidation = { valid: true, error: null }
}) => {
  return (
    <>
      <ValidatedNameInput
        value={formData.name || ''}
        onChange={(name) => onFormDataChange({ name })}
        validation={nameValidation}
        label="Release Name"
        placeholder="Enter release step name"
      />
    </>
  );
};

export default ReleaseStepEditor;