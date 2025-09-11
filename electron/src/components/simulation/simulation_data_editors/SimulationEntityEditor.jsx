import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import DataTable from '../../shared/DataTable';
import useEntityDefinitions from '../../../hooks/shared/useEntityDefinitions';
import InventoryRequirementsModal from './InventoryRequirementsModal';
import useInventoryRequirements from '../../../hooks/simulation/useInventoryRequirements';

const SimulationEntityEditor = ({ dbConfigContent, theme = 'light', projectId }) => {
  // Use the custom hook to get entity definitions from database config
  const entityDefinitions = useEntityDefinitions(dbConfigContent);
  
  // Use inventory requirements hook for store access
  const { 
    getInventoryRequirements, 
    hasInventoryRequirements, 
    saveInventoryRequirements 
  } = useInventoryRequirements(projectId);
  
  // Modal state
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Handle inventory button click
  const handleInventoryButtonClick = (entityName) => {
    setSelectedEntity(entityName);
    setShowInventoryModal(true);
  };

  // Handle saving inventory requirements
  const handleSaveInventoryRequirements = (entityName, data) => {
    saveInventoryRequirements(entityName, data);
    console.log('Saved inventory requirements for', entityName, data);
  };

  // Define columns for the DataTable
  const columns = [
    { key: 'entityName', title: 'Entity Name', className: 'entity-name-col' },
    { key: 'inventoryButton', title: 'Inventory Requirements', className: 'inventory-button-col' }
  ];

  // Format data for DataTable
  const data = entityDefinitions.map(entity => ({
    id: entity.name,
    entityName: entity.name,
    hasInventory: hasInventoryRequirements(entity.name)
  }));

  // Render cell content
  const renderCell = (item, column) => {
    switch (column.key) {
      case 'entityName':
        return (
          <code className="cell-content code-text">
            {item.entityName}
          </code>
        );
      case 'inventoryButton':
        return (
          <Button
            variant={item.hasInventory ? "success" : "outline-primary"}
            size="sm"
            onClick={() => handleInventoryButtonClick(item.entityName)}
            className="cell-content"
          >
            Inventory
          </Button>
        );
      default:
        return '';
    }
  };

  if (entityDefinitions.length === 0) {
    return (
      <div className="text-center p-4 text-muted">
        <p>No entities found in the database configuration.</p>
        <small>Entities will appear here once you define them in the database configuration.</small>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3">
        <p className="text-muted small mb-2">
          Entities available in the database configuration:
        </p>
      </div>

      <div className="entity-editor data-table-container">
        <DataTable
          columns={columns}
          data={data}
          renderCell={renderCell}
          gridColumns="1fr auto"
          className="data-grid-2-col"
        />
      </div>
      
      {/* Inventory Requirements Modal */}
      <InventoryRequirementsModal
        show={showInventoryModal}
        onHide={() => setShowInventoryModal(false)}
        entityName={selectedEntity}
        dbConfigContent={dbConfigContent}
        onSave={handleSaveInventoryRequirements}
        initialData={selectedEntity ? getInventoryRequirements(selectedEntity) : null}
        theme={theme}
      />
    </>
  );
};

export default SimulationEntityEditor;