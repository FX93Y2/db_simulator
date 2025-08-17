import { useState, useEffect, useCallback } from 'react';
import { getProjectDbConfig } from '../../utils/projectApi';
import { useConfigActions } from '../../stores/simulationConfigStore';
import { useToastContext } from '../../contexts/ToastContext';

/**
 * Custom hook for managing run simulation functionality
 * Handles database config loading, simulation execution, and state management
 */
const useRunSimulation = (projectId) => {
  const { showError } = useToastContext();
  const { runSimulation } = useConfigActions(projectId);

  // State for project database config
  const [projectDbConfig, setProjectDbConfig] = useState(null);
  
  // Run simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);

  // Load project database config when component mounts or projectId changes
  useEffect(() => {
    const loadProjectDbConfig = async () => {
      if (!projectId) return;
      
      try {
        const result = await getProjectDbConfig(projectId);
        console.log('Project DB config result:', result);
        
        if (result.success && result.config) {
          setProjectDbConfig(result.config);
        } else {
          setProjectDbConfig(null);
        }
      } catch (error) {
        console.error('Failed to load project database config:', error);
        setProjectDbConfig(null);
      }
    };
    
    loadProjectDbConfig();
  }, [projectId]);

  // Get database config ID for simulation
  const dbConfigId = projectDbConfig?.id;

  // Handle running simulation
  const handleRunSimulation = useCallback(async () => {
    if (!dbConfigId) {
      showError('No database configuration available. Please ensure a database is configured for this project.');
      return;
    }

    setIsRunning(true);
    setRunError(null);
    setRunResult(null);

    try {
      const result = await runSimulation(dbConfigId);
      
      if (result?.success) {
        setRunResult(result);
        // Note: showSuccess doesn't exist in this context, using console.log for now
        console.log('Simulation completed successfully!');
        
        // Trigger sidebar refresh to show new simulation results for this specific project
        window.dispatchEvent(new CustomEvent('refreshProjectResults', { 
          detail: { projectId } 
        }));
      } else {
        setRunError(result?.error || 'Simulation failed');
        showError(result?.error || 'Simulation failed');
      }
    } catch (error) {
      console.error('Simulation failed:', error);
      setRunError(error.message);
      showError(`Simulation failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [dbConfigId, runSimulation, showError]);

  // Reset run modal state when closing
  const handleCloseModal = useCallback(() => {
    setRunResult(null);
    setRunError(null);
    setIsRunning(false);
  }, []);

  return {
    // State
    projectDbConfig,
    dbConfigId,
    isRunning,
    runResult,
    runError,
    
    // Actions
    handleRunSimulation,
    handleCloseModal
  };
};

export default useRunSimulation;