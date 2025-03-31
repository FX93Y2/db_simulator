import React, { useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { Button, Spinner } from 'react-bootstrap';
import { FiSave, FiRefreshCw } from 'react-icons/fi';

const YamlEditor = ({ 
  initialValue, 
  onSave, 
  readOnly = false, 
  height = '500px',
  showToolbar = true
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [isEditorReady, setIsEditorReady] = useState(false);
  
  // Handle editor mount
  const handleEditorDidMount = () => {
    setIsEditorReady(true);
  };
  
  // Handle changes in the editor
  const handleEditorChange = (newValue) => {
    setValue(newValue);
  };
  
  // Handle save button click
  const handleSave = () => {
    if (onSave) {
      onSave(value);
    }
  };
  
  // Handle refresh/reset to original value
  const handleReset = () => {
    setValue(initialValue);
  };
  
  return (
    <div className="yaml-editor">
      {showToolbar && (
        <div className="yaml-editor__toolbar mb-2">
          <Button 
            variant="primary" 
            size="sm" 
            className="me-2"
            onClick={handleSave}
            disabled={!isEditorReady || readOnly}
          >
            <FiSave /> Save
          </Button>
          <Button 
            variant="outline-secondary" 
            size="sm"
            onClick={handleReset}
            disabled={!isEditorReady || readOnly}
          >
            <FiRefreshCw /> Reset
          </Button>
        </div>
      )}
      
      <div className="editor-container">
        {!isEditorReady && (
          <div className="text-center p-4">
            <Spinner animation="border" />
          </div>
        )}
        <MonacoEditor
          height={height}
          language="yaml"
          theme="vs-dark"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: true },
            wordWrap: 'on',
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            folding: true,
            foldingStrategy: 'indentation'
          }}
        />
      </div>
    </div>
  );
};

export default YamlEditor; 