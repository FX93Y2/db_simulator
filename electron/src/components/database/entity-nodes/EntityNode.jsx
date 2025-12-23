import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiKey, FiLink } from 'react-icons/fi';

// Function to sort attributes: primary key first, then foreign keys, then preserve user order for others
export const sortAttributes = (attributes) => {
  if (!attributes || attributes.length === 0) return [];

  // Create a copy with original indices to maintain user-defined order
  const attributesWithIndex = attributes.map((attr, index) => ({
    ...attr,
    originalIndex: index
  }));

  return attributesWithIndex.sort((a, b) => {
    // Primary key gets highest priority (0)
    const aPriority = a.type === 'pk' ? 0 :
      (a.type === 'fk' || a.type === 'entity_id' || a.type === 'resource_id') ? 1 : 2;
    const bPriority = b.type === 'pk' ? 0 :
      (b.type === 'fk' || b.type === 'entity_id' || b.type === 'resource_id') ? 1 : 2;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // If same priority, preserve original order (user-defined)
    return a.originalIndex - b.originalIndex;
  }).map(attr => {
    // Remove the temporary originalIndex property
    const { originalIndex, ...cleanAttr } = attr;
    return cleanAttr;
  });
};

// Custom Entity Node component with enhanced connection handles
const EntityNode = ({ data, theme }) => {
  // Determine node class based on table type
  const getNodeTypeClass = () => {
    switch (data.tableType) {
      case 'entity':
        return 'entity-type';
      case 'event':
        return 'event-type';
      case 'resource':
        return 'resource-type';
      default:
        return '';
    }
  };

  // Get handle tooltip based on table type and position
  const getHandleTooltip = (position, type) => {
    if (type === 'source') {
      return `Connect from ${data.label} to another table (creates foreign key in ${data.label})`;
    } else {
      return `Connect to ${data.label} from another table (creates foreign key in source table)`;
    }
  };

  return (
    <div className={`entity-node ${getNodeTypeClass()}`}>
      {/* Connection handles - Left and Right only for ER connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="connection-handle connection-handle--source"
        title={getHandleTooltip('right', 'source')}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="connection-handle connection-handle--target"
        title={getHandleTooltip('left', 'target')}
      />

      {/* Modern ER table structure with header and body */}
      <div className="entity-table">
        <div className="entity-table__header">
          <span className="entity-table__name">{data.label}</span>
          {data.tableType && (
            <span className="entity-table__type-badge">
              {data.tableType}
            </span>
          )}
        </div>
        <div className="entity-table__body">
          {sortAttributes(data.attributes).map((attr, index) => (
            <div
              key={index}
              className={`entity-table__row ${attr.type === 'pk' ? 'primary-key' : ''} ${attr.type === 'fk' || attr.type === 'entity_id' || attr.type === 'resource_id' ? 'foreign-key' : ''
                }`}
              title={attr.ref ? `References: ${attr.ref}` : ''}
            >
              <span className="entity-table__attribute-name">
                {(attr.type === 'pk') && <FiKey className="key-icon" />}
                {(attr.type === 'fk' || attr.type === 'entity_id' || attr.type === 'resource_id') && <FiLink className="key-icon" />}
                {attr.name}
              </span>
              <span className="entity-table__attribute-type">
                {attr.dataType || attr.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EntityNode;