import React from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const navigate = useNavigate();
  
  return (
    <header className="app-header">
      <div className="app-title">DB Simulator</div>
      <div className="app-actions">
        <Button 
          variant="outline-light" 
          size="sm"
          onClick={() => navigate('/dashboard')}
        >
          Dashboard
        </Button>
        <Button 
          variant="outline-light" 
          size="sm"
          onClick={() => navigate('/db-config')}
        >
          New DB Config
        </Button>
        <Button 
          variant="outline-light" 
          size="sm"
          onClick={() => navigate('/sim-config')}
        >
          New Simulation
        </Button>
      </div>
    </header>
  );
};

export default Header; 