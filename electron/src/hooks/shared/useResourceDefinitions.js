import { useState, useEffect } from 'react';
import yaml from 'yaml';

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
            
            if (resourceTypeAttr.generator?.distribution?.type === 'choice' && resourceTypeAttr.generator.distribution.values) {
              // Extract the possible values from the choice distribution
              const values = resourceTypeAttr.generator.distribution.values;
              if (Array.isArray(values) && values.length > 0) {
                definitions[entity.name] = {
                  resourceTypes: values,
                  attributeName: resourceTypeAttr.name
                };
              }
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