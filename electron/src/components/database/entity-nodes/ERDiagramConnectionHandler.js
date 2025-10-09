/**
 * Enhanced connection handler for ERDiagram component
 * Automatically generates foreign key attributes when tables are connected
 */

/**
 * Generate a foreign key attribute name based on the target table
 * @param {string} targetTableName - Name of the table being referenced
 * @param {Array} existingAttributes - Existing attributes in the source table
 * @returns {string} - Generated foreign key attribute name
 */
export const generateForeignKeyName = (targetTableName, existingAttributes = []) => {
  const baseNames = [
    `${targetTableName.toLowerCase()}_id`,
    `${targetTableName.toLowerCase()}Id`,
    `ref_${targetTableName.toLowerCase()}`,
    `${targetTableName.toLowerCase()}_ref`
  ];
  
  // Find the first non-conflicting name
  for (const baseName of baseNames) {
    if (!existingAttributes.some(attr => attr.name === baseName)) {
      return baseName;
    }
  }
  
  // If all base names conflict, add a number suffix
  let counter = 1;
  let candidateName = `${targetTableName.toLowerCase()}_id_${counter}`;
  while (existingAttributes.some(attr => attr.name === candidateName)) {
    counter++;
    candidateName = `${targetTableName.toLowerCase()}_id_${counter}`;
  }
  
  return candidateName;
};

/**
 * Determine the appropriate foreign key type based on target table type
 * @param {Object} targetEntity - The target entity object
 * @returns {string} - The foreign key type
 */
export const determineForeignKeyType = (targetEntity) => {
  if (!targetEntity || !targetEntity.type) {
    return 'fk'; // Default foreign key
  }
  
  switch (targetEntity.type) {
    case 'entity':
      return 'entity_id';
    case 'event':
      return 'event_id';
    case 'resource':
      return 'resource_id';
    default:
      return 'fk';
  }
};

/**
 * Find the primary key of a table to use as reference
 * @param {Object} targetEntity - The target entity object
 * @returns {string} - The primary key column name
 */
export const findPrimaryKey = (targetEntity) => {
  if (!targetEntity || !targetEntity.attributes) {
    return 'id'; // Default assumption
  }
  
  const pkAttribute = targetEntity.attributes.find(attr => attr.type === 'pk');
  return pkAttribute ? pkAttribute.name : 'id';
};

/**
 * Create a foreign key attribute object
 * @param {string} fkName - Name of the foreign key attribute
 * @param {string} fkType - Type of the foreign key
 * @param {string} targetTable - Name of the target table
 * @param {string} targetColumn - Name of the target column (usually primary key)
 * @returns {Object} - Foreign key attribute object
 */
export const createForeignKeyAttribute = (fkName, fkType, targetTable, targetColumn) => {
  return {
    name: fkName,
    type: fkType,
    ref: `${targetTable}.${targetColumn}`,
    generator: {
      type: 'foreign_key',
      subtype: 'one_to_many' // Default relationship type
    }
  };
};

/**
 * Enhanced connection handler that automatically creates foreign key relationships
 * @param {Object} params - Connection parameters from ReactFlow
 * @param {Object} dbSchema - Current database schema
 * @param {Function} onSchemaUpdate - Callback to update the schema
 * @returns {Object} - Updated schema or null if connection failed
 */
