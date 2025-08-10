/**
 * DisplayNameService - Manages display name persistence for step configurations
 * 
 * Similar to PositionService, this service provides:
 * - Project-scoped display name storage in localStorage  
 * - Memory cache for performance
 * - Safe serialization and error handling
 * - Display name mapping: step_id → displayName
 */
export class DisplayNameService {
  constructor() {
    this.cache = new Map(); // Memory cache: projectId → displayNameMap
    this.STORAGE_PREFIX = 'db_simulator_display_names_';
  }

  /**
   * Get storage key for a project
   */
  _getStorageKey(projectId) {
    return `${this.STORAGE_PREFIX}${projectId}`;
  }

  /**
   * Load display names from localStorage with caching
   */
  loadDisplayNames(projectId) {
    if (!projectId) return {};

    // Return from cache if available
    if (this.cache.has(projectId)) {
      return this.cache.get(projectId);
    }

    try {
      const storageKey = this._getStorageKey(projectId);
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const displayNameMap = JSON.parse(stored);
        // Validate the structure
        if (typeof displayNameMap === 'object' && displayNameMap !== null) {
          // Cache the loaded data
          this.cache.set(projectId, displayNameMap);
          return displayNameMap;
        }
      }
    } catch (error) {
      console.warn('[DisplayNameService] Error loading display names:', error);
    }

    // Return empty object and cache it
    const emptyMap = {};
    this.cache.set(projectId, emptyMap);
    return emptyMap;
  }

  /**
   * Save display name for a specific step
   */
  saveDisplayName(projectId, stepId, displayName) {
    if (!projectId || !stepId) return;

    try {
      // Load current display name map
      const displayNameMap = this.loadDisplayNames(projectId);
      
      // Update with new display name
      displayNameMap[stepId] = displayName;
      
      // Update cache
      this.cache.set(projectId, displayNameMap);
      
      // Persist to localStorage
      this._saveToStorage(projectId, displayNameMap);
      
    } catch (error) {
      console.error('[DisplayNameService] Error saving display name:', error);
    }
  }

  /**
   * Save multiple display names at once
   */
  saveDisplayNames(projectId, displayNameMap) {
    if (!projectId || !displayNameMap) return;

    try {
      // Deep clone to prevent mutations
      const safeMap = JSON.parse(JSON.stringify(displayNameMap));
      
      // Update cache
      this.cache.set(projectId, safeMap);
      
      // Persist to localStorage
      this._saveToStorage(projectId, safeMap);
      
    } catch (error) {
      console.error('[DisplayNameService] Error saving display names:', error);
    }
  }

  /**
   * Get display name for a specific step
   */
  getDisplayName(projectId, stepId) {
    if (!projectId || !stepId) return null;

    const displayNameMap = this.loadDisplayNames(projectId);
    return displayNameMap[stepId] || null;
  }

  /**
   * Remove display name for a specific step
   */
  removeDisplayName(projectId, stepId) {
    if (!projectId || !stepId) return;

    try {
      const displayNameMap = this.loadDisplayNames(projectId);
      
      if (displayNameMap[stepId]) {
        delete displayNameMap[stepId];
        
        // Update cache
        this.cache.set(projectId, displayNameMap);
        
        // Persist to localStorage
        this._saveToStorage(projectId, displayNameMap);
      }
      
    } catch (error) {
      console.error('[DisplayNameService] Error removing display name:', error);
    }
  }

  /**
   * Clear all display names for a project
   */
  clearDisplayNames(projectId) {
    if (!projectId) return;

    try {
      // Clear from cache
      this.cache.delete(projectId);
      
      // Clear from localStorage
      const storageKey = this._getStorageKey(projectId);
      localStorage.removeItem(storageKey);
      
    } catch (error) {
      console.error('[DisplayNameService] Error clearing display names:', error);
    }
  }

  /**
   * Apply stored display names to canonical steps
   */
  applyDisplayNames(projectId, canonicalSteps) {
    if (!projectId || !Array.isArray(canonicalSteps)) {
      return canonicalSteps;
    }

    try {
      const displayNameMap = this.loadDisplayNames(projectId);
      
      // Apply display names to steps that don't already have them
      return canonicalSteps.map(step => {
        if (step.step_id && !step.displayName && displayNameMap[step.step_id]) {
          return {
            ...step,
            displayName: displayNameMap[step.step_id]
          };
        }
        return step;
      });
      
    } catch (error) {
      console.error('[DisplayNameService] Error applying display names:', error);
      return canonicalSteps;
    }
  }

  /**
   * Extract display names from canonical steps and store them
   */
  extractAndSaveDisplayNames(projectId, canonicalSteps) {
    if (!projectId || !Array.isArray(canonicalSteps)) return;

    try {
      const displayNameMap = {};
      
      canonicalSteps.forEach(step => {
        if (step.step_id && step.displayName) {
          displayNameMap[step.step_id] = step.displayName;
        }
      });
      
      if (Object.keys(displayNameMap).length > 0) {
        this.saveDisplayNames(projectId, displayNameMap);
      }
      
    } catch (error) {
      console.error('[DisplayNameService] Error extracting display names:', error);
    }
  }

  /**
   * Check if display name exists in cache
   */
  isInCache(projectId) {
    return this.cache.has(projectId);
  }

  /**
   * Get cache stats for debugging
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      cachedProjects: Array.from(this.cache.keys())
    };
  }

  /**
   * Safe serialization to localStorage with error handling
   */
  _saveToStorage(projectId, displayNameMap) {
    try {
      const storageKey = this._getStorageKey(projectId);
      
      // Validate data before saving
      if (typeof displayNameMap !== 'object' || displayNameMap === null) {
        console.warn('[DisplayNameService] Invalid display name map for storage');
        return;
      }

      // Check if data has proxy (Immer proxy detection)
      if (this._isProxy(displayNameMap)) {
        console.warn('[DisplayNameService] Proxy detected, cloning data');
        displayNameMap = JSON.parse(JSON.stringify(displayNameMap));
      }

      const serialized = JSON.stringify(displayNameMap);
      localStorage.setItem(storageKey, serialized);
      
    } catch (error) {
      console.error('[DisplayNameService] Failed to save to localStorage:', error);
      
      // Fallback: try with empty object
      try {
        const storageKey = this._getStorageKey(projectId);
        localStorage.setItem(storageKey, '{}');
      } catch (fallbackError) {
        console.error('[DisplayNameService] Fallback save also failed:', fallbackError);
      }
    }
  }

  /**
   * Utility method to detect proxies (similar to PositionService)
   */
  _isProxy(obj) {
    try {
      return obj && typeof obj === 'object' && obj.constructor?.name?.includes('Proxy');
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
export const displayNameService = new DisplayNameService();