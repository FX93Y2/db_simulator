import { useState, useEffect } from 'react';
import yaml from 'yaml';

/**
 * Custom hook to extract inventory tables from database configuration
 * Returns entity names that have type: 'inventory' for use in inventory requirements
 */
const useInventoryTables = (dbConfigContent) => {
  const [inventoryTables, setInventoryTables] = useState([]);

  useEffect(() => {
    if (!dbConfigContent) {
      setInventoryTables([]);
      return;
    }

    try {
      const dbParsed = yaml.parse(dbConfigContent);
      const tables = [];
      
      // Find entities with type: 'inventory'
      if (dbParsed?.entities) {
        const inventoryTypeEntities = dbParsed.entities.filter(entity => entity.type === 'inventory');
        
        inventoryTypeEntities.forEach(entity => {
          if (entity.name) {
            tables.push(entity.name);
          }
        });
      }
      
      // Sort alphabetically for better UX
      tables.sort();
      
      setInventoryTables(tables);
      console.log('[useInventoryTables] Extracted inventory tables:', tables);
    } catch (error) {
      console.error('[useInventoryTables] Error parsing database config for inventory tables:', error);
      setInventoryTables([]);
    }
  }, [dbConfigContent]);

  return inventoryTables;
};

export default useInventoryTables;