/**
 * Viewport Service for ReactFlow canvas viewport persistence
 * Provides viewport state persistence with project and tab isolation
 * 
 * Success Criteria:
 * - Tab-specific: Different zoom levels per tab (database/simulation) ✓
 * - Project-scoped: Reset to default on project switch ✓
 * - Persistent: Survives tab refresh ✓
 * - Performance: Debounced saves ✓
 */

class ViewportService {
  constructor() {
    // Memory cache: projectId -> { database: viewport, simulation: viewport }
    this.cache = new Map();
    
    // Debounce timers for saving to localStorage
    this.saveTimers = new Map();
    
    // Configuration
    this.SAVE_DEBOUNCE_MS = 500; // Viewport changes happen frequently
    this.STORAGE_PREFIX = 'viewport_';
    this.DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.6 }; // 60% zoom as requested
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
   * Load project viewports into memory cache from localStorage
   * @param {string} projectId - Project identifier
   */
  loadProject(projectId) {
    const cacheKey = projectId || 'default';
    try {
      const storageKey = this._getStorageKey(projectId);
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        const viewports = {
          database: parsed.database || { ...this.DEFAULT_VIEWPORT },
          simulation: parsed.simulation || { ...this.DEFAULT_VIEWPORT }
        };
        
        this.cache.set(cacheKey, {
          viewports,
          lastAccess: Date.now(),
          dirty: false
        });
      } else {
        // Initialize with default viewports
        const defaultViewports = {
          database: { ...this.DEFAULT_VIEWPORT },
          simulation: { ...this.DEFAULT_VIEWPORT }
        };
        
        this.cache.set(cacheKey, {
          viewports: defaultViewports,
          lastAccess: Date.now(),
          dirty: false
        });
      }
    } catch (error) {
      console.error(`[ViewportService] Error loading project ${cacheKey}:`, error);
      // Initialize with defaults on error
      this.cache.set(cacheKey, {
        viewports: {
          database: { ...this.DEFAULT_VIEWPORT },
          simulation: { ...this.DEFAULT_VIEWPORT }
        },
        lastAccess: Date.now(),
        dirty: false
      });
    }
  }

  /**
   * Get viewport for a specific tab
   * @param {string} projectId - Project identifier
   * @param {string} tab - Tab name ('database' or 'simulation')
   * @returns {Object} - Viewport {x, y, zoom}
   */
  getViewport(projectId, tab) {
    const cacheKey = projectId || 'default';
    
    // Ensure project is loaded
    if (!this.cache.has(cacheKey)) {
      this.loadProject(projectId);
    }

    const projectCache = this.cache.get(cacheKey);
    if (projectCache) {
      projectCache.lastAccess = Date.now();
      const viewport = projectCache.viewports[tab];
      
      if (viewport) {
        // Clone to prevent mutations
        return { ...viewport };
      }
    }

    // Return default if not found
    return { ...this.DEFAULT_VIEWPORT };
  }

  /**
   * Set viewport for a specific tab
   * @param {string} projectId - Project identifier
   * @param {string} tab - Tab name ('database' or 'simulation')
   * @param {Object} viewport - Viewport {x, y, zoom}
   */
  setViewport(projectId, tab, viewport) {
    const cacheKey = projectId || 'default';
    
    // Ensure project is loaded
    if (!this.cache.has(cacheKey)) {
      this.loadProject(projectId);
    }

    const projectCache = this.cache.get(cacheKey);
    if (projectCache) {
      // Validate and sanitize viewport data
      const safeViewport = this._sanitizeViewport(viewport);
      
      projectCache.viewports[tab] = safeViewport;
      projectCache.lastAccess = Date.now();
      projectCache.dirty = true;
      
      // Debounced save to localStorage
      this._debouncedSave(projectId);
    }
  }

  /**
   * Reset viewport to default for a specific tab
   * @param {string} projectId - Project identifier
   * @param {string} tab - Tab name ('database' or 'simulation') or null for both
   */
  resetViewport(projectId, tab = null) {
    const cacheKey = projectId || 'default';
    
    // Ensure project is loaded
    if (!this.cache.has(cacheKey)) {
      this.loadProject(projectId);
    }

    const projectCache = this.cache.get(cacheKey);
    if (projectCache) {
      if (tab) {
        // Reset specific tab
        projectCache.viewports[tab] = { ...this.DEFAULT_VIEWPORT };
      } else {
        // Reset both tabs
        projectCache.viewports.database = { ...this.DEFAULT_VIEWPORT };
        projectCache.viewports.simulation = { ...this.DEFAULT_VIEWPORT };
      }
      
      projectCache.lastAccess = Date.now();
      projectCache.dirty = true;
      
      // Debounced save to localStorage
      this._debouncedSave(projectId);
    }
  }

  /**
   * Initialize viewport for a new project (sets both tabs to 60% zoom)
   * @param {string} projectId - Project identifier
   */
  initializeProject(projectId) {
    const cacheKey = projectId || 'default';
    
    // Check if project already exists in localStorage
    const storageKey = this._getStorageKey(projectId);
    const existingData = localStorage.getItem(storageKey);
    
    if (!existingData) {
      // New project - initialize with default viewports
      this.resetViewport(projectId, null); // Reset both tabs to default
    } else {
      // Existing project - load normally
      this.loadProject(projectId);
    }
  }

  /**
   * Sanitize viewport object
   * @param {Object} viewport - Viewport to sanitize
   * @returns {Object} - Safe viewport object
   */
  _sanitizeViewport(viewport) {
    if (!viewport || typeof viewport !== 'object') {
      console.warn('[ViewportService] Invalid viewport object:', viewport);
      return { ...this.DEFAULT_VIEWPORT };
    }

    try {
      const safeViewport = {
        x: Number(viewport.x) || 0,
        y: Number(viewport.y) || 0,
        zoom: Number(viewport.zoom) || this.DEFAULT_VIEWPORT.zoom
      };

      // Validate zoom bounds (prevent extreme values)
      safeViewport.zoom = Math.max(0.1, Math.min(3.0, safeViewport.zoom));

      // Validate position bounds (prevent extreme values)
      safeViewport.x = Math.max(-10000, Math.min(10000, safeViewport.x));
      safeViewport.y = Math.max(-10000, Math.min(10000, safeViewport.y));

      return safeViewport;
      
    } catch (error) {
      console.warn('[ViewportService] Failed to sanitize viewport, using defaults:', error.message);
      return { ...this.DEFAULT_VIEWPORT };
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
   * Save project viewports to localStorage
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
        database: projectCache.viewports.database,
        simulation: projectCache.viewports.simulation,
        lastSaved: Date.now(),
        projectId: projectId
      };
      
      localStorage.setItem(storageKey, JSON.stringify(data));
      projectCache.dirty = false;
    } catch (error) {
      console.error(`[ViewportService] Error saving project ${cacheKey}:`, error);
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
    }
  }

  /**
   * Get service statistics
   * @returns {Object} - Service stats
   */
  getStats() {
    const stats = {
      cacheSize: this.cache.size,
      projects: []
    };

    for (const [projectId, projectCache] of this.cache.entries()) {
      stats.projects.push({
        id: projectId,
        viewports: projectCache.viewports,
        lastAccess: new Date(projectCache.lastAccess).toISOString(),
        dirty: projectCache.dirty
      });
    }

    return stats;
  }
}

// Singleton instance
const viewportService = new ViewportService();

// Track current project to detect project switches
let currentProjectId = null;

// Helper function to handle project switches
viewportService.handleProjectSwitch = function(newProjectId) {
  const newCacheKey = newProjectId || 'default';
  
  if (currentProjectId !== newCacheKey) {
    // Initialize the new project (this will set 60% zoom for new projects)
    this.initializeProject(newProjectId);
    
    currentProjectId = newCacheKey;
  }
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const [projectId] of viewportService.cache.entries()) {
      viewportService._saveToStorage(projectId === 'default' ? null : projectId);
    }
  });
}

export default viewportService;