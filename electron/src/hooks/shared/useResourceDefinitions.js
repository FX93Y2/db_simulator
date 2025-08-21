import { useState, useEffect } from 'react';
import yaml from 'yaml';

/**
 * Parse DISC formula to extract string values
 * @param {string} formula - DISC formula like "DISC(0.2, 'SRE', 0.5, 'Tech Support', ...)"
 * @returns {Array} - Array of string values
 */
const parseDISCFormula = (formula) => {
  if (!formula || typeof formula !== 'string') return [];
  
  // Match DISC(...) pattern
  const discMatch = formula.match(/DISC\s*\(([^)]+)\)/);
  if (!discMatch) return [];
  
  const params = discMatch[1];
  const values = [];
  
  // Split by comma, but handle quoted strings properly
  const regex = /"([^"]*)"|'([^']*)'|([^,]+)/g;
  let match;
  let expectingValue = false;
  
  while ((match = regex.exec(params)) !== null) {
    const value = match[1] || match[2] || match[3]?.trim();
    
    if (expectingValue) {
      // This should be a string value (resource type)
      if (typeof value === 'string' && value !== '') {
        values.push(value);
      }
      expectingValue = false;
    } else {
      // This should be a probability (number), next will be a value
      expectingValue = true;
    }
  }
  
  return values;
};

/**
 * Custom hook to extract resource definitions from database configuration
 * Returns resource definitions that can be used by multiple components
 */
const useResourceDefinitions = (dbConfigContent) => {
  const [resourceDefinitions, setResourceDefinitions] = useState({});

  useEffect(() => {
    if (!dbConfigContent) {
      setResourceDefinitions({});
      return;
    }

    try {
      const dbParsed = yaml.parse(dbConfigContent);
      const definitions = {};
      
      // Find entities with type: resource
      if (dbParsed?.entities) {
        const resourceEntities = dbParsed.entities.filter(entity => entity.type === 'resource');
        
        resourceEntities.forEach(entity => {
          // Find attributes with type: resource_type
          const resourceTypeAttributes = entity.attributes?.filter(attr => attr.type === 'resource_type') || [];
          
          if (resourceTypeAttributes.length > 0) {
            // Take the first resource_type attribute (should be only one)
            const resourceTypeAttr = resourceTypeAttributes[0];
            let resourceTypes = [];
            
            // Check for new distribution formula format
            if (resourceTypeAttr.generator?.type === 'distribution' && resourceTypeAttr.generator.formula) {
              resourceTypes = parseDISCFormula(resourceTypeAttr.generator.formula);
            }
            // Check for old choice distribution format (backward compatibility)
            else if (resourceTypeAttr.generator?.distribution?.type === 'choice' && resourceTypeAttr.generator.distribution.values) {
              resourceTypes = resourceTypeAttr.generator.distribution.values;
            }
            
            if (resourceTypes.length > 0) {
              definitions[entity.name] = {
                resourceTypes: resourceTypes,
                attributeName: resourceTypeAttr.name
              };
            }
          }
        });
      }
      
      setResourceDefinitions(definitions);
      console.log('[useResourceDefinitions] Extracted resource definitions:', definitions);
    } catch (error) {
      console.error('[useResourceDefinitions] Error parsing database config for resource definitions:', error);
      setResourceDefinitions({});
    }
  }, [dbConfigContent]);

  return resourceDefinitions;
};

export default useResourceDefinitions;