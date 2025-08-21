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
 * @returns {Object} - Viewport state and event handlers
 */
const useViewportPersistence = (projectId, tabName, reactFlowInstance, initialized) => {
  // Load initial viewport state
  const [viewport, setViewport] = useState(() => {
    return viewportService.getViewport(projectId, tabName);
  });

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
    
    // No automatic fitView behavior - let nodes appear where they're positioned
    // This prevents the jarring zoom in/out animation when adding first node to fresh project
  }, [projectId, tabName, reactFlowInstance, initialized]);


  return {
    viewport,
    handleViewportMove,
    handleViewportMoveStart,
    handleViewportMoveEnd
  };
};

export default useViewportPersistence;