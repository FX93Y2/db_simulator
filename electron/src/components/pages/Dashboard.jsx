import React, { useState, useEffect } from 'react';
import { Row, Col, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import ProjectCard from '../shared/ProjectCard';

const Dashboard = () => {
  const [dbConfigs, setDbConfigs] = useState([]);
  const [simConfigs, setSimConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        setLoading(true);
        // Load database configurations
        const dbResult = await window.api.getConfigs('database');
        if (dbResult.success) {
          setDbConfigs(dbResult.configs || []);
        }
        
        // Load simulation configurations
        const simResult = await window.api.getConfigs('simulation');
        if (simResult.success) {
          setSimConfigs(simResult.configs || []);
        }
      } catch (error) {
        console.error('Error loading configurations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadConfigurations();
  }, []);
  
  const handleDeleteConfig = async (configId) => {
    try {
      const result = await window.api.deleteConfig(configId);
      if (result.success) {
        // Update the state to remove the deleted config
        setDbConfigs(dbConfigs.filter(config => config.id !== configId));
        setSimConfigs(simConfigs.filter(config => config.id !== configId));
      }
    } catch (error) {
      console.error('Error deleting configuration:', error);
    }
  };
  
  return (
    <div>
      <h2 className="mb-4">Project Dashboard</h2>
      
      {/* Database Configurations */}
      <div className="dashboard-card mb-4">
        <div className="dashboard-card__header">
          <h3>Database Configurations</h3>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => navigate('/db-config')}
          >
            <FiPlus /> New
          </Button>
        </div>
        <div className="dashboard-card__content">
          {loading ? (
            <p>Loading configurations...</p>
          ) : dbConfigs.length === 0 ? (
            <p>No database configurations found.</p>
          ) : (
            <Row>
              {dbConfigs.map(config => (
                <Col md={6} lg={4} key={config.id}>
                  <ProjectCard 
                    id={config.id}
                    name={config.name}
                    description={config.description}
                    type="database"
                    lastUpdated={config.updated_at}
                    onDelete={handleDeleteConfig}
                  />
                </Col>
              ))}
            </Row>
          )}
        </div>
      </div>
      
      {/* Simulation Configurations */}
      <div className="dashboard-card">
        <div className="dashboard-card__header">
          <h3>Simulation Configurations</h3>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => navigate('/sim-config')}
          >
            <FiPlus /> New
          </Button>
        </div>
        <div className="dashboard-card__content">
          {loading ? (
            <p>Loading configurations...</p>
          ) : simConfigs.length === 0 ? (
            <p>No simulation configurations found.</p>
          ) : (
            <Row>
              {simConfigs.map(config => (
                <Col md={6} lg={4} key={config.id}>
                  <ProjectCard 
                    id={config.id}
                    name={config.name}
                    description={config.description}
                    type="simulation"
                    lastUpdated={config.updated_at}
                    onDelete={handleDeleteConfig}
                  />
                </Col>
              ))}
            </Row>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 