import { useState, useEffect } from 'react';
import yaml from 'yaml';

/**
 * Custom hook to extract entity definitions from database configuration
 * Returns only entities with type: 'entity' - these are the simulation entities
 * that flow through the system (created by Create module, processed by other modules)
 */
const useEntityDefinitions = (dbConfigContent) => {
  const [entityDefinitions, setEntityDefinitions] = useState([]);

  useEffect(() => {
    if (!dbConfigContent) {
      setEntityDefinitions([]);
      return;
    }

    try {
      const dbParsed = yaml.parse(dbConfigContent);
      const entities = [];
      
      // Extract only entities with type: 'entity' from the database configuration
      if (dbParsed?.entities) {
        const entityEntities = dbParsed.entities.filter(entity => entity.type === 'entity');
        
        entityEntities.forEach(entity => {
          if (entity.name) {
            entities.push({
              name: entity.name,
              type: entity.type
            });
          }
        });
      }
      
      setEntityDefinitions(entities);
      console.log('[useEntityDefinitions] Extracted entity definitions:', entities);
    } catch (error) {
      console.error('[useEntityDefinitions] Error parsing database config for entity definitions:', error);
      setEntityDefinitions([]);
    }
  }, [dbConfigContent]);

  return entityDefinitions;
};

export default useEntityDefinitions;