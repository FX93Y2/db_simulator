import React, { useState, useEffect } from 'react';
import { Row, Col, Button, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import ProjectCard from '../shared/ProjectCard';
import { clearAllConfigurations } from '../../utils/projectApi';
import { useToastContext } from '../../contexts/ToastContext';
import ConfirmationModal from '../shared/ConfirmationModal';

const Dashboard = ({ theme = 'light' }) => {
  const { showSuccess, showError } = useToastContext();
  const [dbConfigs, setDbConfigs] = useState([]);
  const [simConfigs, setSimConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
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
  
  const handleClearConfigurations = async () => {
    try {
      setClearing(true);
      const result = await clearAllConfigurations(false); // Only clear standalone configs
      
      if (result.success) {
        // Reload configurations
        setDbConfigs([]);
        setSimConfigs([]);
        showSuccess(`Successfully cleared ${result.deleted_count} configurations.`);
      } else {
        showError('Failed to clear configurations: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error clearing configurations:', error);
      showError('Error clearing configurations');
    } finally {
      setClearing(false);
      setShowClearModal(false);
    }
  };
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Project Dashboard</h2>
        <Button 
          variant="danger" 
          size="sm"
          onClick={() => setShowClearModal(true)}
          disabled={clearing}
        >
          {clearing ? <Spinner size="sm" /> : <><FiTrash2 className="me-1" /> Clear All Configurations</>}
        </Button>
      </div>
      
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

      {/* Clear Configurations Modal */}
      <ConfirmationModal
        show={showClearModal}
        onHide={() => setShowClearModal(false)}
        onConfirm={handleClearConfigurations}
        title="Clear All Configurations"
        message="Are you sure you want to clear all standalone configurations? This action cannot be undone. Note: This will only clear configurations not associated with any project."
        confirmText="Clear Configurations"
        cancelText="Cancel"
        variant="danger"
        theme={theme}
      />
    </div>
  );
};

export default Dashboard; 