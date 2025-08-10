import { useState, useEffect } from 'react';
import yaml from 'yaml';

/**
 * Custom hook to extract entity tables from database configuration
 * Returns entity names that have type: 'entity' for use in Create modules
 */
const useEntityTables = (dbConfigContent) => {
  const [entityTables, setEntityTables] = useState([]);

  useEffect(() => {
    if (!dbConfigContent) {
      setEntityTables([]);
      return;
    }

    try {
      const dbParsed = yaml.parse(dbConfigContent);
      const tables = [];
      
      // Find entities with type: 'entity'
      if (dbParsed?.entities) {
        const entityTypeEntities = dbParsed.entities.filter(entity => entity.type === 'entity');
        
        entityTypeEntities.forEach(entity => {
          if (entity.name) {
            tables.push(entity.name);
          }
        });
      }
      
      // Sort alphabetically for better UX
      tables.sort();
      
      setEntityTables(tables);
      console.log('[useEntityTables] Extracted entity tables:', tables);
    } catch (error) {
      console.error('[useEntityTables] Error parsing database config for entity tables:', error);
      setEntityTables([]);
    }
  }, [dbConfigContent]);

  return entityTables;
};

export default useEntityTables;