import React from 'react';
import { NavLink } from 'react-router-dom';
import { Container, Navbar } from 'react-bootstrap';
import { FiSun, FiMoon } from 'react-icons/fi';
import appIcon from '../../../public/icon.png';

const Header = ({ currentTheme, onToggleTheme }) => {
  return (
    <Navbar expand="lg" className="app-header">
      <Container fluid>
        <Navbar.Brand as={NavLink} to="/" className="app-icon-brand">
          <img 
            src={appIcon}
            alt="App Icon" 
            className="app-icon" 
          />
        </Navbar.Brand>
        
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