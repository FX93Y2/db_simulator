import { useState, useEffect } from 'react';
import yaml from 'yaml';

/**
 * Custom hook to extract bridge tables from database configuration
 * Returns entity names that have type: 'bridge'
 */
const useBridgeTables = (dbConfigContent) => {
  const [bridgeTables, setBridgeTables] = useState([]);

  useEffect(() => {
    if (!dbConfigContent) {
      setBridgeTables([]);
      return;
    }

    try {
      const dbParsed = yaml.parse(dbConfigContent);
      const tables = [];
      
      // Find entities with type: 'bridge'
      if (dbParsed?.entities) {
        const bridgeTypeEntities = dbParsed.entities.filter(entity => entity.type === 'bridge');
        
        bridgeTypeEntities.forEach(entity => {
          if (entity.name) {
            tables.push(entity.name);
          }
        });
      }
      
      // Sort alphabetically for better UX
      tables.sort();
      
      setBridgeTables(tables);
      console.log('[useBridgeTables] Extracted bridge tables:', tables);
    } catch (error) {
      console.error('[useBridgeTables] Error parsing database config for bridge tables:', error);
      setBridgeTables([]);
    }
  }, [dbConfigContent]);

  return bridgeTables;
};

export default useBridgeTables;