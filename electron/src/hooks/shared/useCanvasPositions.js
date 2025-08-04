/**
 * Shared hook for canvas position management
 * Used by ModularEventFlow and ERDiagram components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  generateSchemaId, 
  loadPositionsFromStorage, 
  savePositionsToStorage,
  resolvePosition,
  removeDeletedPositions
} from '../../utils/positionUtils';

/**
 * Canvas position management hook
 * @param {string} content - YAML content for schema ID generation
 * @param {string} prefix - Prefix for localStorage key (e.g., 'modular_flow_positions', 'er_diagram_positions')
 * @param {string} projectId - Optional project ID for isolation
 * @param {boolean} debug - Enable debug logging (default: false)
 * @returns {Object} - Position management state and methods
 */
export const useCanvasPositions = (content, prefix, projectId = null, debug = false) => {
  // Core state
  const [schemaId, setSchemaId] = useState(null);
  const [layoutMap, setLayoutMap] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [layoutMapReady, setLayoutMapReady] = useState(false);
  
  // Refs for state tracking
  const localStorageLoadedRef = useRef(false);
  const debounceRef = useRef();
  const currentNodesRef = useRef([]);
  
  // Debug logging helper
  const log = useCallback((message, ...args) => {
    if (debug) {
      console.log(`[useCanvasPositions] ${message}`, ...args);
    }
  }, [debug]);
  
  // Generate stable schema ID when content changes
  useEffect(() => {
    if (content && typeof content === 'string') {
      const id = generateSchemaId(content, prefix, projectId);
      
      if (id) {
        log('Generated schema ID:', id);
        
        // Reset loading states when schema ID changes (new project/content)
        if (schemaId && schemaId !== id) {
          log(`Schema change detected: ${schemaId} -> ${id}, resetting loading states`);
          setIsInitialLoad(true);
          localStorageLoadedRef.current = false;
          setLayoutMapReady(false);
          setLayoutMap({}); // Clear old project positions
        }
        
        setSchemaId(id);
      }
    }
  }, [content, prefix, projectId, schemaId, log]);
  
  // Load layout map from localStorage when schema ID is available
  useEffect(() => {
    if (schemaId) {
      const savedPositions = loadPositionsFromStorage(schemaId);
      const positionCount = Object.keys(savedPositions).length;
      
      if (positionCount > 0) {
        log(`Loaded ${positionCount} positions from localStorage for schema ${schemaId}:`, savedPositions);
      } else {
        log('No saved positions found for schema', schemaId);
      }
      
      setLayoutMap(savedPositions);
      localStorageLoadedRef.current = true;
      setLayoutMapReady(true);
    }
  }, [schemaId, log]);
  
  // Debounced save to localStorage
  const saveLayout = useCallback((positions) => {
    if (!schemaId) return;
    
    const positionCount = Object.keys(positions).length;
    if (positionCount > 0) {
      log(`Saving ${positionCount} positions to localStorage`);
      savePositionsToStorage(positions, schemaId, debounceRef);
    }
  }, [schemaId, log]);
  
  // Save layout to localStorage when layoutMap changes
  useEffect(() => {
    if (schemaId && Object.keys(layoutMap).length > 0) {
      saveLayout(layoutMap);
    }
  }, [layoutMap, schemaId, saveLayout]);
  
  // Update current nodes ref
  const updateCurrentNodes = useCallback((nodes) => {
    if (!isInitialLoad) {
      currentNodesRef.current = nodes;
      log(`Updated current nodes ref with ${nodes.length} nodes`);
    }
  }, [isInitialLoad, log]);
  
  // Check if localStorage is ready for processing
  const isStorageReady = useCallback(() => {
    // Skip if localStorage hasn't loaded yet
    if (isInitialLoad && !localStorageLoadedRef.current) {
      log('Waiting - localStorage not ready yet');
      return false;
    }
    
    // Skip if we expect localStorage positions but layoutMap hasn't been updated yet
    if (isInitialLoad && localStorageLoadedRef.current && schemaId) {
      const saved = localStorage.getItem(schemaId);
      if (saved && Object.keys(layoutMap).length === 0) {
        log('Waiting - localStorage has positions but layoutMap not yet populated');
        return false;
      }
    }
    
    return true;
  }, [isInitialLoad, layoutMap, schemaId, log]);
  
  // Resolve positions for items using priority logic
  const resolvePositions = useCallback((items) => {
    if (!items || items.length === 0) return [];
    
    // Capture current node positions from ReactFlow
    const currentPositions = {};
    currentNodesRef.current.forEach(node => {
      currentPositions[node.id] = node.position;
    });
    
    // Get existing positions from items
    const existingPositions = {};
    items.forEach(item => {
      const itemId = item.step_id || item.name || item.id;
      if (item.position) {
        existingPositions[itemId] = item.position;
      }
    });
    
    log('Resolving positions for', items.length, 'items');
    log('Current positions:', Object.keys(currentPositions).length);
    log('Saved positions:', Object.keys(layoutMap).length);
    log('Existing positions:', Object.keys(existingPositions).length);
    
    return items.map((item, index) => {
      const position = resolvePosition(
        item,
        index,
        currentPositions,
        layoutMap,
        existingPositions,
        isInitialLoad,
        localStorageLoadedRef.current
      );
      
      return {
        ...item,
        position
      };
    });
  }, [layoutMap, isInitialLoad, log]);
  
  // Update position for a single item
  const updateItemPosition = useCallback((itemId, position) => {
    log(`Updating position for ${itemId}:`, position);
    
    setLayoutMap(prev => ({
      ...prev,
      [itemId]: { ...position }
    }));
  }, [log]);
  
  // Update positions when item ID changes (preserving position)
  const updateItemId = useCallback((oldId, newId) => {
    setLayoutMap(prev => {
      const currentPosition = prev[oldId];
      if (currentPosition) {
        const newLayout = { ...prev };
        newLayout[newId] = currentPosition;
        delete newLayout[oldId];
        log(`Updated layoutMap key: ${oldId} -> ${newId}`);
        return newLayout;
      }
      return prev;
    });
  }, [log]);
  
  // Remove positions for deleted items
  const removeItemPositions = useCallback((deletedIds) => {
    log('Removing positions for items:', deletedIds);
    
    // Update layoutMap state
    setLayoutMap(prev => {
      const newLayout = { ...prev };
      deletedIds.forEach(id => {
        delete newLayout[id];
      });
      return newLayout;
    });
    
    // Update localStorage
    if (schemaId) {
      removeDeletedPositions(deletedIds, schemaId);
    }
  }, [schemaId, log]);
  
  // Clear initial load flag
  const completeInitialLoad = useCallback(() => {
    if (isInitialLoad) {
      log('Initial load complete');
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, log]);
  
  return {
    // State
    schemaId,
    layoutMap,
    isInitialLoad,
    layoutMapReady,
    localStorageLoaded: localStorageLoadedRef.current,
    
    // Methods
    updateCurrentNodes,
    isStorageReady,
    resolvePositions,
    updateItemPosition,
    updateItemId,
    removeItemPositions,
    completeInitialLoad,
    
    // Direct access to refs (for advanced usage)
    currentNodesRef,
    localStorageLoadedRef
  };
};