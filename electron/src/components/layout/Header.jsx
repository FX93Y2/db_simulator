import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSun, FiMoon, FiHelpCircle, FiFile } from 'react-icons/fi';

const Header = ({ currentTheme, onToggleTheme, sidebarVisible, onToggleSidebar, onToggleNavigationSidebar, sidebarMode }) => {
  const handleHelpClick = () => {
    if (onToggleNavigationSidebar) {
      onToggleNavigationSidebar();
    }
  };

  const handleSidebarToggle = () => {
    if (sidebarVisible && sidebarMode === 'database') {
      // If database explorer is already open, close sidebar
      if (onToggleSidebar) {
        onToggleSidebar();
      }
    } else {
      // Show database explorer
      if (onToggleSidebar) {
        onToggleSidebar();
      }
    }
  };

  return (
    <div className="app-header-vertical">
      <div className="header-nav-items">
        <div 
          className={`sidebar-toggle-button ${sidebarVisible && sidebarMode === 'database' ? 'active' : ''}`}
          onClick={handleSidebarToggle}
          title={sidebarVisible && sidebarMode === 'database' ? 'Hide Database Explorer' : 'Show Database Explorer'}
        >
          <FiFile className="toggle-icon" />
        </div>
        
        <div 
          className={`help-button ${sidebarVisible && sidebarMode === 'navigation' ? 'active' : ''}`}
          onClick={handleHelpClick}
          title="Help & Configuration Guide"
        >
          <FiHelpCircle />
        </div>
      </div>
      
      <div className="header-theme-toggle">
        <div 
          className="theme-toggle-switch"
          onClick={onToggleTheme}
          title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <div className="theme-icons">
            <FiSun className="theme-icon sun" />
            <FiMoon className="theme-icon moon" />
          </div>
          <div className={`theme-toggle-slider ${currentTheme === 'dark' ? 'active' : ''}`}></div>
        </div>
      </div>
    </div>
  );
};

export default Header; 