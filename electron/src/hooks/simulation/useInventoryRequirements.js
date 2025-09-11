/**
 * Custom hook for managing inventory requirements in simulation configuration
 * Provides inventory requirements state and actions for simulation entities
 */

import { useSimulationActions } from '../../stores/simulationConfigStore';

/**
 * Hook for inventory requirements management
 * @param {string} projectId - Project identifier for store access
 * @returns {Object} - Inventory requirements state and actions
 */
const useInventoryRequirements = (projectId) => {
  // Get simulation actions from the store
  const {
    updateInventoryRequirements,
    getInventoryRequirements,
    hasInventoryRequirements,
    removeInventoryRequirements,
    getAllInventoryRequirements,
    clearAllInventoryRequirements,
    syncSimulationToYaml
  } = useSimulationActions(projectId);

  /**
   * Save inventory requirements for an entity
   * @param {string} entityTable - Entity table name
   * @param {Object} inventoryConfig - Inventory configuration object
   * @returns {Object} - Success status and message
   */
  const saveInventoryRequirements = (entityTable, inventoryConfig) => {
    const result = updateInventoryRequirements(entityTable, inventoryConfig);
    
    // Sync to YAML after updating
    syncSimulationToYaml();
    
    return result;
  };

  /**
   * Remove inventory requirements for an entity
   * @param {string} entityTable - Entity table name
   * @returns {Object} - Success status and message
   */
  const deleteInventoryRequirements = (entityTable) => {
    const result = removeInventoryRequirements(entityTable);
    
    // Sync to YAML after removing
    syncSimulationToYaml();
    
    return result;
  };

  /**
   * Clear all inventory requirements
   * @returns {Object} - Success status and message
   */
  const clearAll = () => {
    const result = clearAllInventoryRequirements();
    
    // Sync to YAML after clearing
    syncSimulationToYaml();
    
    return result;
  };

  return {
    // State accessors
    getInventoryRequirements,
    hasInventoryRequirements,
    getAllInventoryRequirements,
    
    // Actions
    saveInventoryRequirements,
    deleteInventoryRequirements,
    clearAll,
    
    // Direct store actions (for advanced use)
    updateInventoryRequirements,
    removeInventoryRequirements,
    clearAllInventoryRequirements
  };
};

export default useInventoryRequirements;