import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FiCode, FiCheck, FiX } from 'react-icons/fi';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// Ensure Monaco base styles are present for tokens/layout
// Note: Monaco base CSS is already bundled via our webpack config; no direct CSS import here.
// Try to load Monaco's built-in SQL contribution; we'll also register a fallback below.
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';

const SQLEditorModal = ({ 
  show, 
  onHide, 
  onSave, 
  initialValue = '',
  title = 'Edit SQL Expression'
}) => {
  const [sqlValue, setSqlValue] = useState(initialValue);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const monacoRef = useRef(null);
  const containerRef = useRef(null);

  // Ensure SQL language + theme are available even if contributions are tree-shaken
  const ensureSqlLanguageAndTheme = () => {
    // Register SQL language if missing
    if (!monaco.languages.getLanguages().some((l) => l.id === 'sql')) {
      monaco.languages.register({ id: 'sql' });
      monaco.languages.setMonarchTokensProvider('sql', {
        ignoreCase: true,
        tokenizer: {
          root: [
            [/--.*/, 'comment'],
            [/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|AS|AND|OR|NOT|NULL|IS|IN|EXISTS|CASE|WHEN|THEN|ELSE|END|UNION|ALL)\b/i, 'keyword'],
            [/\b(AVG|COUNT|FIRST|LAST|MAX|MIN|SUM|RANDOM|NOW|DATEDIFF|DAYS)\b/i, 'predefined'],
            [/@[a-zA-Z_][\w]*/, 'variable'],
            [/\b[0-9]+(\.[0-9]+)?\b/, 'number'],
            [/"([^"\\]|\\.)*"/, 'string'],
            [/\'([^'\\]|\\.)*\'/, 'string']
          ]
        }
      });
      monaco.languages.setLanguageConfiguration('sql', {
        comments: { lineComment: '--' },
        brackets: [ ['{', '}'], ['[', ']'], ['(', ')'] ],
        autoClosingPairs: [
          { open: '(', close: ')' },
          { open: '[', close: ']' },
          { open: '{', close: '}' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '(', close: ')' },
          { open: '[', close: ']' },
          { open: '{', close: '}' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ]
      });
    }

    // Define a theme tuned to our UI so tokens are visible
    const dark = document.body.classList.contains('theme-dark');
    const themeName = dark ? 'dbsim-dark' : 'dbsim-light';
    monaco.editor.defineTheme(themeName, {
      base: dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'variable', foreground: '4FC1FF' },
        { token: 'predefined', foreground: 'DCDCAA' }
      ],
      colors: {}
    });
    monaco.editor.setTheme(themeName);
    return themeName;
  };

  // PostgreSQL dialect + theme to guarantee highlighting regardless of bundler
  const ensurePgLanguageAndTheme = () => {
    if (!monaco.languages.getLanguages().some((l) => l.id === 'pgsql')) {
      monaco.languages.register({ id: 'pgsql', aliases: ['PostgreSQL', 'postgres', 'pgsql'] });
      monaco.languages.setMonarchTokensProvider('pgsql', {
        ignoreCase: true,
        defaultToken: '',
        tokenizer: {
          root: [
            [/--.*$/, 'comment.pgsql'],
            [/\/\*/, { token: 'comment.pgsql', next: '@comment' }],
            [/"([^"\\]|\\.)*"/, 'string.pgsql'],
            [/\'([^'\\]|\\.)*\'/, 'string.pgsql'],
            [/\b\d+\.?\d*\b/, 'number.pgsql'],
            [/@[a-zA-Z_][\w]*/, 'variable.pgsql'],
            [/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|AS|AND|OR|NOT|NULL|IS|IN|EXISTS|CASE|WHEN|THEN|ELSE|END|UNION|ALL|DISTINCT|HAVING|RETURNING|WITH)\b/i, 'keyword.pgsql'],
            [/\b(INT|INTEGER|BIGINT|SMALLINT|SERIAL|BIGSERIAL|VARCHAR|CHAR|TEXT|DATE|TIMESTAMP|TIMESTAMPTZ|BOOLEAN|NUMERIC|DECIMAL|REAL|DOUBLE)\b/i, 'type.pgsql'],
            [/\b(MIN|MAX|SUM|AVG|COUNT|COALESCE|NOW|CURRENT_DATE|CURRENT_TIMESTAMP|GREATEST|LEAST|RANDOM|DATEDIFF|DAYS)\b(?=\s*\()/i, 'function.pgsql']
          ],
          comment: [
            [/[^*/]+/, 'comment.pgsql'],
            [/(\*\/)/, 'comment.pgsql', '@pop'],
            [/./, 'comment.pgsql']
          ]
        }
      });

      monaco.languages.setLanguageConfiguration('pgsql', {
        comments: { lineComment: '--', blockComment: ['/*', '*/'] },
        brackets: [['{', '}'], ['[', ']'], ['(', ')']],
        autoClosingPairs: [
          { open: '(', close: ')' },
          { open: '[', close: ']' },
          { open: '{', close: '}' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '(', close: ')' },
          { open: '[', close: ']' },
          { open: '{', close: '}' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ]
      });
    }

    const dark = document.body.classList.contains('theme-dark');
    const themeName = dark ? 'dbsim-pg-dark' : 'dbsim-pg-light';
    monaco.editor.defineTheme(themeName, {
      base: dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'comment.pgsql', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword.pgsql', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'type.pgsql', foreground: '4EC9B0' },
        { token: 'function.pgsql', foreground: 'DCDCAA' },
        { token: 'number.pgsql', foreground: 'B5CEA8' },
        { token: 'string.pgsql', foreground: 'CE9178' },
        { token: 'variable.pgsql', foreground: '9CDCFE' }
      ],
      colors: {}
    });
    monaco.editor.setTheme(themeName);
    return themeName;
  };

  // Initialize Monaco Editor
  useEffect(() => {
    if (!show || !containerRef.current) return;

    let editor = null;

    const initializeEditor = async () => {
      try {
        const themeName = ensurePgLanguageAndTheme();
        // Create the editor
        editor = monaco.editor.create(containerRef.current, {
          // Use the latest initialValue directly to avoid stale state on first open
          value: initialValue,
          language: 'pgsql',
          theme: themeName,
          minimap: { enabled: false },
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          fontSize: 13,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          folding: false,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
          }
        });

        monacoRef.current = editor;

        // Ensure editor reflects the latest prop value on first init
        editor.setValue(initialValue || '');
        setSqlValue(initialValue || '');

        // Listen for content changes
        editor.onDidChangeModelContent(() => {
          setSqlValue(editor.getValue());
        });

        setIsEditorReady(true);

        // Focus the editor after a short delay
        setTimeout(() => {
          editor.focus();
        }, 100);

      } catch (error) {
        console.error('Failed to initialize SQL editor:', error);
      }
    };

    const timer = setTimeout(initializeEditor, 100);

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (editor) {
        editor.dispose();
        monacoRef.current = null;
        setIsEditorReady(false);
      }
    };
  }, [show]);

  // Update editor value when initialValue changes OR when modal shows
  useEffect(() => {
    if (monacoRef.current && show) {
      setSqlValue(initialValue || '');
      monacoRef.current.setValue(initialValue || '');
    }
  }, [initialValue, show]);

  const handleSave = () => {
    onSave(sqlValue);
    onHide();
  };

  const handleCancel = () => {
    setSqlValue(initialValue); // Reset to initial value
    if (monacoRef.current) {
      monacoRef.current.setValue(initialValue);
    }
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleCancel}
      onEntered={() => {
        // When the modal finishes opening, ensure layout and content are correct
        if (monacoRef.current) {
          try {
            ensurePgLanguageAndTheme();
            monacoRef.current.layout();
            monacoRef.current.setValue(initialValue || sqlValue || '');
            monacoRef.current.focus();
          } catch (e) {
            console.error('SQLEditorModal: error during onEntered layout/update', e);
          }
        }
      }}
      centered
      size="lg"
      className="sql-editor-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <FiCode className="me-2" />
          {title}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {/* Fixed-height wrapper ensures stable modal height during load/close */}
        <div
          style={{
            position: 'relative',
            height: '300px',
            minHeight: '300px',
            maxHeight: '300px',
            width: '100%',
            border: '1px solid var(--theme-border)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        >
          <div
            ref={containerRef}
            style={{
              position: 'absolute',
              inset: 0,
              // Container inherits border and radius from wrapper
            }}
          />
          {!isEditorReady && (
            <div
              className="d-flex justify-content-center align-items-center"
              style={{ position: 'absolute', inset: 0 }}
            >
              <div className="text-muted">Loading SQL editor...</div>
            </div>
          )}
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={handleCancel}
          className="d-flex align-items-center"
        >
          <FiX className="me-1" />
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          className="d-flex align-items-center"
        >
          <FiCheck className="me-1" />
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SQLEditorModal;
