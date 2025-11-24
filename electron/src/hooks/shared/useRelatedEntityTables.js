import { useState, useEffect } from 'react';
import yaml from 'yaml';

/**
 * Builds a map of entity tables -> related tables that reference them via FK
 */
const useRelatedEntityTables = (dbConfigContent) => {
  const [relatedMap, setRelatedMap] = useState({});

  useEffect(() => {
    if (!dbConfigContent) {
      setRelatedMap({});
      return;
    }

    try {
      const dbParsed = yaml.parse(dbConfigContent);
      const entities = dbParsed?.entities || [];
      const typeByName = {};
      const map = {};

      entities.forEach((entity) => {
        if (entity?.name) {
          typeByName[entity.name] = entity.type || null;
        }
      });

      entities.forEach((entity) => {
        if (!entity?.name || !Array.isArray(entity.attributes)) return;
        const referencingTableName = entity.name;
        const referencingType = entity.type || null;

        entity.attributes.forEach((attr) => {
          if (!attr?.ref) return;
          const refTarget = attr.ref.split('.')[0];
          if (!refTarget) return;

          // Skip base entity tables referencing themselves; focus on related tables
          if (referencingType === 'entity') return;

          if (!map[refTarget]) {
            map[refTarget] = new Set();
          }
          map[refTarget].add(referencingTableName);
        });
      });

      const normalized = {};
      Object.keys(map).forEach((entityName) => {
        normalized[entityName] = Array.from(map[entityName]).sort();
      });

      setRelatedMap(normalized);
    } catch (error) {
      console.error('[useRelatedEntityTables] Failed to parse DB config:', error);
      setRelatedMap({});
    }
  }, [dbConfigContent]);

  return relatedMap;
};

export default useRelatedEntityTables;
