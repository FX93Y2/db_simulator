import React, { useState, useEffect, useRef } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiHelpCircle } from 'react-icons/fi';
import { SharedHelpPanel } from '../../../shared/help';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';

const FormulaGeneratorEditor = ({ generator, onExpressionChange }) => {
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const containerRef = useRef(null);
  const monacoRef = useRef(null);

  // Ensure PostgreSQL language + theme similar to SQLEditorModal
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

  // Initialize Monaco inline editor
  useEffect(() => {
    if (!containerRef.current) return;

    let editor = null;
    try {
      const themeName = ensurePgLanguageAndTheme();
      editor = monaco.editor.create(containerRef.current, {
        value: generator.expression || '',
        language: 'pgsql',
        theme: themeName,
        minimap: { enabled: false },
        lineNumbers: 'on',
        lineNumbersMinChars: 2, // tighten gutter width
        lineDecorationsWidth: 8,
        glyphMargin: false,
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

      editor.onDidChangeModelContent(() => {
        const val = editor.getValue();
        onExpressionChange(val);
      });

      // slight delay to layout/focus
      setTimeout(() => editor.layout(), 50);
    } catch (e) {
      console.error('Inline Formula editor init failed', e);
    }

    return () => {
      if (editor) {
        editor.dispose();
        monacoRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  // Keep editor in sync when prop changes externally
  useEffect(() => {
    if (monacoRef.current) {
      const current = monacoRef.current.getValue();
      const next = generator.expression || '';
      if (current !== next) {
        monacoRef.current.setValue(next);
      }
    }
  }, [generator.expression]);

  // Desired height ~5x select height (~38px)
  const editorHeight = 38 * 5; // 190px

  return (
    <>
      <Form.Group className="mb-3" controlId="formula-expression-inline">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <Form.Label className="mb-0">Formula Expression</Form.Label>
          <Button
            variant=""
            size="sm"
            onClick={() => setShowHelpPanel(!showHelpPanel)}
            className={`border-0 help-toggle-btn ${showHelpPanel ? 'active' : ''}`}
            title={showHelpPanel ? 'Hide formula expression help' : 'Show formula expression help'}
          >
            <FiHelpCircle size={18} />
          </Button>
        </div>
        <div
          style={{
            position: 'relative',
            height: `${editorHeight}px`,
            minHeight: `${editorHeight}px`,
            maxHeight: `${editorHeight}px`,
            width: '100%',
            border: '1px solid var(--theme-border)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        >
          <div
            ref={containerRef}
            style={{ position: 'absolute', inset: 0 }}
          />
        </div>
      </Form.Group>

      <SharedHelpPanel 
        show={showHelpPanel}
        onHide={() => setShowHelpPanel(false)}
        helpType="formula"
      />
    </>
  );
};

export default FormulaGeneratorEditor;
