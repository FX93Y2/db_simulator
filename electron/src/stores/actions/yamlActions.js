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

      // Extract canonical steps from parsed schema - collect from ALL flows
      // Also migrate legacy create_config.event_table to _eventTable
      const canonicalSteps = [];
      if (parsedObj.event_simulation?.event_flows) {
        parsedObj.event_simulation.event_flows.forEach(flow => {
          if (flow.steps) {
            flow.steps.forEach(step => {
              if (step.step_type === 'create') {
                // Migrate legacy per-step event_table
                if (step.create_config?.event_table) {
                  step._eventTable = step.create_config.event_table;
                  delete step.create_config.event_table;
                }
                // Also inherit flow-level event_table if present
                if (!step._eventTable && flow.event_table) {
                  step._eventTable = flow.event_table;
                }
              }
              canonicalSteps.push(step);
            });
          }
        });
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

      // Note: Removed cleanupObsoletePositions() to prevent removing database entity positions

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
      
      // Extract canonical steps - collect from ALL flows
      const canonicalSteps = [];
      if (parsedObj.event_simulation?.event_flows) {
        parsedObj.event_simulation.event_flows.forEach(flow => {
          if (flow.steps) {
            flow.steps.forEach(step => {
              // Migrate legacy per-step event_table and inherit flow-level event_table
              if (step.step_type === 'create') {
                if (step.create_config?.event_table) {
                  step._eventTable = step.create_config.event_table;
                  delete step.create_config.event_table;
                }
                if (!step._eventTable && flow.event_table) {
                  step._eventTable = flow.event_table;
                }
              }
              canonicalSteps.push(step);
            });
          }
        });
      }

      set((state) => {
        state.parsedSchema = parsedObj;
        state.flowSchema = parsedObj;
        state.canonicalSteps = canonicalSteps;
        state.error = null;
      });

      // Load simulation data from the parsed schema
      get().loadSimulationFromYaml(parsedObj);

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
   * Update only parsedSchema without modifying canonicalSteps
   * Used when canvas is source of truth and we only need to refresh parsedSchema
   */
  updateParsedSchemaOnly: () => {
    const { yamlContent } = get();
    
    if (!yamlContent) {
      set((state) => {
        state.parsedSchema = null;
        state.flowSchema = null;
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

      set((state) => {
        state.parsedSchema = parsedObj;
        state.flowSchema = parsedObj;
        state.error = null;
        // NOTE: canonicalSteps is NOT modified - canvas remains source of truth
      });

      // Load simulation data from the parsed schema
      get().loadSimulationFromYaml(parsedObj);

    } catch (error) {
      console.error('[YamlActions] YAML parsing failed:', error);
      
      set((state) => {
        state.parsedSchema = null;
        state.flowSchema = null;
        state.error = error.message;
        // NOTE: canonicalSteps is NOT cleared - preserve canvas state
      });
    }
  },

  /**
   * Trace flow from a Create module following connections
   * @param {Object} startingCreate - The Create module to start from
   * @param {Array} allSteps - All available canonical steps
   * @returns {Array} - Array of connected step objects in flow order
   */
  traceFlowFromCreate: (startingCreate, allSteps) => {
    const visited = new Set();
    const flowSteps = [];
    
    /**
     * Helper function to clean step object and remove canvas/frontend-only properties
     * Also handles SQL expression formatting for backend compatibility
     */
    const cleanStep = (step) => {
      const { position, displayName, ...stepWithoutFrontendProps } = step;
      
      // No debug logging in production
      
      // Deep clone first to avoid modifying read-only objects
      const cleanedStep = JSON.parse(JSON.stringify(stepWithoutFrontendProps));
      
      // Handle conditions for decide steps - just clean up empty values
      if (cleanedStep.step_type === 'decide' && cleanedStep.decide_config?.outcomes) {
        cleanedStep.decide_config.outcomes = cleanedStep.decide_config.outcomes.map((outcome, outcomeIndex) => {
          if (outcome.conditions && outcome.conditions.length > 0) {
            // Process conditions within each outcome - clean up empty values
            outcome.conditions = outcome.conditions.map((condition, conditionIndex) => {
              // Clean up empty values but preserve the structure
              const cleanCondition = {};
              Object.keys(condition).forEach(key => {
                if (condition[key] !== '' && condition[key] !== undefined) {
                  cleanCondition[key] = condition[key];
                }
              });
              return cleanCondition;
            });
          }
          
          // Clean up outcome level - remove any frontend-only fields
          const { sqlExpression, ...cleanOutcome } = outcome;
          return cleanOutcome;
        });
      }
      
      // Handle SQL expressions for assign steps
      if (cleanedStep.step_type === 'assign' && cleanedStep.assign_config?.assignments) {
        cleanedStep.assign_config.assignments = cleanedStep.assign_config.assignments.map(assignment => {
          if (assignment.assignment_type === 'sql') {
            // For SQL assignments, keep expression field and remove value field
            const cleanAssignment = {};
            Object.keys(assignment).forEach(key => {
              if (key !== 'value' && assignment[key] !== '' && assignment[key] !== undefined) {
                cleanAssignment[key] = assignment[key];
              }
            });
            return cleanAssignment;
          }
          // For non-SQL assignments, remove expression field and clean empty values
          const cleanAssignment = {};
          Object.keys(assignment).forEach(key => {
            if (key !== 'expression' && assignment[key] !== '' && assignment[key] !== undefined) {
              cleanAssignment[key] = assignment[key];
            }
          });
          return cleanAssignment;
        });
      }
      
      // Remove internal _eventTable field (used for flow-level event_table generation)
      delete cleanedStep._eventTable;
      
      return cleanedStep;
    };
    
    /**
     * Recursive function to trace connections
     */
    const traceFrom = (currentStep) => {
      if (!currentStep || visited.has(currentStep.step_id)) {
        return; // Prevent cycles and null steps
      }
      
      visited.add(currentStep.step_id);
      flowSteps.push(cleanStep(currentStep));
      
      // Follow next_steps connections
      if (currentStep.next_steps && Array.isArray(currentStep.next_steps)) {
        currentStep.next_steps.forEach(nextStepId => {
          if (nextStepId && nextStepId.trim() !== '') {
            const nextStep = allSteps.find(s => s.step_id === nextStepId);
            if (nextStep) {
              traceFrom(nextStep);
            }
          }
        });
      }
      
      // Handle decision nodes - follow all outcome paths
      if (currentStep.step_type === 'decide' && currentStep.decide_config?.outcomes) {
        currentStep.decide_config.outcomes.forEach(outcome => {
          if (outcome.next_step_id && outcome.next_step_id.trim() !== '') {
            const nextStep = allSteps.find(s => s.step_id === outcome.next_step_id);
            if (nextStep) {
              traceFrom(nextStep);
            }
          }
        });
      }
    };
    
    // Start tracing from the Create module
    traceFrom(startingCreate);
    return flowSteps;
  },

  /**
   * Find the event table that corresponds to an entity table
   * @param {string} entityTable - Name of the entity table
   * @param {Object} dbConfig - Database configuration object
   * @returns {string|null} - Event table name or null if not found
   */
  findEventTableForEntity: (entityTable, dbConfig) => {
    if (!dbConfig || !dbConfig.entities || !entityTable) {
      return null;
    }

    // Find an event table that has an entity_id attribute referencing the entity table
    const eventTable = dbConfig.entities.find(entity => {
      if (entity.type !== 'event') return false;
      
      return entity.attributes.some(attr => 
        attr.type === 'entity_id' && 
        attr.ref === `${entityTable}.id`
      );
    });

    return eventTable ? eventTable.name : null;
  },

  /**
   * Generate event flows from canonical steps based on Create modules
   * Each Create module starts a new flow with only connected steps
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
      // No Create modules - return empty flows
      // Unconnected steps won't appear in YAML (design workspace vs executable config)
      return [];
    }

    // Generate flows based on Create modules using flow tracing
    const flows = [];
    let flowCounter = 1;
    
    // Get database config from store to map entity tables to event tables
    const { dbConfigContent } = get();
    let parsedDbConfig = null;
    
    // Parse database config if available
    if (dbConfigContent) {
      try {
        const yaml = require('yaml');
        parsedDbConfig = yaml.parse(dbConfigContent);
      } catch (error) {
        console.warn('[YamlActions] Failed to parse database config:', error);
      }
    }

    createModules.forEach(createModule => {
      const flowId = `flow_${flowCounter}_${createModule.step_id}`;
      
      // Trace connected steps from this Create module
      const connectedSteps = get().traceFlowFromCreate(createModule, canonicalSteps);
      
      // Only create flow if there are connected steps
      if (connectedSteps.length > 0) {
        // Use event_table from stepConfig or derive from DB config; no legacy fallback
        const stepEventTable = createModule._eventTable;
        const entityTable = createModule.create_config?.entity_table;
        const eventTable = stepEventTable || get().findEventTableForEntity(entityTable, parsedDbConfig);
        
        flows.push({
          flow_id: flowId,
          event_table: eventTable || '',
          steps: connectedSteps
        });
      }

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
