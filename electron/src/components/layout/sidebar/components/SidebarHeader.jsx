import React from 'react';
import { FiDatabase, FiPlus } from 'react-icons/fi';

const SidebarHeader = ({ isCompact, onCreateNew }) => {
  return (
    <div className="sidebar-header">
      <h5 className={`sidebar-title ${isCompact ? 'text-truncate' : ''}`}>
        {isCompact ? 'Explorer' : 'Database Explorer'}
      </h5>
      <div className="sidebar-header-actions">
        <button 
          className="sidebar-action-button"
          onClick={onCreateNew}
          title="Create New Database"
        >
          <div className="compound-icon">
            <FiDatabase className="base-icon" />
            <FiPlus className="overlay-icon" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default SidebarHeader;