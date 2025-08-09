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
    console.log('[SimulationActions] Updating simulation field:', field, '=', value);
    
    set((state) => {
      // Update pending changes
      state.pendingSimulationChanges[field] = value;
      
      // Check if we have any unsaved changes
      const hasChanges = Object.keys(state.pendingSimulationChanges).length > 0;
      state.hasUnsavedSimulation = hasChanges;
      
      console.log('[SimulationActions] Pending changes:', state.pendingSimulationChanges);
    });
  },

  /**
   * Apply pending simulation changes and regenerate YAML
   */
  applySimulationChanges: () => {
    console.log('[SimulationActions] Applying simulation changes');
    
    const { pendingSimulationChanges } = get();
    
    if (Object.keys(pendingSimulationChanges).length === 0) {
      console.log('[SimulationActions] No pending changes to apply');
      return { success: true, message: 'No changes to apply' };
    }

    set((state) => {
      // Apply pending changes to simulationData
      Object.keys(pendingSimulationChanges).forEach(field => {
        state.simulationData[field] = pendingSimulationChanges[field];
      });
      
      // Clear pending changes
      state.pendingSimulationChanges = {};
      state.hasUnsavedSimulation = false;
      
      console.log('[SimulationActions] Applied changes. New simulation data:', state.simulationData);
    });

    // Regenerate YAML with new simulation data
    get().syncSimulationToYaml();
    
    return { success: true, message: 'Simulation settings applied successfully' };
  },

  /**
   * Reset pending simulation changes (discard unsaved changes)
   */
  resetSimulationChanges: () => {
    console.log('[SimulationActions] Resetting pending simulation changes');
    
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
    console.log('[SimulationActions] Loading simulation data from YAML');
    
    if (!parsedSchema?.simulation) {
      console.log('[SimulationActions] No simulation section found in YAML');
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
      
      console.log('[SimulationActions] Loaded simulation data:', state.simulationData);
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
    console.log('[SimulationActions] Syncing simulation data to YAML');
    
    // Use the existing generateYaml method which will now include simulation data
    const generatedYaml = get().generateYaml();
    
    set((state) => {
      state.yamlContent = generatedYaml;
    });
    
    console.log('[SimulationActions] YAML updated with simulation data');
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