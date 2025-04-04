import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const YamlEditor = ({ 
  initialValue, 
  onSave, 
  readOnly = false, 
  height = '500px',
  theme
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const monacoRef = useRef(null);
  const containerRef = useRef(null);
  const valueChangeTimeoutRef = useRef(null);
  const editorInstanceId = useRef(`editor-${Math.random().toString(36).substr(2, 9)}`);
  const lastValueRef = useRef(initialValue || '');

  // Log component initialization
  useEffect(() => {
    console.log(`[YamlEditor ${editorInstanceId.current}] Initialized with initialValue length: ${initialValue ? initialValue.length : 0}`);
    return () => {
      console.log(`[YamlEditor ${editorInstanceId.current}] Component unmounting`);
    };
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      console.log(`[YamlEditor ${editorInstanceId.current}] Creating Monaco editor instance`);
      
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
        console.log(`[YamlEditor ${editorInstanceId.current}] YAML language registered`);
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

      // Update state when content changes
      editor.onDidChangeModelContent(() => {
        const newValue = editor.getValue();
        console.log(`[YamlEditor ${editorInstanceId.current}] Content changed by user, new length: ${newValue.length}`);
        
        // Clear any existing timeout
        if (valueChangeTimeoutRef.current) {
          clearTimeout(valueChangeTimeoutRef.current);
        }
        
        setValue(newValue);
        
        // Auto-trigger onSave with debounce
        if (onSave && newValue !== lastValueRef.current) {
          console.log(`[YamlEditor ${editorInstanceId.current}] Content changed, setting debounce for autosave`);
          valueChangeTimeoutRef.current = setTimeout(() => {
            console.log(`[YamlEditor ${editorInstanceId.current}] Auto-saving content after change, length: ${newValue.length}`);
            lastValueRef.current = newValue;
            onSave(newValue);
          }, 1000); // 1 second debounce
        }
      });

      monacoRef.current = editor;
      setIsEditorReady(true);

      console.log(`[YamlEditor ${editorInstanceId.current}] Editor created successfully`);

      // Cleanup
      return () => {
        if (valueChangeTimeoutRef.current) {
          clearTimeout(valueChangeTimeoutRef.current);
        }
        console.log(`[YamlEditor ${editorInstanceId.current}] Disposing editor instance`);
        editor.dispose();
      };
    } catch (error) {
      console.error(`[YamlEditor ${editorInstanceId.current}] Failed to initialize Monaco editor:`, error);
    }
  }, [containerRef.current]);

  // Update content when initialValue changes
  useEffect(() => {
    if (monacoRef.current && initialValue !== undefined) {
      const currentValue = monacoRef.current.getValue();
      const hasChanged = currentValue !== initialValue;
      
      console.log(`[YamlEditor ${editorInstanceId.current}] initialValue changed:`, {
        currentLength: currentValue.length,
        newLength: initialValue.length,
        hasChanged,
        isInitialValueEmpty: !initialValue || initialValue === '',
        areDifferent: currentValue !== initialValue
      });
      
      if (hasChanged) {
        console.log(`[YamlEditor ${editorInstanceId.current}] Updating editor value from prop`);
        // Update local ref to prevent unnecessary autosave
        lastValueRef.current = initialValue;
        monacoRef.current.setValue(initialValue);
        setValue(initialValue);
      }
    }
  }, [initialValue]);

  // Update theme when theme prop changes
  useEffect(() => {
    console.log(`[YamlEditor ${editorInstanceId.current}] Theme prop changed:`, theme);
    if (monacoRef.current && theme) {
      const newThemeName = theme === 'dark' ? 'vs-dark' : 'vs';
      console.log(`[YamlEditor ${editorInstanceId.current}] Setting Monaco theme to: ${newThemeName}`);
      try {
        monaco.editor.setTheme(newThemeName);
        console.log(`[YamlEditor ${editorInstanceId.current}] Theme set successfully`);
      } catch (error) {
        console.error(`[YamlEditor ${editorInstanceId.current}] Error setting theme:`, error);
      }
    } else {
      console.log(`[YamlEditor ${editorInstanceId.current}] Monaco editor not ready or theme missing`);
    }
  }, [theme]);

  // Manual save - still useful for explicit saves
  const handleSave = () => {
    if (onSave && value) {
      console.log(`[YamlEditor ${editorInstanceId.current}] Manual save triggered, content length: ${value.length}`);
      lastValueRef.current = value;
      onSave(value);
    }
  };

  // Reset editor
  const handleReset = () => {
    if (monacoRef.current && initialValue) {
      console.log(`[YamlEditor ${editorInstanceId.current}] Resetting to initialValue`);
      lastValueRef.current = initialValue;
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