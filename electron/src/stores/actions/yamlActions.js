import yaml from 'yaml';

/**
 * YAML-related actions for the simulation config store
 * Handles import, export, parsing, and validation
 */
export const createYamlActions = (set, get) => ({
  /**
   * Import YAML content from file or external source
   * @param {string} content - Raw YAML content
   */
  importYaml: async (content) => {
    console.log('[YamlActions] Starting YAML import');
    
    try {
      // Set importing state to prevent circular updates
      set((state) => {
        state.currentState = 'importing';
        state.isLoading = true;
        state.error = null;
      });

      // Parse and validate the imported content
      const doc = yaml.parseDocument(content);
      if (doc.errors && doc.errors.length > 0) {
        throw new Error(`YAML parsing error: ${doc.errors[0].message}`);
      }
      
      const parsedObj = doc.toJSON();
      
      // Validate this is simulation YAML
      if (!parsedObj?.event_simulation && !parsedObj?.simulation) {
        throw new Error('Invalid YAML: This appears to be database configuration, not simulation configuration');
      }

      // Extract canonical steps from parsed schema
      const canonicalSteps = [];
      if (parsedObj.event_simulation?.event_flows?.[0]?.steps) {
        canonicalSteps.push(...parsedObj.event_simulation.event_flows[0].steps);
      }

      // Update store state
      set((state) => {
        state.yamlContent = content;
        state.parsedSchema = parsedObj;
        state.flowSchema = parsedObj;
        state.canonicalSteps = canonicalSteps;
        state.currentState = 'idle';
        state.isLoading = false;
        state.error = null;
      });

      // Load simulation data from the parsed schema
      get().loadSimulationFromYaml(parsedObj);

      // Trigger visual state update
      get().updateVisualState();

      console.log('[YamlActions] YAML import completed successfully');
      return { success: true, message: 'Simulation configuration imported successfully' };
      
    } catch (error) {
      console.error('[YamlActions] YAML import failed:', error);
      
      set((state) => {
        state.currentState = 'idle';
        state.isLoading = false;
        state.error = error.message;
      });
      
      return { success: false, message: error.message };
    }
  },

  /**
   * Export current YAML content
   * @param {string} filename - Optional filename for export
   */
  exportYaml: (filename = 'simulation-config.yaml') => {
    const { yamlContent } = get();
    
    if (!yamlContent) {
      console.warn('[YamlActions] No content to export');
      return { success: false, message: 'No content to export' };
    }

    try {
      const blob = new Blob([yamlContent], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('[YamlActions] YAML exported successfully');
      return { success: true, message: 'Configuration exported successfully' };
    } catch (error) {
      console.error('[YamlActions] Export failed:', error);
      return { success: false, message: 'Export failed' };
    }
  },

  /**
   * Update YAML content and trigger parsing
   * @param {string} content - New YAML content
   */
  updateYamlContent: (content) => {
    console.log('[YamlActions] Updating YAML content');
    
    set((state) => {
      state.yamlContent = content;
    });

    // Parse the new content
    get().parseYaml();
  },

  /**
   * Parse current YAML content
   */
  parseYaml: () => {
    const { yamlContent } = get();
    
    if (!yamlContent) {
      set((state) => {
        state.parsedSchema = null;
        state.flowSchema = null;
        state.canonicalSteps = [];
        state.error = null;
      });
      return;
    }

    try {
      const doc = yaml.parseDocument(yamlContent);
      
      if (doc.errors && doc.errors.length > 0) {
        throw new Error(`YAML parsing error: ${doc.errors[0].message}`);
      }
      
      const parsedObj = doc.toJSON();
      
      // Extract canonical steps
      const canonicalSteps = [];
      if (parsedObj.event_simulation?.event_flows?.[0]?.steps) {
        canonicalSteps.push(...parsedObj.event_simulation.event_flows[0].steps);
      }

      set((state) => {
        state.parsedSchema = parsedObj;
        state.flowSchema = parsedObj;
        state.canonicalSteps = canonicalSteps;
        state.error = null;
      });

      // Load simulation data from the parsed schema
      get().loadSimulationFromYaml(parsedObj);

      console.log('[YamlActions] YAML parsed successfully');
    } catch (error) {
      console.error('[YamlActions] YAML parsing failed:', error);
      
      set((state) => {
        state.parsedSchema = null;
        state.flowSchema = null;
        state.canonicalSteps = [];
        state.error = error.message;
      });
    }
  },

  /**
   * Generate event flows from canonical steps based on Create modules
   * Each Create module starts a new flow
   * @param {Array} canonicalSteps - Array of step objects
   * @returns {Array} - Array of event flow objects
   */
  generateEventFlowsFromSteps: (canonicalSteps) => {
    if (!canonicalSteps || canonicalSteps.length === 0) {
      return [];
    }

    // Find all Create modules to determine flow structure
    const createModules = canonicalSteps.filter(step => step.step_type === 'create');
    
    if (createModules.length === 0) {
      // No Create modules - create a single flow for orphaned steps
      // This maintains backward compatibility
      return [{
        flow_id: 'main_flow',
        event_table: 'Event',
        steps: canonicalSteps.map(step => {
          const { position, ...stepWithoutPosition } = step;
          return stepWithoutPosition;
        })
      }];
    }

    // Generate flows based on Create modules
    const flows = [];
    let flowCounter = 1;

    createModules.forEach(createModule => {
      const flowId = `flow_${flowCounter}_${createModule.step_id}`;
      
      // Find all steps that belong to this flow
      // For now, simple approach: each Create module gets its own flow with all steps
      // TODO: Implement proper flow tracing logic
      const flowSteps = canonicalSteps.map(step => {
        const { position, ...stepWithoutPosition } = step;
        return stepWithoutPosition;
      });

      flows.push({
        flow_id: flowId,
        event_table: createModule.create_config?.entity_table || 'Event',
        steps: flowSteps
      });

      flowCounter++;
    });

    return flows;
  },

  /**
   * Generate YAML from current canonical steps
   */
  generateYaml: () => {
    const { canonicalSteps, flowSchema, simulationData } = get();
    
    try {
      if (canonicalSteps.length === 0) {
        // Return minimal structure with empty event_flows when no modules exist
        const emptySchema = {
          simulation: simulationData,
          event_simulation: {
            event_flows: []
          }
        };
        
        return yaml.stringify(emptySchema);
      }
      
      // Generate flows dynamically based on Create modules
      const generatedFlows = get().generateEventFlowsFromSteps(canonicalSteps);
      
      if (!flowSchema?.event_simulation?.event_flows?.[0]) {
        // Create new structure with dynamically generated flows
        const defaultSchema = {
          simulation: simulationData,
          event_simulation: {
            event_flows: generatedFlows
          }
        };
        
        return yaml.stringify(defaultSchema);
      }
      
      // Update existing schema with dynamically generated flows and simulation data
      const updatedSchema = {
        ...flowSchema,
        simulation: simulationData, // Always use current simulation data from store
        event_simulation: {
          ...flowSchema.event_simulation,
          event_flows: generatedFlows
        }
      };
      
      return yaml.stringify(updatedSchema);
    } catch (error) {
      console.error('[YamlActions] YAML generation failed:', error);
      return '';
    }
  },

  /**
   * Validate YAML content
   * @param {string} content - YAML content to validate
   */
  validateYaml: (content) => {
    try {
      const doc = yaml.parseDocument(content);
      
      if (doc.errors && doc.errors.length > 0) {
        return { valid: false, error: doc.errors[0].message };
      }
      
      const parsedObj = doc.toJSON();
      
      // Validate structure
      if (!parsedObj?.event_simulation && !parsedObj?.simulation) {
        return { valid: false, error: 'Invalid YAML: Missing simulation configuration structure' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
});