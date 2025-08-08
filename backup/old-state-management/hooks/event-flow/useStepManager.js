import { useState, useCallback } from 'react';

/**
 * Custom hook for managing canonical step state in ModularEventFlow
 * Handles step CRUD operations, positioning, and internal update tracking
 */
export const useStepManager = (positions) => {
  // Canonical step state - this is the source of truth
  const [canonicalSteps, setCanonicalSteps] = useState([]);
  
  // No longer need internal update tracking - canvas is source of truth

  // Direct step manipulation methods - Canvas is source of truth
  const addStep = useCallback((stepData, containerRef) => {
    // Calculate viewport-centered position for new step
    let newPosition;
    if (containerRef?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      
      // Add some randomness to avoid stacking steps exactly on top of each other
      const offsetX = (canonicalSteps.length % 3 - 1) * 50;
      const offsetY = Math.floor(canonicalSteps.length / 3) * 50;
      
      newPosition = {
        x: Math.max(50, centerX - 100 + offsetX),
        y: Math.max(50, centerY - 100 + offsetY)
      };
    } else {
      // Fallback to grid positioning
      newPosition = {
        x: 50 + (canonicalSteps.length % 3) * 300,
        y: 100 + Math.floor(canonicalSteps.length / 3) * 200
      };
    }
    
    // Add to canonical steps
    const newStep = {
      ...stepData,
      position: newPosition
    };
    
    setCanonicalSteps(prev => [...prev, newStep]);
    
    // Update position in hook
    positions.updateItemPosition(stepData.step_id, newPosition);
    
    // Canvas drives YAML - no sync loops to prevent
    
    return newStep;
  }, [canonicalSteps, positions]);

  const updateStep = useCallback((stepId, newData) => {
    // Check if step_id is changing
    const isIdChanging = newData.step_id && newData.step_id !== stepId;
    
    setCanonicalSteps(prev => prev.map(step => 
      step.step_id === stepId 
        ? { 
            ...step, 
            ...newData, 
            position: step.position // Preserve position
          }
        : step
    ));
    
    // If step_id is changing, update position mapping
    if (isIdChanging) {
      positions.updateItemId(stepId, newData.step_id);
    }
    
    // Canvas drives YAML - no sync loops to prevent
  }, [positions]);

  const deleteStep = useCallback((stepId) => {
    // Remove from canonical steps
    setCanonicalSteps(prev => prev.filter(step => step.step_id !== stepId));
    
    // Remove position
    positions.removeItemPositions([stepId]);
    
    // Canvas drives YAML - no sync loops to prevent
  }, [positions]);

  const updateStepPosition = useCallback((stepId, newPosition) => {
    // Update position in canonical steps
    setCanonicalSteps(prev => prev.map(step => 
      step.step_id === stepId 
        ? { ...step, position: newPosition }
        : step
    ));
    
    // Update position in hook for localStorage persistence
    positions.updateItemPosition(stepId, newPosition);
  }, [positions]);

  // Simplified - no internal update tracking needed
  const resetInternalFlags = useCallback(() => {
    // No-op - keeping for API compatibility
  }, []);

  const isInternalUpdate = useCallback(() => {
    return false; // Always false - no bidirectional sync
  }, []);

  return {
    canonicalSteps,
    setCanonicalSteps,
    addStep,
    updateStep,
    deleteStep,
    updateStepPosition,
    // Removed internal update refs - no longer needed
    resetInternalFlags,
    isInternalUpdate
  };
};