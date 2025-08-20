import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createSafeNavigate } from '../../../../utils/navigationHelper';
import { useToastContext } from '../../../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

export const useResultsManagement = (currentProjectId) => {
  const { showError } = useToastContext();
  const navigate = useNavigate();
  const safeNavigate = createSafeNavigate(navigate);
  const location = useLocation();
  
  const [expandedResults, setExpandedResults] = useState({});
  const [projectResults, setProjectResults] = useState({});
  const [resultTables, setResultTables] = useState({});
  const [resultsRefreshTrigger, setResultsRefreshTrigger] = useState(0);

  // Get currently selected result ID and table from the URL
  const currentResultId = location.pathname.includes('/results/') 
    ? location.pathname.split('/results/')[1].split('/')[0]
    : null;
  const currentTable = new URLSearchParams(location.search).get('table');

  // Listen for project-specific result refresh events
  useEffect(() => {
    const handler = (event) => {
      const { projectId } = event.detail;
      
      if (projectId === currentProjectId) {
        setResultsRefreshTrigger(prev => prev + 1);
      }
    };
    
    window.addEventListener('refreshProjectResults', handler);
    return () => {
      window.removeEventListener('refreshProjectResults', handler);
    };
  }, [currentProjectId]);

  // Handle location state changes for project expansion
  useEffect(() => {
    if (!location.state) return;
    
    if (location.state.expandProject) {
      const projectId = location.state.expandProject;
      setResultsRefreshTrigger(prev => prev + 1);
    }
  }, [location.state]);

  // Refresh results when triggered
  useEffect(() => {
    if (resultsRefreshTrigger === 0) return;
    
    const refreshResults = async () => {
      if (!currentProjectId) return;
      
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const results = await window.api.scanProjectResults(currentProjectId);
        
        if (results.success) {
          setProjectResults(prev => ({
            ...prev,
            [currentProjectId]: results.results || []
          }));
        }
      } catch (error) {
        // Silent error handling
      }
    };
    
    refreshResults();
  }, [resultsRefreshTrigger, currentProjectId]);

  const loadProjectResults = async (projectId) => {
    if (projectResults[projectId]) return;
    
    try {
      const results = await window.api.scanProjectResults(projectId);
      
      if (results.success) {
        setProjectResults(prev => ({
          ...prev,
          [projectId]: results.results || []
        }));
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const loadResultTables = async (projectId, resultId) => {
    const resultKey = `${projectId}-${resultId}`;
    if (resultTables[resultKey]) return;
    
    try {
      const dbPath = `output/${projectId}/${resultId}.db`;
      const tablesResult = await window.api.getDatabaseTables(dbPath);
      
      if (tablesResult.success && tablesResult.tables) {
        setResultTables(prev => ({
          ...prev,
          [resultKey]: tablesResult.tables || []
        }));
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const toggleResultExpansion = async (projectId, resultId) => {
    const resultKey = `${projectId}-${resultId}`;
    const newExpandedState = { ...expandedResults };
    
    if (!expandedResults[resultKey]) {
      await loadResultTables(projectId, resultId);
    }
    
    newExpandedState[resultKey] = !expandedResults[resultKey];
    setExpandedResults(newExpandedState);
  };

  const handleResultClick = (projectId, resultId) => {
    safeNavigate(`/project/${projectId}/results/${resultId}`);
  };

  const handleTableClick = (projectId, resultId, table) => {
    safeNavigate(`/project/${projectId}/results/${resultId}?table=${table}`);
  };

  const handleDeleteResult = async (projectId, result) => {
    try {
      const dbPath = `output/${projectId}/${result.id}.db`;
      const deleteResponse = await window.api.deleteResult(dbPath);
      
      if (deleteResponse.success) {
        const updatedResults = (projectResults[projectId] || []).filter(r => r.id !== result.id);
        setProjectResults(prev => ({
          ...prev,
          [projectId]: updatedResults
        }));
        
        if (currentResultId === result.id) {
          safeNavigate(`/project/${projectId}`);
        }
        
        return { success: true };
      } else {
        showError('Failed to delete result: ' + (deleteResponse.error || 'Unknown error'));
        return { success: false, error: deleteResponse.error };
      }
    } catch (error) {
      showError('Error deleting result');
      return { success: false, error: 'Error deleting result' };
    }
  };

  return {
    expandedResults,
    projectResults,
    resultTables,
    currentResultId,
    currentTable,
    loadProjectResults,
    toggleResultExpansion,
    handleResultClick,
    handleTableClick,
    handleDeleteResult
  };
};