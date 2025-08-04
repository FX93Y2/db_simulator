import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing canonical step state in ModularEventFlow
 * Handles step CRUD operations, positioning, and internal update tracking
 */
export const useStepManager = (positions) => {
  // Canonical step state - this is the source of truth
  const [canonicalSteps, setCanonicalSteps] = useState([]);
  
  // Track if we're updating from internal canvas operations
  const internalUpdateRef = useRef(false);
  const pendingInternalUpdateRef = useRef(false);

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
    
    // Set internal update flags to prevent YAML sync loops
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
    
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
    
    // Set internal update flags
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
  }, [positions]);

  const deleteStep = useCallback((stepId) => {
    // Remove from canonical steps
    setCanonicalSteps(prev => prev.filter(step => step.step_id !== stepId));
    
    // Remove position
    positions.removeItemPositions([stepId]);
    
    // Set internal update flags
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
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

  // Reset internal update flags
  const resetInternalFlags = useCallback(() => {
    internalUpdateRef.current = false;
    pendingInternalUpdateRef.current = false;
  }, []);

  // Check if update is internal
  const isInternalUpdate = useCallback(() => {
    return internalUpdateRef.current || pendingInternalUpdateRef.current;
  }, []);

  return {
    canonicalSteps,
    setCanonicalSteps,
    addStep,
    updateStep,
    deleteStep,
    updateStepPosition,
    internalUpdateRef,
    pendingInternalUpdateRef,
    resetInternalFlags,
    isInternalUpdate
  };
};