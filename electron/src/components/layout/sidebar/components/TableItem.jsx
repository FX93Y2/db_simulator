import React from 'react';
import { FiTable } from 'react-icons/fi';

const TableItem = ({ table, isActive, onClick, isCompact }) => {
  return (
    <div 
      className={`database-table-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="table-item-icon">
        <FiTable />
      </div>
      <div className={`table-item-name ${isCompact ? 'text-truncate' : ''}`}>
        {table}
      </div>
    </div>
  );
};

export default TableItem;