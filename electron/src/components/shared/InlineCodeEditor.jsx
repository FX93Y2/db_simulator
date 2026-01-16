import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';

/**
 * A shared inline Monaco code editor component.
 * Uses the same PostgreSQL theme/language configuration as the Formula editor.
 */
const InlineCodeEditor = ({
    value,
    onChange,
    language = 'pgsql',
    height = 190, // Default to ~5 lines
    readOnly = false,
    lineNumbers = 'on',
    minimap = false,
    placeholder = ''
}) => {
    const containerRef = useRef(null);
    const monacoRef = useRef(null);

    // Ensure PostgreSQL language + theme
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
                        [/\b(MIN|MAX|SUM|AVG|COUNT|COALESCE|NOW|CURRENT_DATE|CURRENT_TIMESTAMP|GREATEST|LEAST|RANDOM|DATEDIFF|DAYS|UNIF|NORM|EXP|TRIA|BETA|GAMM|LOGN|WEIB|POIS|BIN|NEGB|GEOM|DISC)\b(?=\s*\()/i, 'function.pgsql']
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
                value: value || '',
                language: language,
                theme: themeName,
                minimap: { enabled: minimap },
                lineNumbers: lineNumbers,
                lineNumbersMinChars: 2,
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
                readOnly: readOnly,
                renderLineHighlight: 'none',
                scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8
                },
                padding: { top: 8, bottom: 8 }
            });

            monacoRef.current = editor;

            editor.onDidChangeModelContent(() => {
                const val = editor.getValue();
                onChange(val);
            });

            // Layout on load
            setTimeout(() => editor.layout(), 50);

        } catch (e) {
            console.error('InlineCodeEditor init failed', e);
        }

        return () => {
            if (editor) {
                editor.dispose();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerRef]);

    // Handle external value changes
    useEffect(() => {
        if (monacoRef.current && monacoRef.current.getValue() !== value) {
            monacoRef.current.setValue(value || '');
        }
    }, [value]);

    // Handle theme changes via body class observer
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const themeName = ensurePgLanguageAndTheme();
                    monaco.editor.setTheme(themeName);
                }
            });
        });

        observer.observe(document.body, { attributes: true });

        return () => observer.disconnect();
    }, []);

    return (
        <div
            style={{
                position: 'relative',
                height: `${height}px`,
                width: '100%',
                border: '1px solid var(--theme-border)',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: 'var(--theme-input-bg, #fff)'
            }}
        >
            <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
    );
};

export default InlineCodeEditor;
