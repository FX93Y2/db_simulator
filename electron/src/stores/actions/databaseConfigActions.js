/**
 * Database configuration actions for the database config store
 * Handles loading, saving, and managing database configurations
 * Similar to configActions.js in simulationConfigStore
 */
export const createDatabaseConfigActions = (set, get) => ({
  /**
   * Load database configuration from backend
   * @param {string} configId - Optional config ID for direct loading
   * @param {string} projectId - Optional project ID for project-scoped loading
   */
  loadDatabaseConfig: async (configId = null, projectId = null) => {
    try {
      set((state) => {
        state.currentState = 'loading';
        state.isLoading = true;
        state.error = null;
      });

      let result;
      
      if (configId) {
        // Load by config ID (legacy support)
        result = await window.api.getConfig(configId);
      } else if (projectId) {
        // Load by project ID (preferred method)
        result = await window.api.getProjectDbConfig(projectId);
      } else {
        throw new Error('Either configId or projectId must be provided');
      }

      if (result && result.success && result.config) {
        const config = result.config;
        
        // Update store with loaded configuration
        set((state) => {
          state.config = config;
          state.name = config.name || 'Database Configuration';
          state.description = config.description || '';
          state.yamlContent = config.content || '';
          state.parsedSchema = null;
          state.currentState = 'idle';
          state.isLoading = false;
        });

        // If there's YAML content, load entities into the store
        if (config.content && config.content.trim()) {
          try {
            const importResult = await get().importEntityYaml(config.content);
            console.log(`[DatabaseConfigActions] Loaded entities from config:`, importResult);
          } catch (error) {
            console.warn(`[DatabaseConfigActions] Failed to load entities:`, error.message);
            // Clear entities if YAML parsing fails
            get().clearEntities();
          }
        } else {
          // Clear entities for empty configuration
          get().clearEntities();
        }
      } else {
        // No configuration found or error loading
        set((state) => {
          state.config = null;
          state.name = projectId ? 'Project Database Configuration' : 'New Database Configuration';
          state.description = '';
          state.yamlContent = '';
          state.parsedSchema = null;
          state.currentState = 'idle';
          state.isLoading = false;
        });
        
        // Clear entities for new/empty configuration
        get().clearEntities();
      }

    } catch (error) {
      console.error('[DatabaseConfigActions] Error loading configuration:', error);
      
      set((state) => {
        state.currentState = 'idle';
        state.isLoading = false;
        state.error = error.message;
      });
      
      // Clear entities on error
      get().clearEntities();
    }
  },

  /**
   * Save database configuration to backend
   * @param {Object} configData - Configuration data to save
   */
  saveDatabaseConfig: async (configData) => {
    try {
      set((state) => {
        state.currentState = 'saving';
        state.isLoading = true;
        state.error = null;
      });

      const { config, projectId } = get();

      // Generate current YAML content from entities
      const yamlContent = get().generateEntityYaml();
      
      const dataToSave = {
        ...configData,
        content: yamlContent,
        config_type: 'database'
      };

      let result;

      if (projectId && configData.project_id) {
        // Save in project context
        result = await window.api.saveProjectDbConfig(projectId, dataToSave);
      } else if (config && !configData.saveAsNew) {
        // Update existing configuration
        result = await window.api.updateConfig(config.id, dataToSave);
      } else {
        // Save as new configuration
        result = await window.api.saveConfig(dataToSave);
      }

      if (result && result.success) {
        // Update store with saved configuration
        set((state) => {
          state.config = result.config || config;
          state.name = dataToSave.name;
          state.description = dataToSave.description || '';
          state.yamlContent = yamlContent;
          state.currentState = 'idle';
          state.isLoading = false;
        });

        return { success: true, config: result.config };
      } else {
        throw new Error(result.error || 'Failed to save configuration');
      }

    } catch (error) {
      console.error('[DatabaseConfigActions] Error saving configuration:', error);
      
      set((state) => {
        state.currentState = 'idle';
        state.isLoading = false;
        state.error = error.message;
      });

      throw error;
    }
  },

  /**
   * Initialize database configuration context
   * @param {Object} context - Configuration context
   */
  initializeDatabaseConfig: (context) => {
    const { projectId, isProjectTab, theme, onConfigChange } = context;
    
    set((state) => {
      state.projectId = projectId;
      state.isProjectTab = isProjectTab || false;
      state.theme = theme || 'light';
      state.onEntityDiagramChange = onConfigChange;
      state.currentState = 'idle';
      state.isLoading = false;
      state.error = null;
    });

    console.log(`[DatabaseConfigActions] Initialized context for project: ${projectId}`);
  },

  /**
   * Update configuration metadata
   * @param {Object} metadata - Name, description, etc.
   */
  updateConfigMetadata: (metadata) => {
    set((state) => {
      if (metadata.name !== undefined) state.name = metadata.name;
      if (metadata.description !== undefined) state.description = metadata.description;
    });
  },

  /**
   * Clear configuration state
   */
  clearDatabaseConfig: () => {
    set((state) => {
      state.config = null;
      state.name = '';
      state.description = '';
      state.yamlContent = '';
      state.parsedSchema = null;
      state.currentState = 'idle';
      state.isLoading = false;
      state.error = null;
    });
    
    // Also clear entities
    get().clearEntities();
  },

  /**
   * Get current YAML content (generated from entities)
   */
  getCurrentYamlContent: () => {
    return get().generateEntityYaml();
  },

  /**
   * Update YAML content and notify parent
   */
  updateYamlAndNotify: () => {
    const yamlContent = get().generateEntityYaml();
    
    set((state) => {
      state.yamlContent = yamlContent;
    });

    // Parent notification is handled by useConfigurationLoader's useEffect
    // No need for direct callback here to avoid double execution
  },

  /**
   * Check if the store has any content
   * @returns {boolean} - True if store has content
   */
  hasContent: () => {
    const state = get();
    return !!(state.yamlContent || state.canonicalEntities.length > 0 || state.config);
  }
});