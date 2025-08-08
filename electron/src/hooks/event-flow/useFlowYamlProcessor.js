import { useCallback } from 'react';

/**
 * Custom hook for handling YAML processing in ModularEventFlow
 * Manages YAML parsing, generation, and step structure validation
 */
export const useFlowYamlProcessor = (canonicalSteps, flowSchema, setCanonicalSteps, positions) => {

  const generateYAML = useCallback(() => {
    if (canonicalSteps.length === 0) {
      // Return proper empty structure instead of {}
      if (!flowSchema) return {};
      
      return {
        ...flowSchema,
        event_simulation: {
          ...flowSchema.event_simulation,
          event_flows: [{
            ...flowSchema.event_simulation.event_flows[0],
            steps: [] // Empty steps array
          }]
        }
      };
    }
    
    if (!flowSchema) {
      return {};
    }
    
    const updatedSchema = {
      ...flowSchema,
      event_simulation: {
        ...flowSchema.event_simulation,
        event_flows: [{
          ...flowSchema.event_simulation.event_flows[0],
          steps: canonicalSteps.map(step => {
            const { position, ...stepWithoutPosition } = step;
            return stepWithoutPosition;
          })
        }]
      }
    };
    
    return updatedSchema;
  }, [canonicalSteps, flowSchema]);

  // Utility function to detect step changes
  const detectStepChanges = useCallback((oldSteps, newSteps) => {
    const oldIds = new Set(oldSteps.map(s => s.step_id));
    const newIds = new Set(newSteps.map(s => s.step_id));
    
    const added = newSteps.filter(s => !oldIds.has(s.step_id));
    const deleted = oldSteps.filter(s => !newIds.has(s.step_id));
    const modified = newSteps.filter(s => {
      const oldStep = oldSteps.find(old => old.step_id === s.step_id);
      if (!oldStep) return false;
      
      // Deep comparison of step properties (excluding position)
      const oldClean = { ...oldStep };
      delete oldClean.position;
      const newClean = { ...s };
      delete newClean.position;
      
      return JSON.stringify(oldClean) !== JSON.stringify(newClean);
    });
    
    return { added, deleted, modified };
  }, []);

  // Handle YAML changes from external sources (like YAML editor)
  const handleYAMLChange = useCallback((newSchema) => {
    if (!newSchema?.event_simulation?.event_flows) {
      setCanonicalSteps([]);
      return;
    }
    
    const eventFlows = newSchema.event_simulation.event_flows;
    if (eventFlows.length === 0) {
      setCanonicalSteps([]);
      return;
    }
    
    // Use first flow
    const flow = eventFlows[0];
    const newSteps = flow.steps || [];
    
    if (newSteps.length === 0) {
      setCanonicalSteps([]);
      return;
    }
    
    // Use position hook to resolve positions
    const updatedSteps = positions.resolvePositions(newSteps);
    
    // Check for structural changes
    const hasStructuralChanges = JSON.stringify(canonicalSteps.map(s => {
      const { position, ...step } = s;
      return step;
    })) !== JSON.stringify(newSteps);
    
    if (hasStructuralChanges || canonicalSteps.length !== updatedSteps.length) {
      setCanonicalSteps(updatedSteps);
      positions.completeInitialLoad();
    }
    
  }, [canonicalSteps, positions, setCanonicalSteps]);

  return {
    generateYAML,
    handleYAMLChange,
    detectStepChanges
  };
};