export const handleTableConnection = (params, dbSchema, onSchemaUpdate) => {
  console.log('[ConnectionHandler] Processing connection:', params);
  
  // Validate connection parameters
  if (!params.source || !params.target || params.source === params.target) {
    console.warn('[ConnectionHandler] Invalid connection parameters');
    return null;
  }
  
  if (!dbSchema || !dbSchema.entities) {
    console.warn('[ConnectionHandler] Invalid database schema');
    return null;
  }
  
  // Create a deep copy of the schema
  const updatedSchema = JSON.parse(JSON.stringify(dbSchema));
  
  // Find source and target entities
  const sourceEntity = updatedSchema.entities.find(e => e.name === params.source);
  const targetEntity = updatedSchema.entities.find(e => e.name === params.target);
  
  if (!sourceEntity || !targetEntity) {
    console.warn('[ConnectionHandler] Source or target entity not found');
    return null;
  }
  
  // Check if a foreign key relationship already exists
  const existingFk = sourceEntity.attributes?.find(attr => 
    (attr.type === 'fk' || attr.type === 'entity_id' || attr.type === 'event_id' || attr.type === 'resource_id') &&
    attr.ref && attr.ref.startsWith(`${params.target}.`)
  );
  
  if (existingFk) {
    console.log('[ConnectionHandler] Foreign key relationship already exists:', existingFk.name);
    return updatedSchema; // Return unchanged schema
  }
  
  // Generate foreign key details
  const fkType = determineForeignKeyType(targetEntity);
  const targetPrimaryKey = findPrimaryKey(targetEntity);
  const fkName = generateForeignKeyName(params.target, sourceEntity.attributes);
  
  // Create the foreign key attribute
  const foreignKeyAttribute = createForeignKeyAttribute(fkName, fkType, params.target, targetPrimaryKey);
  
  // Add the foreign key to the source entity
  if (!sourceEntity.attributes) {
    sourceEntity.attributes = [];
  }
  
  sourceEntity.attributes.push(foreignKeyAttribute);
  
  // Sort attributes to ensure primary key first, then foreign keys, then others
  sourceEntity.attributes.sort((a, b) => {
    const aPriority = a.type === 'pk' ? 0 : 
                     (a.type === 'fk' || a.type === 'event_id' || a.type === 'entity_id' || a.type === 'resource_id') ? 1 : 2;
    const bPriority = b.type === 'pk' ? 0 : 
                     (b.type === 'fk' || b.type === 'event_id' || b.type === 'entity_id' || b.type === 'resource_id') ? 1 : 2;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    return a.name.localeCompare(b.name);
  });
  
  console.log(`[ConnectionHandler] Created foreign key: ${fkName} (${fkType}) -> ${params.target}.${targetPrimaryKey}`);
  
  // Update the schema through callback
  if (onSchemaUpdate) {
    onSchemaUpdate(updatedSchema);
  }
  
  return updatedSchema;
};

/**
 * Handle edge deletion - remove foreign key when edge is deleted
 * @param {Array} deletedEdges - Array of deleted edge objects
 * @param {Object} dbSchema - Current database schema
 * @param {Function} onSchemaUpdate - Callback to update the schema
 * @returns {Object} - Updated schema
 */
export const handleEdgeDeletion = (deletedEdges, dbSchema, onSchemaUpdate) => {
  console.log('[ConnectionHandler] Processing edge deletion:', deletedEdges);
  
  if (!deletedEdges.length || !dbSchema || !dbSchema.entities) {
    return dbSchema;
  }
  
  const updatedSchema = JSON.parse(JSON.stringify(dbSchema));
  
  deletedEdges.forEach(edge => {
    const sourceEntity = updatedSchema.entities.find(e => e.name === edge.source);
    const targetTable = edge.target;
    
    if (sourceEntity && sourceEntity.attributes) {
      // Find and remove the foreign key attribute
      const fkIndex = sourceEntity.attributes.findIndex(attr => 
        (attr.type === 'fk' || attr.type === 'entity_id' || attr.type === 'event_id' || attr.type === 'resource_id') &&
        attr.ref && attr.ref.startsWith(`${targetTable}.`)
      );
      
      if (fkIndex !== -1) {
        const removedFk = sourceEntity.attributes.splice(fkIndex, 1)[0];
        console.log(`[ConnectionHandler] Removed foreign key: ${removedFk.name} from ${edge.source}`);
      }
    }
  });
  
  if (onSchemaUpdate) {
    onSchemaUpdate(updatedSchema);
  }
  
  return updatedSchema;
};

/**
 * Handle table/entity deletion - remove all foreign keys that reference the deleted table
 * @param {Array} deletedTableNames - Array of deleted table names
 * @param {Object} dbSchema - Current database schema
 * @param {Function} onSchemaUpdate - Callback to update the schema
 * @returns {Object} - Updated schema
 */
