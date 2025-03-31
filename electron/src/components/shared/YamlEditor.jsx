import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const YamlEditor = ({ 
  initialValue, 
  onSave, 
  readOnly = false, 
  height = '500px',
  showToolbar = true
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const monacoRef = useRef(null);
  const containerRef = useRef(null);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Register the YAML language if it hasn't been registered
      if (!monaco.languages.getLanguages().some(lang => lang.id === 'yaml')) {
        monaco.languages.register({ id: 'yaml' });
        monaco.languages.setMonarchTokensProvider('yaml', {
          tokenizer: {
            root: [
              [/^\s*[\w-]+\s*:/, 'attribute'],
              [/^---/, 'delimiter'],
              [/^\.\.\./, 'delimiter'],
              [/#.*$/, 'comment'],
              [/".*"/, 'string'],
              [/'.*'/, 'string']
            ]
          }
        });
      }

      // Create editor
      const editor = monaco.editor.create(containerRef.current, {
        value: initialValue || '',
        language: 'yaml',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        readOnly,
        wordWrap: 'on'
      });

      // Update state when content changes
      editor.onDidChangeModelContent(() => {
        setValue(editor.getValue());
      });

      monacoRef.current = editor;
      setIsEditorReady(true);

      // Cleanup
      return () => {
        editor.dispose();
      };
    } catch (error) {
      console.error('Failed to initialize Monaco editor:', error);
    }
  }, [containerRef.current]);

  // Update content when initialValue changes
  useEffect(() => {
    if (monacoRef.current && initialValue !== undefined && value !== initialValue) {
      monacoRef.current.setValue(initialValue);
    }
  }, [initialValue]);

  // Handle save
  const handleSave = () => {
    if (onSave && value) {
      onSave(value);
    }
  };

  // Handle reset
  const handleReset = () => {
    if (monacoRef.current && initialValue) {
      monacoRef.current.setValue(initialValue);
      setValue(initialValue);
    }
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
            disabled={readOnly}
            style={{ 
              padding: '8px 16px', 
              fontSize: '14px',
              backgroundColor: '#28a745',
              borderColor: '#28a745'
            }}
          >
            <FiSave style={{ marginRight: '5px' }} /> Save Configuration
          </Button>
          <Button 
            variant="outline-secondary" 
            size="sm"
            onClick={handleReset}
            disabled={readOnly}
          >
            <FiRefreshCw /> Reset
          </Button>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="monaco-editor-container" 
        style={{ 
          height, 
          width: '100%', 
          border: '1px solid #ccc', 
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        {!isEditorReady && (
          <div className="text-center p-4">
            <Spinner animation="border" />
          </div>
        )}
      </div>
    </div>
  );
};

export default YamlEditor; 