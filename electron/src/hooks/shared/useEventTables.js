import { useState, useEffect } from 'react';
import yaml from 'yaml';

/**
 * Custom hook to extract event tables from database configuration
 * Returns event table names that have type: 'event' for use in Create modules
 */
const useEventTables = (dbConfigContent) => {
  const [eventTables, setEventTables] = useState([]);

  useEffect(() => {
    if (!dbConfigContent) {
      setEventTables([]);
      return;
    }

    try {
      const dbParsed = yaml.parse(dbConfigContent);
      const tables = [];
      
      // Find entities with type: 'event'
      if (dbParsed?.entities) {
        const eventTypeEntities = dbParsed.entities.filter(entity => entity.type === 'event');
        
        eventTypeEntities.forEach(entity => {
          if (entity.name) {
            tables.push(entity.name);
          }
        });
      }
      
      // Sort alphabetically for better UX
      tables.sort();
      
      setEventTables(tables);
      console.log('[useEventTables] Extracted event tables:', tables);
    } catch (error) {
      console.error('[useEventTables] Error parsing database config for event tables:', error);
      setEventTables([]);
    }
  }, [dbConfigContent]);

  return eventTables;
};

export default useEventTables;