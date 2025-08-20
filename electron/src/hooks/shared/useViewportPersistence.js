import React, { useState, useCallback, useEffect } from 'react';
import viewportService from '../../services/ViewportService';

/**
 * Shared hook for viewport persistence across ReactFlow components
 * Handles viewport state, event handlers, and initialization logic
 * 
 * @param {string} projectId - Project identifier
 * @param {string} tabName - Tab name ('database' or 'simulation')
 * @param {Object} reactFlowInstance - ReactFlow instance from useReactFlow()
 * @param {boolean} initialized - Whether the component is initialized
 * @param {Array} nodes - Current nodes array (for auto-centering logic)
 * @returns {Object} - Viewport state and event handlers
 */
const useViewportPersistence = (projectId, tabName, reactFlowInstance, initialized, nodes) => {
  // Load initial viewport state
  const [viewport, setViewport] = useState(() => {
    return viewportService.getViewport(projectId, tabName);
  });
  
  const [hasInitialFit, setHasInitialFit] = useState(false);

  // Viewport event handlers
  const handleViewportMove = useCallback((event, newViewport) => {
    setViewport(newViewport);
    viewportService.setViewport(projectId, tabName, newViewport);
  }, [projectId, tabName]);

  const handleViewportMoveStart = useCallback((event, newViewport) => {
    // Move start - could add additional logic here if needed
  }, [projectId, tabName]);

  const handleViewportMoveEnd = useCallback((event, newViewport) => {
    // Final save on move end
    setViewport(newViewport);
    viewportService.setViewport(projectId, tabName, newViewport);
  }, [projectId, tabName]);

  // Handle initial fit and project changes
  useEffect(() => {
    if (!reactFlowInstance || !initialized) return;

    // Handle project switching
    viewportService.handleProjectSwitch(projectId);
    const savedViewport = viewportService.getViewport(projectId, tabName);
    
    // Always apply the saved viewport immediately
    reactFlowInstance.setViewport(savedViewport, { duration: 0 });
    setViewport(savedViewport);
    
    // Check if this is a fresh project (default viewport) and we have nodes
    const isDefaultViewport = savedViewport.x === 0 && savedViewport.y === 0 && savedViewport.zoom === 0.6;
    const hasNodes = nodes && nodes.length > 0;
    
    if (isDefaultViewport && hasNodes && !hasInitialFit) {
      // First time with nodes - fit to view then set to 60% zoom
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.1, duration: 200 });
        setTimeout(() => {
          const currentViewport = reactFlowInstance.getViewport();
          const centeredViewport = {
            x: currentViewport.x,
            y: currentViewport.y,
            zoom: 0.6
          };
          reactFlowInstance.setViewport(centeredViewport, { duration: 200 });
          setViewport(centeredViewport);
          viewportService.setViewport(projectId, tabName, centeredViewport);
          setHasInitialFit(true);
        }, 250);
      }, 100);
    }
  }, [projectId, tabName, reactFlowInstance, initialized, nodes, hasInitialFit]);

  // Reset initial fit flag when project changes
  useEffect(() => {
    setHasInitialFit(false);
  }, [projectId]);

  return {
    viewport,
    handleViewportMove,
    handleViewportMoveStart,
    handleViewportMoveEnd
  };
};

export default useViewportPersistence;