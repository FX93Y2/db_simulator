import { useState, useCallback, useRef } from 'react';
import { sortAttributes } from '../../components/shared/entity-nodes/EntityNode';

/**
 * Custom hook for managing canonical entity state in ERDiagram
 * Handles entity CRUD operations, positioning, and internal update tracking
 */
export const useEntityManager = (positions) => {
  // Canonical entity state - this is the source of truth
  const [canonicalEntities, setCanonicalEntities] = useState([]);
  
  // Track if we're updating from internal canvas operations
  const internalUpdateRef = useRef(false);
  const pendingInternalUpdateRef = useRef(false);

  // Direct entity manipulation methods - Canvas is source of truth
  const addEntity = useCallback((entityData, containerRef) => {
    // Calculate viewport-centered position for new entity
    let newPosition;
    if (containerRef?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      
      // Add some randomness to avoid stacking entities exactly on top of each other
      const offsetX = (canonicalEntities.length % 3 - 1) * 50;
      const offsetY = Math.floor(canonicalEntities.length / 3) * 50;
      
      newPosition = {
        x: Math.max(50, centerX - 100 + offsetX),
        y: Math.max(50, centerY - 100 + offsetY)
      };
    } else {
      // Fallback to grid positioning
      newPosition = {
        x: 50 + (canonicalEntities.length % 3) * 300,
        y: 100 + Math.floor(canonicalEntities.length / 3) * 200
      };
    }
    
    // Add to canonical entities
    const newEntity = {
      ...entityData,
      position: newPosition,
      attributes: sortAttributes(entityData.attributes || [])
    };
    
    setCanonicalEntities(prev => [...prev, newEntity]);
    
    // Update position in hook
    positions.updateItemPosition(entityData.name, newPosition);
    
    // Set internal update flags to prevent YAML sync loops
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
    
    return newEntity;
  }, [canonicalEntities, positions]);

  const updateEntity = useCallback((entityId, newData) => {
    // Check if name is changing
    const isNameChanging = newData.name && newData.name !== entityId;
    
    setCanonicalEntities(prev => prev.map(entity => 
      entity.name === entityId 
        ? { 
            ...entity, 
            ...newData, 
            position: entity.position, // Preserve position
            attributes: sortAttributes(newData.attributes || entity.attributes || []) // Sort attributes
          }
        : entity
    ));
    
    // If name is changing, update position mapping
    if (isNameChanging) {
      positions.updateItemId(entityId, newData.name);
    }
    
    // Set internal update flags
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
  }, [positions]);

  const deleteEntity = useCallback((entityId) => {
    // Remove from canonical entities
    setCanonicalEntities(prev => prev.filter(entity => entity.name !== entityId));
    
    // Remove position
    positions.removeItemPositions([entityId]);
    
    // Set internal update flags
    internalUpdateRef.current = true;
    pendingInternalUpdateRef.current = true;
  }, [positions]);

  const updateEntityPosition = useCallback((entityId, newPosition) => {
    // Update position in canonical entities
    setCanonicalEntities(prev => prev.map(entity => 
      entity.name === entityId 
        ? { ...entity, position: newPosition }
        : entity
    ));
    
    // Update position in hook for localStorage persistence
    positions.updateItemPosition(entityId, newPosition);
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
    canonicalEntities,
    setCanonicalEntities,
    addEntity,
    updateEntity,
    deleteEntity,
    updateEntityPosition,
    internalUpdateRef,
    pendingInternalUpdateRef,
    resetInternalFlags,
    isInternalUpdate
  };
};