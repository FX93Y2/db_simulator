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
  const focusTimeoutRef = useRef(null);

  // Log component initialization
  useEffect(() => {
    console.log(`[YamlEditor ${editorInstanceId.current}] Initialized with initialValue length: ${initialValue ? initialValue.length : 0}`);
    
    // Add global event listeners to help restore focus
    const handleWindowFocus = () => {
      // When window gets focus, make sure editor can be focused
      if (monacoRef.current) {
        // Reset editor context
        try {
          monacoRef.current.updateOptions({
            readOnly: false
          });
        } catch (err) {
          console.error(`[YamlEditor ${editorInstanceId.current}] Error updating options:`, err);
        }
      }
    };
    
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
      console.log(`[YamlEditor ${editorInstanceId.current}] Component unmounting`);
    };
  }, []);

  // Helper to focus and reset editor state
  const resetEditorFocus = () => {
    if (monacoRef.current) {
      try {
        // Force editor to refresh its focus state
        monacoRef.current.focus();
        
        // Force a layout recomputation which can help with focus
        monacoRef.current.layout();
        
        console.log(`[YamlEditor ${editorInstanceId.current}] Editor focus reset`);
      } catch (err) {
        console.error(`[YamlEditor ${editorInstanceId.current}] Error resetting focus:`, err);
      }
    }
  };

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
        wordWrap: 'on',
        // Improve focus handling
        tabIndex: 0,
        renderValidationDecorations: 'on'
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
      
      // Track focus state
      editor.onDidFocusEditorWidget(() => {
        console.log(`[YamlEditor ${editorInstanceId.current}] Editor gained focus`);
      });
      
      editor.onDidBlurEditorWidget(() => {
        console.log(`[YamlEditor ${editorInstanceId.current}] Editor lost focus`);
      });

      monacoRef.current = editor;
      setIsEditorReady(true);

      console.log(`[YamlEditor ${editorInstanceId.current}] Editor created successfully`);
      
      // Set initial focus after creation
      focusTimeoutRef.current = setTimeout(() => {
        resetEditorFocus();
      }, 200);

      // Cleanup
      return () => {
        if (valueChangeTimeoutRef.current) {
          clearTimeout(valueChangeTimeoutRef.current);
        }
        if (focusTimeoutRef.current) {
          clearTimeout(focusTimeoutRef.current);
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
        
        // Reset focus state after content change
        focusTimeoutRef.current = setTimeout(() => {
          resetEditorFocus();
        }, 100);
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
  
  // Handle container click to ensure editor gets focus
  const handleContainerClick = (e) => {
    // If we clicked directly on the container but not in the editor,
    // we should focus the editor
    if (e.target === containerRef.current && monacoRef.current) {
      console.log(`[YamlEditor ${editorInstanceId.current}] Container clicked, focusing editor`);
      resetEditorFocus();
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
        onClick={handleContainerClick}
        tabIndex={-1} // Make sure container is in tab order
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