/**
 * Hybrid Position Service for canvas node positions
 * Provides memory cache + localStorage persistence with project isolation
 * 
 * Success Criteria:
 * - Persistent: Survives browser refresh ✓
 * - Project-Scoped: Different layouts per project/config ✓
 * - Performance: Positions cached in memory ✓ 
 * - Garbage Collection: Can clean old positions ✓
 */

class PositionService {
  constructor() {
    // Memory cache: projectId -> Map<nodeId, position>
    this.cache = new Map();
    
    // Debounce timers for saving to localStorage
    this.saveTimers = new Map();
    
    // Configuration
    this.SAVE_DEBOUNCE_MS = 300;
    this.STORAGE_PREFIX = 'positions_';
    this.MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30 minutes
    
    console.log('[PositionService] Initialized hybrid position service');
  }

  /**
   * Get storage key for a project
   * @param {string} projectId - Project identifier
   * @returns {string} - localStorage key
   */
  _getStorageKey(projectId) {
    return `${this.STORAGE_PREFIX}${projectId || 'default'}`;
  }

  /**
   * Load project positions into memory cache from localStorage
   * @param {string} projectId - Project identifier
   */
  loadProject(projectId) {
    const cacheKey = projectId || 'default';
    
    if (this.cache.has(cacheKey)) {
      console.log(`[PositionService] Project ${cacheKey} already loaded in cache`);
      return;
    }

    try {
      const storageKey = this._getStorageKey(projectId);
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        const positionsMap = new Map(parsed.positions || []);
        
        const nodeIds = Array.from(positionsMap.keys());
        console.log(`[PositionService] Loaded ${positionsMap.size} positions for project: ${cacheKey}`, { nodeIds });
        this.cache.set(cacheKey, {
          positions: positionsMap,
          lastAccess: Date.now(),
          dirty: false
        });
      } else {
        // Initialize empty cache for project
        this.cache.set(cacheKey, {
          positions: new Map(),
          lastAccess: Date.now(),
          dirty: false
        });
        console.log(`[PositionService] Initialized empty cache for project: ${cacheKey}`);
      }
    } catch (error) {
      console.error(`[PositionService] Error loading project ${cacheKey}:`, error);
      // Initialize empty cache on error
      this.cache.set(cacheKey, {
        positions: new Map(),
        lastAccess: Date.now(),
        dirty: false
      });
    }
  }

  /**
   * Get position for a node (memory-first lookup)
   * @param {string} projectId - Project identifier
   * @param {string} nodeId - Node identifier
   * @returns {Object|null} - Position {x, y} or null if not found
   */
  getPosition(projectId, nodeId) {
    const cacheKey = projectId || 'default';
    
    // Ensure project is loaded
    if (!this.cache.has(cacheKey)) {
      this.loadProject(projectId);
    }

    const projectCache = this.cache.get(cacheKey);
    if (projectCache) {
      projectCache.lastAccess = Date.now();
      const position = projectCache.positions.get(nodeId);
      
      if (position) {
        return position;
      }
    }

    return null;
  }

  /**
   * Set position for a node (update memory + trigger persistence)
   * @param {string} projectId - Project identifier
   * @param {string} nodeId - Node identifier
   * @param {Object} position - Position {x, y}
   */
  setPosition(projectId, nodeId, position) {
    const cacheKey = projectId || 'default';
    
    // Ensure project is loaded
    if (!this.cache.has(cacheKey)) {
      this.loadProject(projectId);
    }

    const projectCache = this.cache.get(cacheKey);
    if (projectCache) {
      // Clone position to break any Immer proxy connections
      // This prevents "Cannot perform 'get' on a proxy that has been revoked" errors
      const safePosition = this._clonePosition(position);
      
      projectCache.positions.set(nodeId, safePosition);
      projectCache.lastAccess = Date.now();
      projectCache.dirty = true;
      
      // Debounced save to localStorage
      this._debouncedSave(projectId);
    }
  }

  /**
   * Get all positions for a project
   * @param {string} projectId - Project identifier
   * @returns {Map<string, Object>} - Map of nodeId -> position
   */
  getAllPositions(projectId) {
    const cacheKey = projectId || 'default';
    
    // Ensure project is loaded
    if (!this.cache.has(cacheKey)) {
      this.loadProject(projectId);
    }

    const projectCache = this.cache.get(cacheKey);
    return projectCache ? projectCache.positions : new Map();
  }

  /**
   * Remove a node position
   * @param {string} projectId - Project identifier
   * @param {string} nodeId - Node identifier
   */
  removePosition(projectId, nodeId) {
    const cacheKey = projectId || 'default';
    
    const projectCache = this.cache.get(cacheKey);
    if (projectCache && projectCache.positions.has(nodeId)) {
      projectCache.positions.delete(nodeId);
      projectCache.lastAccess = Date.now();
      projectCache.dirty = true;
      
      console.log(`[PositionService] Removed position for ${cacheKey}/${nodeId}`);
      
      // Debounced save to localStorage
      this._debouncedSave(projectId);
    }
  }

  /**
   * Clone position object to break Immer proxy connections
   * @param {Object} position - Position object to clone
   * @returns {Object} - Safe cloned position object
   */
  _clonePosition(position) {
    if (!position || typeof position !== 'object') {
      console.warn('[PositionService] Invalid position object:', position);
      return { x: 0, y: 0 };
    }

    // Log if we're dealing with a proxy object
    if (this._isProxy(position)) {
      console.log('[PositionService] Cloning detected proxy object to prevent revocation errors');
    }

    try {
      // Create a safe clone with proper type coercion
      // This breaks any Immer proxy connections that cause revoked proxy errors
      const safePosition = {
        x: Number(position.x) || 0,
        y: Number(position.y) || 0
      };

      // Validate the cloned position
      if (isNaN(safePosition.x) || isNaN(safePosition.y)) {
        console.warn('[PositionService] Invalid position values, using defaults:', position);
        return { x: 0, y: 0 };
      }

      return safePosition;
      
    } catch (error) {
      // If cloning failed (likely due to revoked proxy), use defaults
      console.warn('[PositionService] Failed to clone position (likely revoked proxy), using defaults:', error.message);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Clean revoked proxy objects from project cache
   * @param {Object} projectCache - Project cache object to clean
   */
  _cleanRevokedProxies(projectCache) {
    if (!projectCache || !projectCache.positions) {
      return;
    }

    let cleanedCount = 0;
    const cleanedPositions = new Map();

    // Iterate through all positions and clone any that might be proxies
    for (const [nodeId, position] of projectCache.positions.entries()) {
      try {
        // Attempt to access properties to detect revoked proxies
        const testAccess = position.x + position.y;
        if (isNaN(testAccess)) {
          throw new Error('Invalid position values');
        }
        
        // If we get here, position is valid - clone it to be safe
        const cleanedPosition = this._clonePosition(position);
        cleanedPositions.set(nodeId, cleanedPosition);
        
      } catch (error) {
        // This position is likely a revoked proxy or invalid
        console.warn(`[PositionService] Cleaning invalid position for ${nodeId}:`, error.message);
        
        // Use default position
        cleanedPositions.set(nodeId, { x: 100, y: 100 });
        cleanedCount++;
      }
    }

    // Replace the positions map with cleaned versions
    projectCache.positions = cleanedPositions;
    
    if (cleanedCount > 0) {
      console.log(`[PositionService] Cleaned ${cleanedCount} revoked proxy positions`);
    }
  }

  /**
   * Check if an object is likely an Immer proxy
   * @param {any} obj - Object to check
   * @returns {boolean} - True if likely a proxy object
   */
  _isProxy(obj) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    try {
      // Try to detect proxy characteristics
      // Immer proxies have specific internal symbols/properties
      const objString = Object.prototype.toString.call(obj);
      const isProxy = objString === '[object Object]' && 
                     obj.constructor === Object &&
                     Object.getOwnPropertySymbols(obj).length > 0;
      
      return isProxy;
    } catch (error) {
      // If we can't inspect the object, it might be a revoked proxy
      return true;
    }
  }

  /**
   * Debounced save to localStorage
   * @param {string} projectId - Project identifier
   */
  _debouncedSave(projectId) {
    const cacheKey = projectId || 'default';
    
    // Clear existing timer
    if (this.saveTimers.has(cacheKey)) {
      clearTimeout(this.saveTimers.get(cacheKey));
    }

    // Set new timer
    const timer = setTimeout(() => {
      this._saveToStorage(projectId);
      this.saveTimers.delete(cacheKey);
    }, this.SAVE_DEBOUNCE_MS);

    this.saveTimers.set(cacheKey, timer);
  }

  /**
   * Save project positions to localStorage
   * @param {string} projectId - Project identifier
   */
  _saveToStorage(projectId) {
    const cacheKey = projectId || 'default';
    const projectCache = this.cache.get(cacheKey);
    
    if (!projectCache || !projectCache.dirty) {
      return; // Nothing to save
    }

    try {
      const storageKey = this._getStorageKey(projectId);
      const data = {
        positions: Array.from(projectCache.positions.entries()),
        lastSaved: Date.now(),
        projectId: projectId
      };
      
      localStorage.setItem(storageKey, JSON.stringify(data));
      projectCache.dirty = false;
      
      const nodeIds = Array.from(projectCache.positions.keys());
      console.log(`[PositionService] Saved ${projectCache.positions.size} positions for project: ${cacheKey}`, { nodeIds });
    } catch (error) {
      console.error(`[PositionService] Error saving project ${cacheKey}:`, error);
      
      // If serialization failed due to proxy objects, attempt to clean the cache
      if (error.message && error.message.includes('proxy that has been revoked')) {
        console.log(`[PositionService] Attempting to clean revoked proxies for project: ${cacheKey}`);
        this._cleanRevokedProxies(projectCache);
        
        // Retry save with cleaned cache
        try {
          const cleanData = {
            positions: Array.from(projectCache.positions.entries()),
            lastSaved: Date.now(),
            projectId: projectId
          };
          
          localStorage.setItem(this._getStorageKey(projectId), JSON.stringify(cleanData));
          projectCache.dirty = false;
          
          console.log(`[PositionService] Successfully saved after cleaning proxies for project: ${cacheKey}`);
        } catch (retryError) {
          console.error(`[PositionService] Failed to save even after cleaning proxies for project ${cacheKey}:`, retryError);
        }
      }
    }
  }

  /**
   * Unload a project from memory cache (with optional save)
   * @param {string} projectId - Project identifier
   * @param {boolean} forceSave - Force save before unloading
   */
  unloadProject(projectId, forceSave = true) {
    const cacheKey = projectId || 'default';
    
    if (this.cache.has(cacheKey)) {
      // Save if dirty or forced
      if (forceSave) {
        this._saveToStorage(projectId);
      }
      
      // Clear save timer
      if (this.saveTimers.has(cacheKey)) {
        clearTimeout(this.saveTimers.get(cacheKey));
        this.saveTimers.delete(cacheKey);
      }
      
      // Remove from cache
      this.cache.delete(cacheKey);
      console.log(`[PositionService] Unloaded project: ${cacheKey}`);
    }
  }

  /**
   * Garbage collection - remove old unused projects from cache
   * Also cleans up old localStorage entries
   */
  garbageCollect() {
    const now = Date.now();
    let removedCount = 0;

    // Clean memory cache
    for (const [projectId, projectCache] of this.cache.entries()) {
      const age = now - projectCache.lastAccess;
      if (age > this.MAX_CACHE_AGE_MS) {
        this.unloadProject(projectId === 'default' ? null : projectId, true);
        removedCount++;
      }
    }

    // Clean localStorage (remove entries older than 7 days)
    const oldThreshold = now - (7 * 24 * 60 * 60 * 1000);
    let storageCleanedCount = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.lastSaved && parsed.lastSaved < oldThreshold) {
              localStorage.removeItem(key);
              storageCleanedCount++;
              i--; // Adjust index since we removed an item
            }
          }
        }
      }
    } catch (error) {
      console.error('[PositionService] Error during garbage collection:', error);
    }

    console.log(`[PositionService] Garbage collection completed: removed ${removedCount} cached projects, ${storageCleanedCount} old localStorage entries`);
    return { cacheRemoved: removedCount, storageRemoved: storageCleanedCount };
  }

  /**
   * Get service statistics
   * @returns {Object} - Service stats
   */
  getStats() {
    const stats = {
      cacheSize: this.cache.size,
      totalPositions: 0,
      projects: []
    };

    for (const [projectId, projectCache] of this.cache.entries()) {
      stats.totalPositions += projectCache.positions.size;
      stats.projects.push({
        id: projectId,
        positions: projectCache.positions.size,
        lastAccess: new Date(projectCache.lastAccess).toISOString(),
        dirty: projectCache.dirty
      });
    }

    return stats;
  }
}

// Singleton instance
const positionService = new PositionService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    console.log('[PositionService] Page unload - saving all dirty projects');
    for (const [projectId] of positionService.cache.entries()) {
      positionService._saveToStorage(projectId === 'default' ? null : projectId);
    }
  });
  
  // Periodic garbage collection
  setInterval(() => {
    positionService.garbageCollect();
  }, 5 * 60 * 1000); // Every 5 minutes
}

export default positionService;