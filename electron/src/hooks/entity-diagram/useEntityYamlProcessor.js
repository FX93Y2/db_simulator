import { useCallback } from 'react';
import yaml from 'yaml';
import { sortAttributes } from '../../components/shared/entity-nodes/EntityNode';

/**
 * Custom hook for handling YAML processing in ERDiagram
 * Manages YAML parsing, generation, and entity structure validation
 */
export const useEntityYamlProcessor = (canonicalEntities, positions, setCanonicalEntities) => {

  const generateYAML = useCallback(() => {
    // If no entities, return empty string
    if (canonicalEntities.length === 0) {
      return '';
    }
    
    const yamlObject = {
      entities: canonicalEntities.map(entity => ({
        name: entity.name,
        ...(entity.type && { type: entity.type }),
        rows: entity.rows || 100,
        attributes: entity.attributes || []
      }))
    };
    
    return yaml.stringify(yamlObject);
  }, [canonicalEntities]);

  // Utility function to detect entity changes
  const detectEntityChanges = useCallback((oldEntities, newEntities) => {
    const oldNames = new Set(oldEntities.map(e => e.name));
    const newNames = new Set(newEntities.map(e => e.name));
    
    const added = newEntities.filter(e => !oldNames.has(e.name));
    const deleted = oldEntities.filter(e => !newNames.has(e.name));
    const modified = newEntities.filter(e => {
      const oldEntity = oldEntities.find(old => old.name === e.name);
      if (!oldEntity) return false;
      
      // Deep comparison of entity properties (excluding position)
      const oldClean = { ...oldEntity };
      delete oldClean.position;
      const newClean = { ...e };
      delete newClean.position;
      
      return JSON.stringify(oldClean) !== JSON.stringify(newClean);
    });
    
    return { added, deleted, modified };
  }, []);

  // Handle YAML import from files (one-way sync: file -> canvas)
  const handleYAMLImport = useCallback((newYAMLContent) => {
    // Ensure we have a string
    if (typeof newYAMLContent !== 'string') {
      throw new Error('Invalid YAML content: expected string');
    }
    
    try {
      const parsedYAML = yaml.parse(newYAMLContent);
      const newEntities = parsedYAML?.entities || [];
      
      // Validate this is database YAML (not simulation YAML)
      if (parsedYAML?.event_simulation || parsedYAML?.steps) {
        throw new Error('Invalid YAML: This appears to be simulation configuration, not database configuration');
      }
      
      if (!parsedYAML?.entities) {
        throw new Error('Invalid YAML: Database configuration must contain "entities" section');
      }
      
      // Validate entities structure
      for (const entity of newEntities) {
        if (!entity.name) {
          throw new Error('Invalid YAML: All entities must have a "name" field');
        }
        if (!entity.attributes || !Array.isArray(entity.attributes)) {
          throw new Error(`Invalid YAML: Entity "${entity.name}" must have an "attributes" array`);
        }
      }
      
      // If validation passes, update canvas
      if (newEntities.length === 0) {
        setCanonicalEntities([]);
        return { success: true, message: 'Empty database configuration imported' };
      }
      
      // Use position hook to resolve positions for new entities
      const updatedEntities = positions.resolvePositions(newEntities.map(entity => ({
        ...entity,
        attributes: sortAttributes(entity.attributes || []) // Sort attributes
      })));
      
      setCanonicalEntities(updatedEntities);
      positions.completeInitialLoad();
      
      return { success: true, message: `Successfully imported ${newEntities.length} entities` };
      
    } catch (error) {
      throw new Error(`YAML parsing failed: ${error.message}`);
    }
  }, [positions, setCanonicalEntities]);

  return {
    generateYAML,
    handleYAMLImport,
    detectEntityChanges
  };
};