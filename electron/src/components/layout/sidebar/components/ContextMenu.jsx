import React from 'react';
import ReactDOM from 'react-dom';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

const ContextMenu = ({ visible, x, y, onEdit, onDelete, onClose }) => {
  if (!visible) return null;

  // Ensure position doesn't go off screen
  const adjustedX = Math.min(x, window.innerWidth - 160); // Account for menu width
  const adjustedY = Math.min(y, window.innerHeight - 80); // Account for menu height

  const contextMenuElement = (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        zIndex: 10000, // Higher than sidebar z-index
        backgroundColor: 'var(--theme-card-bg)',
        border: '1px solid var(--theme-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        minWidth: '150px',
        animation: 'contextMenuFadeIn 0.15s ease-out'
      }}
    >
      <div
        className="context-menu-item"
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
          borderBottom: '1px solid var(--theme-border)'
        }}
        onClick={onEdit}
        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
      >
        <FiEdit className="me-2" />
        Edit Name
      </div>
      <div
        className="context-menu-item"
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          color: '#dc3545'
        }}
        onClick={onDelete}
        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
      >
        <FiTrash2 className="me-2" />
        Delete Project
      </div>
    </div>
  );

  return ReactDOM.createPortal(contextMenuElement, document.body);
};

export default ContextMenu;