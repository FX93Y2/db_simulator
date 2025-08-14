import React from 'react';
import { Spinner } from 'react-bootstrap';

/**
 * Shared EditorLayout component for both DbConfigEditor and SimConfigEditor
 * Contains the common grid layout structure with YAML and Canvas panels
 */
const EditorLayout = ({
  header,
  yamlContent,
  canvasContent,
  onResize,
  isLoading,
  yamlContentComponent,
  theme
}) => {
  return (
    <div className="editor-grid-container">
      {/* Header */}
      {header}

      {/* YAML Panel Content */}
      <div className="grid-yaml-content">
        {isLoading && !yamlContent ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <div className="mt-2">Loading configuration...</div>
          </div>
        ) : (
          yamlContentComponent
        )}
      </div>

      {/* Canvas Panel Content */}
      <div className="grid-canvas-content">
        <div className="canvas-content">
          {isLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2">Loading...</div>
            </div>
          ) : (
            canvasContent
          )}
        </div>
      </div>

      {/* Resize Handle */}
      {onResize && (
        <div 
          className="grid-resize-handle"
          onMouseDown={onResize}
          title="Drag to resize panels"
        />
      )}
    </div>
  );
};

export default EditorLayout;