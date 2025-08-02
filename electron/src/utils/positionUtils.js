/**
 * Position management utilities for canvas diagram components
 * Shared between ModularEventFlow and ERDiagram
 */

/**
 * Generate a stable schema ID for localStorage based on content
 * @param {string} content - YAML content to hash
 * @param {string} prefix - Prefix for the schema ID
 * @param {string} projectId - Optional project ID for isolation
 * @returns {string} - Stable schema ID
 */
export const generateSchemaId = (content, prefix, projectId) => {
  if (!projectId) {
    // Project ID is essential for isolating storage.
    // A null return will prevent positions from being saved, which is the correct behavior
    // if the project context is not available.
    return null;
  }
  
  // The schemaId is now composed of the prefix and projectId, ensuring a unique key
  // for each project's ER diagram or modular flow. This was the source of the bug.
  return `${prefix}_${projectId}`;
};

/**
 * Load positions from localStorage
 * @param {string} schemaId - Schema ID for localStorage key
 * @returns {Object} - Positions object or empty object
 */
export const loadPositionsFromStorage = (schemaId) => {
  if (!schemaId) return {};
  
  try {
    const saved = localStorage.getItem(schemaId);
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.error('[positionUtils] Error loading positions from localStorage:', err);
    return {};
  }
};

/**
 * Save positions to localStorage with debouncing
 * @param {Object} positions - Positions to save
 * @param {string} schemaId - Schema ID for localStorage key
 * @param {Object} debounceRef - Ref to store timeout
 * @param {number} delay - Debounce delay in ms (default 300)
 */
export const savePositionsToStorage = (positions, schemaId, debounceRef, delay = 300) => {
  if (!schemaId) return;
  
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    try {
      localStorage.setItem(schemaId, JSON.stringify(positions));
    } catch (err) {
      console.error('[positionUtils] Error saving positions to localStorage:', err);
    }
  }, delay);
};

/**
 * Resolve position priority: current > saved > existing > default
 * @param {Object} item - Item with id/step_id
 * @param {number} index - Index for default positioning
 * @param {Object} currentPositions - Current ReactFlow positions
 * @param {Object} savedPositions - Saved localStorage positions
 * @param {Object} existingPositions - Existing canonical positions
 * @param {boolean} isInitialLoad - Whether this is initial load
 * @param {boolean} localStorageLoaded - Whether localStorage has been loaded
 * @returns {Object} - Resolved position {x, y}
 */
export const resolvePosition = (
  item, 
  index, 
  currentPositions = {}, 
  savedPositions = {}, 
  existingPositions = {}, 
  isInitialLoad = false,
  localStorageLoaded = false
) => {
  const itemId = item.step_id || item.name || item.id;
  const currentPosition = currentPositions[itemId];
  const savedPosition = savedPositions[itemId];
  const existingPosition = existingPositions[itemId];
  
  // Priority logic
  if (isInitialLoad && localStorageLoaded && savedPosition) {
    // On initial load, localStorage takes absolute priority
    return savedPosition;
  } else if (currentPosition) {
    // During active session, current ReactFlow position takes priority
    return currentPosition;
  } else if (savedPosition) {
    // Prioritize localStorage over canonical positions when ReactFlow is empty
    return savedPosition;
  } else if (existingPosition) {
    // Use existing canonical position if available
    return existingPosition;
  } else {
    // Default grid layout for new items
    return generateDefaultPosition(index);
  }
};

/**
 * Generate default grid position for new items
 * @param {number} index - Item index
 * @param {Object} options - Layout options
 * @returns {Object} - Default position {x, y}
 */
export const generateDefaultPosition = (index, options = {}) => {
  const {
    startX = 100,
    startY = 100,
    columnWidth = 300,
    rowHeight = 200,
    columnsPerRow = 3
  } = options;
  
  return {
    x: startX + (index % columnsPerRow) * columnWidth,
    y: startY + Math.floor(index / columnsPerRow) * rowHeight
  };
};

/**
 * Update positions in localStorage when items are deleted
 * @param {Array} deletedIds - Array of deleted item IDs
 * @param {string} schemaId - Schema ID for localStorage
 */
export const removeDeletedPositions = (deletedIds, schemaId) => {
  if (!schemaId || !deletedIds.length) return;
  
  try {
    const savedData = localStorage.getItem(schemaId);
    if (savedData) {
      const positions = JSON.parse(savedData);
      
      // Remove positions for deleted items
      deletedIds.forEach(id => {
        delete positions[id];
      });
      
      // Save updated positions
      localStorage.setItem(schemaId, JSON.stringify(positions));
    }
  } catch (err) {
    console.error('[positionUtils] Error removing deleted positions:', err);
  }
};

/**
 * Calculate optimal layout positions for items
 * @param {Array} items - Items to position
 * @param {number} containerWidth - Container width
 * @param {Object} options - Layout options
 * @returns {Object} - Positions keyed by item ID
 */
export const calculateOptimalLayout = (items, containerWidth = 800, options = {}) => {
  const positions = {};
  const stepWidth = options.itemWidth || 200;
  const stepHeight = options.itemHeight || 100;
  const horizontalSpacing = options.horizontalSpacing || 50;
  const verticalSpacing = options.verticalSpacing || 50;
  
  if (items.length === 0) return positions;
  
  // Simple grid layout
  const maxColumns = Math.floor((containerWidth - horizontalSpacing) / (stepWidth + horizontalSpacing));
  
  items.forEach((item, index) => {
    const column = index % maxColumns;
    const row = Math.floor(index / maxColumns);
    const itemId = item.step_id || item.name || item.id;
    
    positions[itemId] = {
      x: horizontalSpacing + column * (stepWidth + horizontalSpacing),
      y: horizontalSpacing + row * (stepHeight + verticalSpacing)
    };
  });
  
  return positions;
};