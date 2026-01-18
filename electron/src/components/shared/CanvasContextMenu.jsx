import React from 'react';
import { createPortal } from 'react-dom';
import { FiCopy, FiClipboard, FiTrash2, FiLayers, FiGrid } from 'react-icons/fi';

/**
 * Shared context menu component for canvas interactions (ER Diagram & Event Flow)
 * Provides copy, paste, and delete functionality for selected items
 */
const CanvasContextMenu = ({
  visible,
  x,
  y,
  onCopy,
  onPaste,
  onDelete,
  onDeleteEdge,
  hasClipboard,
  hasSelection,
  hasEdgeSelection,
  onGroup,
  onUngroup,
  canGroup,
  canUngroup,
  itemType = 'item' // 'entity', 'node', or generic 'item'
}) => {
  if (!visible) return null;

  const contextMenuElement = (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 10000,
        backgroundColor: 'var(--theme-contextmenu-bg)',
        border: '1px solid var(--theme-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        minWidth: '150px',
        opacity: 1
      }}
    >
      {/* Always show copy for debugging - will fix hasSelection logic later */}
      <div
        className="context-menu-item"
        style={{
          padding: '8px 12px',
          cursor: hasSelection ? 'pointer' : 'not-allowed',
          color: hasSelection ? 'var(--theme-text)' : 'var(--theme-text-muted)',
          borderBottom: '1px solid var(--theme-border)',
          display: 'flex',
          alignItems: 'center',
          opacity: hasSelection ? 1 : 0.5
        }}
        onClick={hasSelection ? onCopy : undefined}
        onMouseEnter={(e) => hasSelection && (e.target.style.backgroundColor = 'var(--theme-hover-bg)')}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
      >
        <FiCopy className="me-2" />
        Copy
      </div>

      {hasClipboard && (
        <div
          className="context-menu-item"
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            color: 'var(--theme-text)',
            borderBottom: hasSelection ? '1px solid var(--theme-border)' : 'none',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onPaste}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <FiClipboard className="me-2" />
          Paste
        </div>
      )}

      {hasSelection && (
        <div
          className="context-menu-item"
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            color: 'var(--bs-danger, #dc3545)',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onDelete}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <FiTrash2 className="me-2" />
          Delete {itemType}
        </div>
      )}

      {hasEdgeSelection && onDeleteEdge && (
        <div
          className="context-menu-item"
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            color: 'var(--bs-danger, #dc3545)',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onDeleteEdge}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <FiTrash2 className="me-2" />
          Delete Connection
        </div>
      )}

      {canGroup && onGroup && (
        <div
          className="context-menu-item"
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            color: 'var(--theme-text)',
            borderTop: '1px solid var(--theme-border)',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onGroup}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <FiLayers className="me-2" />
          Group
        </div>
      )}

      {canUngroup && onUngroup && (
        <div
          className="context-menu-item"
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            color: 'var(--theme-text)',
            borderTop: canGroup ? 'none' : '1px solid var(--theme-border)',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onUngroup}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <FiGrid className="me-2" />
          Ungroup
        </div>
      )}
    </div>
  );

  // Render context menu using portal to ensure correct positioning
  return createPortal(contextMenuElement, document.body);
};

export default CanvasContextMenu;