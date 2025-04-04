import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const YamlEditor = ({ 
  initialValue, 
  onSave, 
  onChange,
  readOnly = false, 
  height = '500px',
  theme
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

      // Determine initial theme based on prop
      const initialTheme = theme === 'dark' ? 'vs-dark' : 'vs';

      // Create editor
      const editor = monaco.editor.create(containerRef.current, {
        value: initialValue || '',
        language: 'yaml',
        theme: initialTheme,
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        readOnly,
        wordWrap: 'on'
      });

      // Update state and call onChange prop when content changes
      editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        setValue(currentValue);
        if (onChange) {
          onChange(currentValue);
        }
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

  // Update theme when theme prop changes
  useEffect(() => {
    console.log('[YamlEditor] Theme prop changed:', theme);
    if (monacoRef.current && theme) {
      const newThemeName = theme === 'dark' ? 'vs-dark' : 'vs';
      console.log(`[YamlEditor] Attempting to set Monaco theme to: ${newThemeName}`);
      try {
        monaco.editor.setTheme(newThemeName);
        console.log(`[YamlEditor] Successfully called setTheme: ${newThemeName}`);
      } catch (error) {
        console.error(`[YamlEditor] Error calling monaco.editor.setTheme:`, error);
      }
    } else {
      console.log('[YamlEditor] Monaco editor not ready or theme prop missing.');
    }
  }, [theme]);

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
      <div 
        ref={containerRef}
        className="monaco-editor-container" 
        style={{ 
          height, 
          width: '100%', 
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