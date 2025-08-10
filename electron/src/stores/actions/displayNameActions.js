import { displayNameService } from '../../services/DisplayNameService.js';

/**
 * Display name actions for the simulation config store
 * Manages frontend-only display name persistence using DisplayNameService
 */
export const createDisplayNameActions = (set, get) => ({
  /**
   * Save display name for a specific step
   * @param {string} stepId - The step ID
   * @param {string} displayName - The display name to save
   */
  saveDisplayName: (stepId, displayName) => {
    const { projectId } = get();
    if (projectId && stepId && displayName) {
      displayNameService.saveDisplayName(projectId, stepId, displayName);
    }
  },

  /**
   * Get display name for a specific step
   * @param {string} stepId - The step ID
   * @returns {string|null} - The stored display name or null
   */
  getDisplayName: (stepId) => {
    const { projectId } = get();
    if (projectId && stepId) {
      return displayNameService.getDisplayName(projectId, stepId);
    }
    return null;
  },

  /**
   * Apply stored display names to canonical steps
   * This is called during app initialization and after YAML import
   */
  applyStoredDisplayNames: () => {
    const { projectId, canonicalSteps } = get();
    if (projectId && canonicalSteps) {
      const updatedSteps = displayNameService.applyDisplayNames(projectId, canonicalSteps);
      
      set((state) => {
        state.canonicalSteps = updatedSteps;
      });
      
      // Trigger visual state update to refresh nodes
      get().updateVisualState();
    }
  },

  /**
   * Extract and save display names from current canonical steps
   * This is called when steps are updated to persist display names
   */
  persistDisplayNames: () => {
    const { projectId, canonicalSteps } = get();
    if (projectId && canonicalSteps) {
      displayNameService.extractAndSaveDisplayNames(projectId, canonicalSteps);
    }
  },

  /**
   * Save multiple display names at once
   * @param {Object} displayNameMap - Map of step_id → displayName
   */
  saveDisplayNames: (displayNameMap) => {
    const { projectId } = get();
    if (projectId && displayNameMap) {
      displayNameService.saveDisplayNames(projectId, displayNameMap);
    }
  },

  /**
   * Remove display name for a specific step
   * @param {string} stepId - The step ID
   */
  removeDisplayName: (stepId) => {
    const { projectId } = get();
    if (projectId && stepId) {
      displayNameService.removeDisplayName(projectId, stepId);
    }
  },

  /**
   * Clear all display names for the current project
   */
  clearDisplayNames: () => {
    const { projectId } = get();
    if (projectId) {
      displayNameService.clearDisplayNames(projectId);
    }
  },

  /**
   * Load display names for the current project
   * @returns {Object} - Map of step_id → displayName
   */
  loadDisplayNames: () => {
    const { projectId } = get();
    if (projectId) {
      return displayNameService.loadDisplayNames(projectId);
    }
    return {};
  }
});