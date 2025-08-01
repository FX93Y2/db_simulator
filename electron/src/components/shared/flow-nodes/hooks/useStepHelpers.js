/**
 * Custom hook for common step helper functions used across step editors
 */
export const useStepHelpers = (parsedSchema) => {
  // Helper function to get display name from step ID
  const getDisplayNameFromStepId = (stepId) => {
    if (!parsedSchema?.event_simulation?.event_flows) return '';
    const flow = parsedSchema.event_simulation.event_flows[0];
    const step = flow?.steps?.find(s => s.step_id === stepId);
    if (!step) return '';
    
    // For event and release steps, use their name; for others use step_id
    if (step.step_type === 'event' || step.step_type === 'release') {
      return step.event_config?.name || step.step_id;
    } else {
      return step.step_id;
    }
  };

  // Helper function to get step ID from display name
  const getStepIdFromDisplayName = (displayName) => {
    if (!parsedSchema?.event_simulation?.event_flows) return '';
    const flow = parsedSchema.event_simulation.event_flows[0];
    
    // First try to find by event_config.name (for event/release steps)
    let step = flow?.steps?.find(s => 
      (s.step_type === 'event' || s.step_type === 'release') && 
      s.event_config?.name === displayName
    );
    
    // If not found, try to find by step_id (for all step types)
    if (!step) {
      step = flow?.steps?.find(s => s.step_id === displayName);
    }
    
    return step?.step_id || '';
  };

  // Get all available step names for dropdowns (all steps can be next steps)
  const getAvailableStepNames = () => {
    if (!parsedSchema?.event_simulation?.event_flows) return [];
    const flow = parsedSchema.event_simulation.event_flows[0];
    return flow?.steps?.map(s => {
      // For event and release steps, use their name; for others use step_id
      if (s.step_type === 'event' || s.step_type === 'release') {
        return s.event_config?.name || s.step_id;
      } else {
        return s.step_id;
      }
    }) || [];
  };

  // Get all available attributes from assign modules for condition dropdowns
  const getAvailableAttributes = () => {
    if (!parsedSchema?.event_simulation?.event_flows) return [];
    const flow = parsedSchema.event_simulation.event_flows[0];
    const attributes = new Set();
    
    // Find all assign steps and extract their attribute names
    flow?.steps?.forEach(step => {
      if (step.step_type === 'assign' && step.assign_config?.assignments) {
        step.assign_config.assignments.forEach(assignment => {
          if (assignment.attribute_name) {
            attributes.add(assignment.attribute_name);
          }
        });
      }
    });
    
    return Array.from(attributes).sort();
  };

  // Backward compatibility aliases
  const getAvailableEventNames = getAvailableStepNames;
  const getEventNameFromStepId = getDisplayNameFromStepId;
  const getStepIdFromEventName = getStepIdFromDisplayName;

  return {
    getDisplayNameFromStepId,
    getStepIdFromDisplayName,
    getAvailableStepNames,
    getAvailableAttributes,
    // Backward compatibility
    getAvailableEventNames,
    getEventNameFromStepId,
    getStepIdFromEventName
  };
};