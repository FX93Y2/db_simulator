/**
 * Custom hook for common step helper functions used across step editors
 * Uses step_id as the display name directly (single naming system)
 */

export const useStepHelpers = (parsedSchema) => {
  // Get all existing step IDs from all flows for duplicate validation
  const getAllExistingStepIds = () => {
    if (!parsedSchema?.event_simulation?.event_flows) return [];
    
    const allStepIds = [];
    parsedSchema.event_simulation.event_flows.forEach(flow => {
      if (flow.steps) {
        flow.steps.forEach(step => {
          if (step.step_id) {
            allStepIds.push(step.step_id);
          }
        });
      }
    });
    
    return allStepIds;
  };

  // Validate that step_id is unique and valid
  const validateStepId = (stepId, currentStepId = null) => {
    if (!stepId || typeof stepId !== 'string') {
      return { valid: false, error: 'Step name is required' };
    }

    if (stepId.trim() !== stepId || stepId.length === 0) {
      return { valid: false, error: 'Step name cannot be empty or contain leading/trailing spaces' };
    }

    // Check for duplicate (but allow current step to keep its name)
    const existingStepIds = getAllExistingStepIds();
    const isDuplicate = existingStepIds.includes(stepId) && stepId !== currentStepId;
    
    if (isDuplicate) {
      return { valid: false, error: 'Step name already exists. Please choose a unique name.' };
    }

    return { valid: true };
  };

  // Get all available step names for dropdowns (step_id is the display name)
  const getAvailableStepNames = () => {
    if (!parsedSchema?.event_simulation?.event_flows) return [];
    
    const allStepNames = [];
    parsedSchema.event_simulation.event_flows.forEach(flow => {
      if (flow.steps) {
        flow.steps.forEach(step => {
          if (step.step_id) {
            allStepNames.push(step.step_id);
          }
        });
      }
    });
    
    return allStepNames;
  };

  // Get all available attributes for condition dropdowns (entity table + assign-derived)
  const getAvailableAttributes = () => {
    if (!parsedSchema?.event_simulation?.event_flows) return [];
    const attributes = new Set();

    // Attributes from the simulation entity table if present in parsed schema
    const tableSpec = parsedSchema.event_simulation.table_specification;
    const dbEntities = parsedSchema.database_schema?.entities || parsedSchema.db_config?.entities || [];
    const entityTableName = tableSpec?.entity_table;
    if (entityTableName && dbEntities.length > 0) {
      const entity = dbEntities.find(e => e.name === entityTableName);
      if (entity?.attributes) {
        entity.attributes.forEach(attr => {
          if (attr.name) attributes.add(attr.name);
        });
      }
    }

    // Also include attributes referenced in assign steps (legacy behavior)
    parsedSchema.event_simulation.event_flows.forEach(flow => {
      flow?.steps?.forEach(step => {
        if (step.step_type === 'assign' && step.assign_config?.assignments) {
          step.assign_config.assignments.forEach(assignment => {
            if (assignment.attribute_name) {
              attributes.add(assignment.attribute_name);
            }
          });
        }
      });
    });

    return Array.from(attributes).sort();
  };

  // Generate unique step ID suggestions
  const generateUniqueStepId = (baseName) => {
    const existingStepIds = getAllExistingStepIds();
    let candidate = baseName;
    let counter = 1;
    
    while (existingStepIds.includes(candidate)) {
      candidate = `${baseName}_${counter}`;
      counter++;
    }
    
    return candidate;
  };

  // Backward compatibility aliases (step_id is now the display name)
  const getAvailableEventNames = getAvailableStepNames;
  const getEventNameFromStepId = (stepId) => stepId; // step_id IS the display name
  const getStepIdFromEventName = (eventName) => eventName; // event name IS the step_id

  return {
    validateStepId,
    generateUniqueStepId,
    getAllExistingStepIds,
    getAvailableStepNames,
    getAvailableAttributes,
    // Backward compatibility
    getAvailableEventNames,
    getEventNameFromStepId,
    getStepIdFromEventName
  };
};
