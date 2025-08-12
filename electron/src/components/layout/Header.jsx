import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSun, FiMoon, FiHelpCircle, FiFile } from 'react-icons/fi';

const Header = ({ currentTheme, onToggleTheme, sidebarVisible, onToggleSidebar }) => {
  const navigate = useNavigate();

  const handleHelpClick = () => {
    navigate('/');
  };

  return (
    <div className="app-header-vertical">
      <div className="header-nav-items">
        <div 
          className={`sidebar-toggle-button ${sidebarVisible ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          <FiFile className="toggle-icon" />
        </div>
        
        <div 
          className="help-button"
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