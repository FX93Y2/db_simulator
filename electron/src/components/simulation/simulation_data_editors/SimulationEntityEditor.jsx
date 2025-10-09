import React from 'react';
import DataTable from '../../shared/DataTable';
import useEntityDefinitions from '../../../hooks/shared/useEntityDefinitions';

const SimulationEntityEditor = ({ dbConfigContent, theme = 'light', projectId }) => {
  // Use the custom hook to get entity definitions from database config
  const entityDefinitions = useEntityDefinitions(dbConfigContent);

  // Define columns for the DataTable
  const columns = [
    { key: 'entityName', title: 'Entity Name', className: 'entity-name-col' }
  ];

  // Format data for DataTable
  const data = entityDefinitions.map(entity => ({
    id: entity.name,
    entityName: entity.name
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
          gridColumns="1fr"
          className="data-grid-1-col"
        />
      </div>
    </>
  );
};

export default SimulationEntityEditor;
