import React from 'react';
import { FiCopy, FiClipboard, FiTrash2 } from 'react-icons/fi';

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
  hasClipboard, 
  hasSelection,
  itemType = 'item' // 'entity', 'node', or generic 'item'
}) => {
  if (!visible) return null;

  // Ensure position doesn't go off screen
  const adjustedX = Math.min(x, window.innerWidth - 160); // Account for menu width
  const adjustedY = Math.min(y, window.innerHeight - 120); // Account for menu height

  const contextMenuElement = (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        zIndex: 10000,
        backgroundColor: 'var(--theme-contextmenu-bg)',
        border: '1px solid var(--theme-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        minWidth: '150px',
        opacity: 1
      }}
    >
      {hasSelection && (
        <div
          className="context-menu-item"
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            color: 'var(--theme-text)',
            borderBottom: '1px solid var(--theme-border)',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onCopy}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <FiCopy className="me-2" />
          Copy {itemType === 'entity' ? 'Entities' : itemType === 'node' ? 'Nodes' : 'Items'}
        </div>
      )}
      
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
          Paste {itemType === 'entity' ? 'Entities' : itemType === 'node' ? 'Nodes' : 'Items'}
        </div>
      )}
      
      {hasSelection && (
        <div
          className="context-menu-item"
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            color: 'var(--theme-danger)',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onDelete}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <FiTrash2 className="me-2" />
          Delete {itemType === 'entity' ? 'Entities' : itemType === 'node' ? 'Nodes' : 'Items'}
        </div>
      )}
    </div>
  );

  return contextMenuElement;
};

export default CanvasContextMenu;