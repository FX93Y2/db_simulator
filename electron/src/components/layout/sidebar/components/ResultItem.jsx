import React from 'react';
import { Button } from 'react-bootstrap';
import { FiDatabase, FiTrash2, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import TableItem from './TableItem';

const ResultItem = ({ 
  result, 
  projectId, 
  isActive, 
  isExpanded,
  tables,
  currentTable,
  isCompact,
  onToggleExpansion,
  onResultClick,
  onTableClick,
  onDeleteClick
}) => {
  return (
    <div className="database-explorer-container">
      <div className={`project-result-item ${isActive ? 'active' : ''}`}>
        <div className="project-item-expand-icon" onClick={(e) => {
          e.stopPropagation();
          onToggleExpansion();
        }}>
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        <div className="result-item-icon">
          <FiDatabase />
        </div>
        <div 
          className="result-item-content"
          onClick={onResultClick}
        >
          <div className={`result-item-name ${isCompact ? 'text-truncate' : ''}`}>
            {new Date(result.created).toLocaleString()}
          </div>
        </div>
        <Button 
          variant="outline-danger"
          size="sm"
          className="result-delete-btn"
          onClick={onDeleteClick}
        >
          <FiTrash2 />
        </Button>
      </div>
      
      {isExpanded && (
        <div className="database-tables-list">
          {tables && tables.length > 0 ? (
            tables.map((table) => (
              <TableItem
                key={table}
                table={table}
                isActive={currentTable === table}
                onClick={() => onTableClick(table)}
                isCompact={isCompact}
              />
            ))
          ) : (
            <div className="no-tables">
              {isCompact ? 'No tables' : 'No tables found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultItem;