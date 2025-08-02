import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Navbar } from 'react-bootstrap';
import { FiSun, FiMoon, FiHelpCircle } from 'react-icons/fi';
import appIcon from '../../../public/icon.png';

const Header = ({ currentTheme, onToggleTheme, sidebarVisible, onToggleSidebar }) => {
  const navigate = useNavigate();

  const handleHelpClick = () => {
    navigate('/');
  };

  return (
    <Navbar expand="lg" className="app-header">
      <Container fluid>
        <div className="d-flex align-items-center">
          <div 
            className={`sidebar-toggle-button ${sidebarVisible ? 'active' : ''}`}
            onClick={onToggleSidebar}
            title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
          >
            <img 
              src={appIcon}
              alt="Toggle Sidebar" 
              className="app-icon" 
            />
          </div>
          
          <div 
            className="help-button"
            onClick={handleHelpClick}
            title="Help & Configuration Guide"
          >
            <FiHelpCircle />
          </div>
        </div>
        
        <div className="ms-auto">
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
      </Container>
    </Navbar>
  );
};

export default Header; 