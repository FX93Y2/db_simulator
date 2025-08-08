import { useCallback } from 'react';

/**
 * Custom hook for handling YAML processing in ModularEventFlow
 * Manages YAML parsing, generation, and step structure validation
 */
export const useFlowYamlProcessor = (canonicalSteps, flowSchema, setCanonicalSteps, positions) => {

  const generateYAML = useCallback(() => {
    if (canonicalSteps.length === 0) {
      // Return proper empty structure
      if (!flowSchema || !flowSchema.event_simulation || !flowSchema.event_simulation.event_flows || !flowSchema.event_simulation.event_flows[0]) {
        return {
          simulation: {
            duration_days: 30
          },
          event_simulation: {
            event_flows: [{
              flow_id: 'main_flow',
              event_table: 'Event',
              steps: []
            }]
          }
        };
      }
      
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
    
    if (!flowSchema || !flowSchema.event_simulation || !flowSchema.event_simulation.event_flows || !flowSchema.event_simulation.event_flows[0]) {
      // Create default structure if missing
      return {
        simulation: {
          duration_days: 30
        },
        event_simulation: {
          event_flows: [{
            flow_id: 'main_flow',
            event_table: 'Event',
            steps: canonicalSteps.map(step => {
              const { position, ...stepWithoutPosition } = step;
              return stepWithoutPosition;
            })
          }]
        }
      };
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

  // Handle YAML import from files (one-way sync: file -> canvas)
  const handleYAMLImport = useCallback((yamlContent) => {
    // Ensure we have a string
    if (typeof yamlContent !== 'string') {
      throw new Error('Invalid YAML content: expected string');
    }
    
    try {
      const newSchema = typeof yamlContent === 'string' ? 
        require('yaml').parse(yamlContent) : yamlContent;
      
      // Validate this is simulation YAML (not database YAML)
      if (!newSchema?.event_simulation && !newSchema?.steps) {
        throw new Error('Invalid YAML: This appears to be database configuration, not simulation configuration');
      }
      
      if (!newSchema?.event_simulation?.event_flows) {
        throw new Error('Invalid YAML: Simulation configuration must contain "event_simulation.event_flows" section');
      }
      
      const eventFlows = newSchema.event_simulation.event_flows;
      if (!Array.isArray(eventFlows) || eventFlows.length === 0) {
        throw new Error('Invalid YAML: "event_flows" must be a non-empty array');
      }
      
      // Use first flow
      const flow = eventFlows[0];
      if (!flow.steps || !Array.isArray(flow.steps)) {
        throw new Error('Invalid YAML: Event flow must contain a "steps" array');
      }
      
      const newSteps = flow.steps;
      
      // Validate steps structure
      for (const step of newSteps) {
        if (!step.step_id) {
          throw new Error('Invalid YAML: All steps must have a "step_id" field');
        }
        if (!step.step_type) {
          throw new Error(`Invalid YAML: Step "${step.step_id}" must have a "step_type" field`);
        }
      }
      
      if (newSteps.length === 0) {
        setCanonicalSteps([]);
        return { success: true, message: 'Empty simulation configuration imported' };
      }
      
      // Use position hook to resolve positions
      const updatedSteps = positions.resolvePositions(newSteps);
      
      setCanonicalSteps(updatedSteps);
      positions.completeInitialLoad();
      
      return { success: true, message: `Successfully imported ${newSteps.length} steps` };
      
    } catch (error) {
      throw new Error(`YAML parsing failed: ${error.message}`);
    }
  }, [positions, setCanonicalSteps]);

  return {
    generateYAML,
    handleYAMLImport,
    detectStepChanges
  };
};