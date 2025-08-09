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
    console.log('[ConfigActions] Updating config:', config?.name);
    
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
    console.log('[ConfigActions] Updating name:', name);
    
    set((state) => {
      state.name = name;
    });
  },

  /**
   * Update configuration description
   * @param {string} description - New description
   */
  updateDescription: (description) => {
    console.log('[ConfigActions] Updating description');
    
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
    console.log('[ConfigActions] Loading config:', configId, 'for project:', projectId);
    
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
          positionService.loadProject(projectId);
          
          // Load YAML content
          if (result.config.content) {
            await get().importYaml(result.config.content);
          }
        } else {
          // New simulation config for this project
          set((state) => {
            state.name = `${result.projectName || 'Project'} Simulation`;
            state.projectId = projectId;
            state.isProjectTab = true;
          });
          
          // Load positions for this project (even if no config yet)
          positionService.loadProject(projectId);
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
          positionService.loadProject(`config_${configId}`);
          
          // Load YAML content
          if (result.config.content) {
            await get().importYaml(result.config.content);
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
    
    console.log('[ConfigActions] Saving config:', name, 'saveAsNew:', saveAsNew);
    
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
    const { config, projectId, name, description, yamlContent } = get();
    
    console.log('[ConfigActions] Running simulation with DB config:', selectedDbConfig);
    
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
      
      // Run the simulation
      const result = await window.api.generateAndSimulate({
        db_config_id: selectedDbConfig,
        sim_config_id: simConfigId
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
    
    console.log('[ConfigActions] Initializing config with options:', options);
    
    set((state) => {
      state.projectId = projectId;
      state.isProjectTab = isProjectTab;
      state.theme = theme;
      state.dbConfigContent = dbConfigContent;
      
      // Set default YAML if empty
      if (!state.yamlContent) {
        state.yamlContent = `simulation:
  duration_days: 30

event_simulation:
  event_flows:
    - flow_id: main_flow
      event_table: Event
      steps: []`;
      }
    });
  },

  /**
   * Clear all configuration state
   */
  clearConfig: () => {
    console.log('[ConfigActions] Clearing all config state');
    
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
  }
});