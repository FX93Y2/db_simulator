import React from 'react';
import { NavLink } from 'react-router-dom';
import { Container, Navbar, Button } from 'react-bootstrap';
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
          <Button 
            variant="outline-light"
            size="sm"
            onClick={onToggleTheme}
            className="btn-custom-toolbar"
            title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {currentTheme === 'dark' ? <FiSun /> : <FiMoon />}
          </Button>
        </div>
      </Container>
    </Navbar>
  );
};

export default Header; 