export const handleTableDeletion = (deletedTableNames, dbSchema, onSchemaUpdate) => {
  console.log('[ConnectionHandler] Processing table deletion:', deletedTableNames);
  
  if (!deletedTableNames.length || !dbSchema || !dbSchema.entities) {
    return dbSchema;
  }
  
  const updatedSchema = JSON.parse(JSON.stringify(dbSchema));
  
  // Remove the deleted entities from the schema
  updatedSchema.entities = updatedSchema.entities.filter(
    entity => !deletedTableNames.includes(entity.name)
  );
  
  // Remove foreign keys that reference the deleted tables from remaining entities
  updatedSchema.entities.forEach(entity => {
    if (entity.attributes) {
      const originalLength = entity.attributes.length;
      entity.attributes = entity.attributes.filter(attr => {
        // Keep non-foreign key attributes
        if (!['fk', 'entity_id', 'event_id', 'resource_id'].includes(attr.type)) {
          return true;
        }
        
        // Keep foreign keys that don't reference deleted tables
        if (attr.ref) {
          const [referencedTable] = attr.ref.split('.');
          const shouldRemove = deletedTableNames.includes(referencedTable);
          if (shouldRemove) {
            console.log(`[ConnectionHandler] Removing orphaned foreign key: ${attr.name} from ${entity.name} (referenced deleted table: ${referencedTable})`);
          }
          return !shouldRemove;
        }
        
        return true;
      });
      
      if (entity.attributes.length !== originalLength) {
        console.log(`[ConnectionHandler] Cleaned up foreign keys in ${entity.name}`);
      }
    }
  });
  
  if (onSchemaUpdate) {
    onSchemaUpdate(updatedSchema);
  }
  
  return updatedSchema;
};

/**
 * Validate connection before allowing it
 * @param {Object} connection - Connection parameters
 * @param {Object} dbSchema - Current database schema
 * @returns {boolean} - Whether the connection is valid
 */
export const validateConnection = (connection, dbSchema) => {
  // Prevent self-connections
  if (connection.source === connection.target) {
    return false;
  }
  
  // Ensure both entities exist
  if (!dbSchema || !dbSchema.entities) {
    return false;
  }
  
  const sourceExists = dbSchema.entities.some(e => e.name === connection.source);
  const targetExists = dbSchema.entities.some(e => e.name === connection.target);
  
  return sourceExists && targetExists;
};

/**
 * Get suggested connection types based on entity types
 * @param {Object} sourceEntity - Source entity
 * @param {Object} targetEntity - Target entity
 * @returns {Array} - Array of suggested connection types
 */
export const getSuggestedConnectionTypes = (sourceEntity, targetEntity) => {
  const suggestions = [];
  
  if (!sourceEntity || !targetEntity) {
    return suggestions;
  }
  
  // Based on entity types, suggest appropriate relationships
  if (sourceEntity.type === 'entity' && targetEntity.type === 'resource') {
    suggestions.push({
      type: 'entity_id',
      description: 'Entity references resource',
      cardinality: 'many-to-one'
    });
  }

  if (sourceEntity.type === 'bridge' && targetEntity.type === 'entity') {
    suggestions.push({
      type: 'entity_id',
      description: 'Bridge table references entity',
      cardinality: 'many-to-one'
    });
  }
  
  if (sourceEntity.type === 'event' && targetEntity.type === 'entity') {
    suggestions.push({
      type: 'entity_id',
      description: 'Event belongs to entity',
      cardinality: 'many-to-one'
    });
  }
  
  if (sourceEntity.type === 'event' && targetEntity.type === 'resource') {
    suggestions.push({
      type: 'resource_id',
      description: 'Event uses resource',
      cardinality: 'many-to-many'
    });
  }
  
  // Default foreign key relationship
  suggestions.push({
    type: 'fk',
    description: 'General foreign key relationship',
    cardinality: 'many-to-one'
  });
  
  return suggestions;
};