import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import useRunSimulation from '../../hooks/shared/useRunSimulation';

/**
 * Modal component for running simulations
 * Provides UI for simulation execution with loading states, results, and error handling
 */
const RunSimulationModal = ({ 
  show, 
  onHide, 
  projectId, 
  yamlContent 
}) => {
  const {
    projectDbConfig,
    dbConfigId,
    isRunning,
    runResult,
    runError,
    handleRunSimulation,
    handleCloseModal
  } = useRunSimulation(projectId);

  const handleClose = () => {
    handleCloseModal();
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      enforceFocus={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>Run Simulation</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!dbConfigId ? (
          <div className="alert alert-warning">
            <strong>No Database Configuration</strong><br />
            {!projectId ? 
              'Database configuration is required for simulation.' :
              'Please configure a database for this project before running the simulation.'
            }
          </div>
        ) : isRunning ? (
          <div className="text-center py-3">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Running simulation...</span>
            </div>
            <p className="mt-2">Running simulation...</p>
          </div>
        ) : runResult ? (
          <div className="alert alert-success">
            <strong>Simulation Completed Successfully!</strong><br />
            {runResult.message && <div className="mt-2">{runResult.message}</div>}
            {runResult.output_file && (
              <div className="mt-2">
                <small>Output saved to: {runResult.output_file}</small>
              </div>
            )}
          </div>
        ) : runError ? (
          <div className="alert alert-danger">
            <strong>Simulation Failed</strong><br />
            {runError}
          </div>
        ) : (
          <div>
            <p>Ready to run simulation with the current configuration.</p>
            <div className="mt-3">
              <small className="text-muted">
                Database Configuration: {projectDbConfig ? `Available ✓ (ID: ${projectDbConfig.id})` : 'Missing ✗'}<br />
                Simulation Configuration: {yamlContent ? 'Available ✓' : 'Missing ✗'}
              </small>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          {runResult || runError ? 'Close' : 'Cancel'}
        </Button>
        {!runResult && !runError && (
          <Button 
            variant="primary" 
            onClick={handleRunSimulation}
            disabled={isRunning || !dbConfigId || !yamlContent}
          >
            {isRunning ? 'Running...' : 'Run Simulation'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default RunSimulationModal;