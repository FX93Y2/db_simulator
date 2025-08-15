import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { FiSave, FiRefreshCw, FiUpload, FiDownload } from 'react-icons/fi';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const YamlEditor = ({ 
  initialValue, 
  onSave, 
  onChange,
  onImport,  // New callback for importing YAML files
  readOnly = false, 
  height = '500px',
  theme,
  showImportExport = false,  // New prop to control import/export buttons
  filename = 'config'  // Default filename for exports
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const monacoRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const layoutTimeoutRef = useRef(null);

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
          colors: {
            'editor.background': '#252526'  // Use theme YAML editor background (gray-900)
          }
        });
      }

      // Always use dark theme for YAML editor
      const initialTheme = 'yaml-dark';

      // Create editor with CSS Grid optimizations (VS Code architecture)
      const editor = monaco.editor.create(containerRef.current, {
        value: initialValue || '',
        language: 'yaml',
        theme: initialTheme,
        // CRITICAL: Disable automaticLayout for 10x performance improvement
        automaticLayout: false,
        // Optimized minimap settings
        minimap: { 
          enabled: true,
          showSlider: 'mouseover',     // Reduce rendering overhead
          renderCharacters: false,     // Major performance boost
          maxColumn: 120              // Limit minimap width
        },
        scrollBeyondLastLine: false,
        readOnly,
        // Prevent text reflow during resize
        wordWrap: 'off',
        fontSize: 14,                 // Fixed font size
        lineHeight: 1.5,              // Fixed line height  
        fontFamily: 'SF Mono, Monaco, Inconsolata, Roboto Mono, Consolas, Courier New, monospace',
        // Performance optimizations
        renderLineHighlight: 'line',
        renderWhitespace: 'selection',
        renderControlCharacters: false,
        disableLayerHinting: true,    // Improve rendering performance
        smoothScrolling: false,       // Reduce CPU usage
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: false,
        // Prevent layout-affecting features
        rulers: [],                   // Remove rulers
        glyphMargin: false,          // Disable glyph margin
        folding: false,              // Disable folding
        showFoldingControls: 'never',
        // Optimized scrollbar
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          useShadows: false,          // Reduce rendering overhead
          alwaysConsumeMouseWheel: false
        }
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

      // Minimal ResizeObserver for significant container changes only
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          
          // Only trigger layout for significant changes (>50px threshold)
          if (width > 50 && height > 50) {
            // Debounce layout calls to avoid thrashing
            if (layoutTimeoutRef.current) {
              clearTimeout(layoutTimeoutRef.current);
            }
            
            layoutTimeoutRef.current = setTimeout(() => {
              if (monacoRef.current) {
                // Explicit dimensions to prevent Monaco from recalculating
                monacoRef.current.layout({ width, height });
              }
            }, 100); // 100ms debounce
          }
        }
      });

      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;

      // Cleanup
      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
        if (layoutTimeoutRef.current) {
          clearTimeout(layoutTimeoutRef.current);
        }
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

  // Always use dark theme for YAML editor (ignore theme prop changes)
  useEffect(() => {
    if (monacoRef.current) {
      try {
        monaco.editor.setTheme('yaml-dark');
      } catch (error) {
        console.error('[YamlEditor] Error setting dark theme:', error);
      }
    }
  }, [monacoRef.current]);

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

  // Handle file import
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const content = await file.text();
      if (onImport) {
        // Let parent handle validation and update
        const result = await onImport(content);
        if (!result.success) {
          throw new Error(result.message || 'Import failed');
        }
      } else {
        // Fallback: direct update (for read-only mode)
        if (monacoRef.current) {
          monacoRef.current.setValue(content);
          setValue(content);
        }
      }
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      // Reset file input
      event.target.value = '';
    }
  };

  // Handle file export
  const handleExport = () => {
    if (!value) {
      alert('No content to export');
      return;
    }

    const blob = new Blob([value], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="yaml-editor">
      {showImportExport && (
        <div className="d-flex justify-content-end mb-2 gap-2">
          <Button
            size="sm"
            variant="outline-primary"
            onClick={handleImport}
            title="Import YAML file"
          >
            <FiUpload className="me-1" />
            Import
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={handleExport}
            disabled={!value}
            title="Export YAML file"
          >
            <FiDownload className="me-1" />
            Export
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      )}
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