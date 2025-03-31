import React from 'react';
import { NavLink } from 'react-router-dom';
import { Container, Navbar } from 'react-bootstrap';

const Header = () => {
  return (
    <Navbar expand="lg" bg="primary" variant="dark" className="app-header">
      <Container fluid>
        <Navbar.Brand as={NavLink} to="/" className="app-title">
          DB Simulator
        </Navbar.Brand>
      </Container>
    </Navbar>
  );
};

export default Header; 