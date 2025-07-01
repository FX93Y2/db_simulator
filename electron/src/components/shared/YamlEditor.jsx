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
        
        // Define comprehensive YAML tokenizer
        monaco.languages.setMonarchTokensProvider('yaml', {
          tokenizer: {
            root: [
              // Document separators
              [/^---/, 'delimiter.yaml'],
              [/^\.\.\./, 'delimiter.yaml'],
              
              // Comments
              [/#.*$/, 'comment.yaml'],
              
              // Keys (property names)
              [/^\s*[\w\-\.]+\s*(?=:)/, 'key.yaml'],
              [/^\s*"[^"]*"\s*(?=:)/, 'key.yaml'],
              [/^\s*'[^']*'\s*(?=:)/, 'key.yaml'],
              
              // Strings
              [/"([^"\\]|\\.)*"/, 'string.yaml'],
              [/'([^'\\]|\\.)*'/, 'string.yaml'],
              
              // Numbers
              [/\b\d+\.?\d*\b/, 'number.yaml'],
              
              // Booleans and null
              [/\b(true|false|null|True|False|Null|TRUE|FALSE|NULL)\b/, 'keyword.yaml'],
              
              // Arrays and objects
              [/[\[\]]/, 'delimiter.bracket.yaml'],
              [/[{}]/, 'delimiter.curly.yaml'],
              
              // Colons and commas
              [/:/, 'delimiter.colon.yaml'],
              [/,/, 'delimiter.comma.yaml'],
              
              // Multi-line strings
              [/[|>]/, 'string.yaml'],
              
              // Anchors and references
              [/&\w+/, 'tag.yaml'],
              [/\*\w+/, 'tag.yaml'],
              
              // Tags
              [/!\w+/, 'tag.yaml']
            ]
          }
        });

        // Define color theme for YAML tokens
        monaco.editor.defineTheme('yaml-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'key.yaml', foreground: '0451a5', fontStyle: 'bold' },
            { token: 'string.yaml', foreground: 'a31515' },
            { token: 'number.yaml', foreground: '098658' },
            { token: 'keyword.yaml', foreground: '0000ff', fontStyle: 'bold' },
            { token: 'comment.yaml', foreground: '008000', fontStyle: 'italic' },
            { token: 'delimiter.yaml', foreground: '800080', fontStyle: 'bold' },
            { token: 'delimiter.bracket.yaml', foreground: '000000' },
            { token: 'delimiter.curly.yaml', foreground: '000000' },
            { token: 'delimiter.colon.yaml', foreground: '000000' },
            { token: 'delimiter.comma.yaml', foreground: '000000' },
            { token: 'tag.yaml', foreground: 'af00db' }
          ],
          colors: {}
        });

        monaco.editor.defineTheme('yaml-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'key.yaml', foreground: '9cdcfe', fontStyle: 'bold' },
            { token: 'string.yaml', foreground: 'ce9178' },
            { token: 'number.yaml', foreground: 'b5cea8' },
            { token: 'keyword.yaml', foreground: '569cd6', fontStyle: 'bold' },
            { token: 'comment.yaml', foreground: '6a9955', fontStyle: 'italic' },
            { token: 'delimiter.yaml', foreground: 'c586c0', fontStyle: 'bold' },
            { token: 'delimiter.bracket.yaml', foreground: 'ffd700' },
            { token: 'delimiter.curly.yaml', foreground: 'ffd700' },
            { token: 'delimiter.colon.yaml', foreground: 'd4d4d4' },
            { token: 'delimiter.comma.yaml', foreground: 'd4d4d4' },
            { token: 'tag.yaml', foreground: 'dcdcaa' }
          ],
          colors: {}
        });
      }

      // Determine initial theme based on prop
      const initialTheme = theme === 'dark' ? 'yaml-dark' : 'yaml-light';

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
      const newThemeName = theme === 'dark' ? 'yaml-dark' : 'yaml-light';
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