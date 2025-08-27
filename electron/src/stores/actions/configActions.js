import positionService from '../../services/PositionService.js';

/**
 * Configuration-related actions for the simulation config store
 * Handles loading, saving, and managing configuration metadata
 */
export const createConfigActions = (set, get) => ({
  /**
   * Update configuration metadata
   * @param {Object} config - Configuration object
   */
  updateConfig: (config) => {
    
    set((state) => {
      state.config = config;
      state.name = config?.name || '';
      state.description = config?.description || '';
    });
  },

  /**
   * Update configuration name
   * @param {string} name - New name
   */
  updateName: (name) => {
    
    set((state) => {
      state.name = name;
    });
  },

  /**
   * Update configuration description
   * @param {string} description - New description
   */
  updateDescription: (description) => {
    
    set((state) => {
      state.description = description;
    });
  },

  /**
   * Load configuration from API
   * @param {string} configId - Configuration ID
   * @param {string} projectId - Optional project ID
   */
  loadConfig: async (configId, projectId = null) => {
    
    try {
      get().beginSave(); // Use save workflow for loading
      
      let result;
      
      if (projectId) {
        // Load project simulation config
        result = await window.api.getProjectSimConfig(projectId);
        
        if (result.success && result.config) {
          set((state) => {
            state.config = result.config;
            state.name = result.config.name || `${result.projectName} Simulation`;
            state.description = result.config.description || '';
            state.projectId = projectId;
            state.isProjectTab = true;
          });
          
          // Load positions for this project
          positionService.loadProject(projectId, 'simulation');
          
          // Load YAML content
          if (result.config.content) {
            await get().importYaml(result.config.content);
            // Note: Removed cleanupObsoletePositions() to prevent removing database entity positions
          }
        } else {
          // New simulation config for this project
          set((state) => {
            state.name = `${result.projectName || 'Project'} Simulation`;
            state.projectId = projectId;
            state.isProjectTab = true;
          });
          
          // Load positions for this project (even if no config yet)
          positionService.loadProject(projectId, 'simulation');
        }
      } else {
        // Load standalone config
        result = await window.api.getConfig(configId);
        
        if (result.success) {
          set((state) => {
            state.config = result.config;
            state.name = result.config.name;
            state.description = result.config.description || '';
            state.projectId = null;
            state.isProjectTab = false;
          });
          
          // Load positions for standalone config (using config ID as project ID)
          positionService.loadProject(`config_${configId}`, 'simulation');
          
          // Load YAML content
          if (result.config.content) {
            await get().importYaml(result.config.content);
            // Note: Removed cleanupObsoletePositions() to prevent removing database entity positions
          }
        }
      }
      
      get().completeSave(result?.success || false, result?.error || 'Config loaded successfully');
      return result;
      
    } catch (error) {
      console.error('[ConfigActions] Load config failed:', error);
      get().completeSave(false, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Save configuration to API
   * @param {boolean} saveAsNew - Whether to save as a new configuration
   */
  saveConfig: async (saveAsNew = false) => {
    const { config, projectId, isProjectTab, name, description, yamlContent } = get();
    
    
    try {
      get().beginSave();
      
      const configData = {
        name: name || 'Project Simulation',
        config_type: 'simulation',
        content: yamlContent,
        description
      };
      
      let result;
      
      if (projectId && isProjectTab) {
        // Save as project simulation config
        result = await window.api.saveProjectSimConfig(projectId, configData);
        
        if (result.success) {
          set((state) => {
            state.config = result.config;
          });
        }
      } else if (config && !saveAsNew) {
        // Update existing standalone configuration
        result = await window.api.updateConfig(config.id, configData);
        
      } else {
        // Save as new standalone configuration
        result = await window.api.saveConfig(configData);
        
        if (result.success) {
          set((state) => {
            state.config = { id: result.config_id, ...configData };
          });
        }
      }
      
      get().completeSave(result?.success || false, result?.error || 'Config saved successfully');
      return result;
      
    } catch (error) {
      console.error('[ConfigActions] Save config failed:', error);
      get().completeSave(false, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Run simulation with current configuration
   * @param {string} selectedDbConfig - Database configuration ID
   */
  runSimulation: async (selectedDbConfig) => {
    const { config, projectId } = get();
    
    
    try {
      get().beginSave();
      
      let simConfigId = config?.id;
      
      // Save configuration first if needed
      if (!simConfigId || projectId) {
        const saveResult = await get().saveConfig();
        
        if (!saveResult?.success) {
          get().completeSave(false, 'Failed to save configuration before running simulation');
          return saveResult;
        }
        
        simConfigId = saveResult.config_id || config?.id;
      }
      
      // Generate timestamped name for the database  
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dbName = `simulation_${timestamp}`;

      // Run the simulation
      const result = await window.api.generateAndSimulate({
        db_config_id: selectedDbConfig,
        sim_config_id: simConfigId,
        project_id: projectId,  // Add project ID for proper folder structure
        output_dir: 'output',   // Specify output directory
        name: dbName           // Add timestamped name
      });
      
      get().completeSave(result?.success || false, result?.error || 'Simulation completed');
      
      return result;
      
    } catch (error) {
      console.error('[ConfigActions] Run simulation failed:', error);
      get().completeSave(false, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Initialize configuration context
   * @param {Object} options - Initialization options
   */
  initializeConfig: (options = {}) => {
    const {
      projectId = null,
      isProjectTab = false,
      theme = 'light',
      dbConfigContent = null
    } = options;
    
    
    set((state) => {
      state.projectId = projectId;
      state.isProjectTab = isProjectTab;
      state.theme = theme;
      state.dbConfigContent = dbConfigContent;
      
      // Generate default YAML with simulation settings if YAML is empty
      if (!state.yamlContent) {
        console.log('[ConfigActions] Initializing with default YAML content');
        // Use setTimeout to ensure state is set before calling syncSimulationToYaml
        setTimeout(() => {
          get().syncSimulationToYaml();
        }, 0);
      }
    });
  },

  /**
   * Clean up obsolete positions from PositionService
   * Removes positions for nodes that no longer exist in the current configuration
   */
  cleanupObsoletePositions: () => {
    const { canonicalSteps, projectId } = get();
    
    if (!projectId) return; // No cleanup needed for standalone configs
    
    // Get current node IDs from canonical steps
    const currentNodeIds = new Set(canonicalSteps.map(step => step.step_id));
    
    // Get all stored positions for this project
    const allPositions = positionService.getAllPositions(projectId, 'simulation');
    
    // Remove positions for nodes that no longer exist
    let cleanedCount = 0;
    for (const nodeId of allPositions.keys()) {
      if (!currentNodeIds.has(nodeId)) {
        positionService.removePosition(projectId, nodeId, 'simulation');
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[ConfigActions] Cleaned up ${cleanedCount} obsolete node positions for project: ${projectId}`);
    }
  },

  /**
   * Clear all configuration state
   */
  clearConfig: () => {
    
    set((state) => {
      // Reset core data
      state.yamlContent = '';
      state.parsedSchema = null;
      state.canonicalSteps = [];
      state.flowSchema = null;
      
      // Reset visual state
      state.nodes = [];
      state.edges = [];
      
      // Reset UI state
      state.selectedNode = null;
      state.showEditModal = false;
      
      // Reset workflow state
      state.currentState = 'idle';
      state.isLoading = false;
      state.error = null;
      
      // Reset config metadata
      state.config = null;
      state.name = '';
      state.description = '';
      
      // Clear positions
      state.positions.clear();
    });
    
    // Clean up obsolete positions from PositionService
    get().cleanupObsoletePositions();
  },

  /**
   * Clean up orphaned positions after discarding changes
   * Removes positions for simulation steps that don't exist in the current saved configuration
   */
  cleanupOrphanedPositions: () => {
    const { canonicalSteps, projectId } = get();
    
    if (!projectId) return; // No cleanup needed for standalone configs
    
    // Get current step IDs from canonical steps (saved state)
    const validStepIds = new Set(canonicalSteps.map(step => step.step_id));
    
    // Get all stored positions for this project
    const allPositions = positionService.getAllPositions(projectId, 'simulation');
    
    // Remove positions for steps that no longer exist in saved config
    let cleanedCount = 0;
    for (const nodeId of allPositions.keys()) {
      const isStepPattern = nodeId.includes('_') || nodeId.includes('-');
      const isValidStep = validStepIds.has(nodeId);
      
      // Only clean up nodes that look like simulation steps (contain underscores or other patterns)
      // Skip nodes that look like simple entity names
      if (isStepPattern && !isValidStep) {
        positionService.removePosition(projectId, nodeId, 'simulation');
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[ConfigActions] Cleaned up ${cleanedCount} orphaned simulation step positions for project: ${projectId}`);
    }
  },

  /**
   * Check if the store has any content
   * @returns {boolean} - True if store has content
   */
  hasContent: () => {
    const state = get();
    return !!(state.yamlContent || state.canonicalSteps.length > 0 || state.config);
  }
});