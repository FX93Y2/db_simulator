import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FiCode, FiCheck, FiX } from 'react-icons/fi';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

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

  // Initialize Monaco Editor
  useEffect(() => {
    if (!show || !containerRef.current) return;

    let editor = null;

    const initializeEditor = async () => {
      try {
        // Create the editor
        editor = monaco.editor.create(containerRef.current, {
          // Use the latest initialValue directly to avoid stale state on first open
          value: initialValue,
          language: 'sql',
          theme: document.body.classList.contains('theme-dark') ? 'vs-dark' : 'vs',
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
      
      <Modal.Body style={{ padding: 0 }}>
        {/* Fixed-height wrapper ensures stable modal height during load/close */}
        <div
          style={{
            position: 'relative',
            height: '300px',
            minHeight: '300px',
            maxHeight: '300px',
            width: '100%'
          }}
        >
          <div
            ref={containerRef}
            style={{
              position: 'absolute',
              inset: 0,
              border: '1px solid var(--theme-border)',
              borderRadius: '4px'
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
