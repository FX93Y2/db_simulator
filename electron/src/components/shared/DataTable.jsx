import React from 'react';

/**
 * Reusable DataTable component based on AttributeTable design
 * Provides consistent styling and theming across all table components
 * 
 * @param {Object} props
 * @param {Array} props.columns - Array of column definitions: { key, title, width?, className? }
 * @param {Array} props.data - Array of data objects
 * @param {Function} props.renderCell - Function to render cell content: (item, column, index) => ReactNode
 * @param {string} props.gridColumns - CSS grid template columns (e.g., '1fr 150px 60px')
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.hover - Enable hover effects (default: true)
 * @param {Function} props.onRowClick - Optional row click handler
 * @param {string} props.emptyMessage - Message to show when no data
 */
const DataTable = ({
  columns = [],
  data = [],
  renderCell,
  gridColumns = '1fr',
  className = '',
  hover = true,
  onRowClick,
  emptyMessage = 'No data available'
}) => {
  
  if (!columns.length) {
    return null;
  }

  // Ensure header and rows use CSS grid regardless of helper classes
  // This prevents vertical stacking when using custom column counts
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: gridColumns,
    gap: 0,
  };

  const handleRowClick = (item, index) => {
    if (onRowClick) {
      onRowClick(item, index);
    }
  };

  return (
    <div className={`data-grid-container ${className}`}>
      {/* Header */}
      <div className="data-grid-header" style={gridStyle}>
        {columns.map((column, index) => (
          <div 
            key={column.key || index}
            className={`grid-header-cell ${column.className || ''}`}
          >
            {column.title}
          </div>
        ))}
      </div>
      
      {/* Body */}
      <div className="data-grid-body">
        {data.length === 0 ? (
          <div className="data-grid-row" style={gridStyle}>
            <div className="grid-cell" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
              <span className="cell-content muted-text">{emptyMessage}</span>
            </div>
          </div>
        ) : (
          data.map((item, index) => (
            <div
              key={item.id || index}
              className={`data-grid-row ${hover ? 'hover-enabled' : ''} ${onRowClick ? 'clickable' : ''}`}
              style={gridStyle}
              onClick={() => handleRowClick(item, index)}
            >
              {columns.map((column, colIndex) => (
                <div 
                  key={`${index}-${column.key || colIndex}`}
                  className={`grid-cell ${column.cellClassName || ''}`}
                >
                  {renderCell ? renderCell(item, column, index) : item[column.key]}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * ResourceDataTable - Specialized version for resource tables with sections
 * 
 * @param {Object} props
 * @param {Array} props.sections - Array of section objects: { title, data, columns?, gridColumns? }
 * @param {Array} props.defaultColumns - Default columns if not specified per section
 * @param {string} props.defaultGridColumns - Default grid columns if not specified per section
 * @param {Function} props.renderCell - Function to render cell content
 * @param {string} props.className - Additional CSS classes
 */
export const ResourceDataTable = ({
  sections = [],
  defaultColumns = [],
  defaultGridColumns = '1fr',
  renderCell,
  className = ''
}) => {
  
  return (
    <div className={`data-table-container ${className}`}>
      {sections.map((section, sectionIndex) => {
        const columns = section.columns || defaultColumns;
        const gridColumns = section.gridColumns || defaultGridColumns;
        
        return (
          <div key={section.title || sectionIndex} className="resource-section">
            <h6 className="section-title">{section.title}</h6>
            <DataTable
              columns={columns}
              data={section.data}
              renderCell={renderCell}
              gridColumns={gridColumns}
              emptyMessage={section.emptyMessage || 'No items in this section'}
            />
          </div>
        );
      })}
    </div>
  );
};

export default DataTable;
