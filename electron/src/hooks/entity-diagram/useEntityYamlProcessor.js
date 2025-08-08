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

  // Handle YAML changes from external sources (like YAML editor)
  const handleYAMLChange = useCallback((newYAMLContent) => {
    // CRITICAL: Don't process YAML until positions are ready
    if (!positions.isStorageReady() || !positions.layoutMapReady) {
      return;
    }
    
    // Ensure we have a string
    if (typeof newYAMLContent !== 'string') {
      return;
    }
    
    try {
      const parsedYAML = yaml.parse(newYAMLContent);
      const newEntities = parsedYAML?.entities || [];
      
      // Skip if this looks like simulation YAML (has steps) rather than database YAML
      if (parsedYAML?.steps) {
        return;
      }
      
      if (newEntities.length === 0) {
        setCanonicalEntities([]);
        return;
      }
      
      // Use position hook to resolve positions
      const updatedEntities = positions.resolvePositions(newEntities.map(entity => ({
        ...entity,
        attributes: sortAttributes(entity.attributes || []) // Sort attributes
      })));
      
      // Check for structural changes
      const hasStructuralChanges = JSON.stringify(canonicalEntities.map(e => {
        const { position, ...entity } = e;
        return entity;
      })) !== JSON.stringify(newEntities);
      
      if (hasStructuralChanges || canonicalEntities.length !== updatedEntities.length) {
        setCanonicalEntities(updatedEntities);
        // Only complete initial load if we successfully loaded and applied saved positions
        // OR if there were no saved positions to begin with
        const hasSavedPositions = Object.keys(positions.layoutMap).length > 0;
        const appliedSavedPositions = hasSavedPositions && updatedEntities.some(e => 
          positions.layoutMap[e.name] && 
          e.position.x === positions.layoutMap[e.name].x && 
          e.position.y === positions.layoutMap[e.name].y
        );
        
        if (!hasSavedPositions || appliedSavedPositions) {
          positions.completeInitialLoad();
        }
      }
      
      return parsedYAML;
      
    } catch (error) {
      // Invalid YAML, ignore changes
      return null;
    }
  }, [canonicalEntities, positions, setCanonicalEntities]);

  return {
    generateYAML,
    handleYAMLChange,
    detectEntityChanges
  };
};