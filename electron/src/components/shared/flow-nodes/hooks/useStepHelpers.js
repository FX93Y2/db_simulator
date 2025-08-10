/**
 * Custom hook for common step helper functions used across step editors
 */
import { extractDisplayNameFromStepId } from '../../../../utils/stepIdUtils';

export const useStepHelpers = (parsedSchema) => {
  // Helper function to get display name from step ID
  const getDisplayNameFromStepId = (stepId) => {
    if (!parsedSchema?.event_simulation?.event_flows) return '';
    const flow = parsedSchema.event_simulation.event_flows[0];
    const step = flow?.steps?.find(s => s.step_id === stepId);
    if (!step) return '';
    
    // Extract display name from step_id format (all step types now use this)
    return extractDisplayNameFromStepId(step.step_id) || step.step_id;
  };

  // Helper function to get step ID from display name
  const getStepIdFromDisplayName = (displayName) => {
    if (!parsedSchema?.event_simulation?.event_flows) return '';
    const flow = parsedSchema.event_simulation.event_flows[0];
    
    // Find step where the extracted display name matches
    const step = flow?.steps?.find(s => {
      const extractedName = extractDisplayNameFromStepId(s.step_id);
      return extractedName === displayName;
    });
    
    // If not found by extracted name, try direct step_id match
    if (!step) {
      const directMatch = flow?.steps?.find(s => s.step_id === displayName);
      return directMatch?.step_id || '';
    }
    
    return step?.step_id || '';
  };

  // Get all available step names for dropdowns (all steps can be next steps)
  const getAvailableStepNames = () => {
    if (!parsedSchema?.event_simulation?.event_flows) return [];
    const flow = parsedSchema.event_simulation.event_flows[0];
    return flow?.steps?.map(s => {
      // Extract display name from step_id format (all step types now use this)
      return extractDisplayNameFromStepId(s.step_id) || s.step_id;
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