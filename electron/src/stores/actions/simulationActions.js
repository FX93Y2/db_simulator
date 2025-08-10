/**
 * Simulation-related actions for the simulation config store
 * Handles simulation settings with Save & Apply UX pattern
 */
export const createSimulationActions = (set, get) => ({
  /**
   * Update a simulation field (in memory only)
   * @param {string} field - Field name (duration_days, start_date, random_seed)
   * @param {any} value - New value
   */
  updateSimulationField: (field, value) => {
    
    set((state) => {
      // Update pending changes
      state.pendingSimulationChanges[field] = value;
      
      // Check if we have any unsaved changes
      const hasChanges = Object.keys(state.pendingSimulationChanges).length > 0;
      state.hasUnsavedSimulation = hasChanges;
      
    });
  },

  /**
   * Apply pending simulation changes and regenerate YAML
   */
  applySimulationChanges: () => {
    
    const { pendingSimulationChanges } = get();
    
    if (Object.keys(pendingSimulationChanges).length === 0) {
      
      // Even with no pending changes, regenerate YAML with current simulation data
      // This is useful for fresh projects where user wants to apply default settings
      get().syncSimulationToYaml();
      
      return { success: true, message: 'Current simulation settings applied to YAML' };
    }

    set((state) => {
      // Apply pending changes to simulationData
      Object.keys(pendingSimulationChanges).forEach(field => {
        state.simulationData[field] = pendingSimulationChanges[field];
      });
      
      // Clear pending changes
      state.pendingSimulationChanges = {};
      state.hasUnsavedSimulation = false;
      
    });

    // Regenerate YAML with new simulation data
    get().syncSimulationToYaml();
    
    return { success: true, message: 'Simulation settings applied successfully' };
  },

  /**
   * Reset pending simulation changes (discard unsaved changes)
   */
  resetSimulationChanges: () => {
    
    set((state) => {
      state.pendingSimulationChanges = {};
      state.hasUnsavedSimulation = false;
    });
    
    return { success: true, message: 'Changes discarded' };
  },

  /**
   * Load simulation data from parsed YAML
   * @param {Object} parsedSchema - Parsed YAML object
   */
  loadSimulationFromYaml: (parsedSchema) => {
    
    if (!parsedSchema?.simulation) {
      return;
    }

    set((state) => {
      // Update simulation data from YAML
      state.simulationData = {
        duration_days: parsedSchema.simulation.duration_days || 30,
        start_date: parsedSchema.simulation.start_date || '2024-01-01', 
        random_seed: parsedSchema.simulation.random_seed || 42
      };
      
      // Clear any pending changes since we're loading from source
      state.pendingSimulationChanges = {};
      state.hasUnsavedSimulation = false;
      
    });
  },

  /**
   * Get current effective simulation values (applying pending changes)
   * @returns {Object} - Effective simulation data with pending changes applied
   */
  getEffectiveSimulationData: () => {
    const { simulationData, pendingSimulationChanges } = get();
    
    return {
      ...simulationData,
      ...pendingSimulationChanges
    };
  },

  /**
   * Sync current simulation data to YAML (regenerate YAML with current simulation settings)
   */
  syncSimulationToYaml: () => {
    
    // Use the existing generateYaml method which will now include simulation data
    const generatedYaml = get().generateYaml();
    
    set((state) => {
      state.yamlContent = generatedYaml;
    });
    
    // Parse the updated YAML to update parsedSchema and flowSchema
    get().parseYaml();
    
  },

  /**
   * Check if a specific field has pending changes
   * @param {string} field - Field name to check
   * @returns {boolean} - True if field has pending changes
   */
  hasFieldPendingChanges: (field) => {
    const { pendingSimulationChanges } = get();
    return pendingSimulationChanges.hasOwnProperty(field);
  },

  /**
   * Get the pending value for a field (or current value if no pending change)
   * @param {string} field - Field name
   * @returns {any} - Field value (pending or current)
   */
  getFieldValue: (field) => {
    const { simulationData, pendingSimulationChanges } = get();
    
    return pendingSimulationChanges.hasOwnProperty(field) 
      ? pendingSimulationChanges[field]
      : simulationData[field];
  }
});