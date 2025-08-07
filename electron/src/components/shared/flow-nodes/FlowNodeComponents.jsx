import React from 'react';
import { Handle, Position } from 'reactflow';

// Process (Event) Node Component - Rectangle
export const ProcessNode = ({ data, selected }) => {
  return (
    <div className={`custom-node process-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-type">Process</span>
      </div>
      <div className="node-content">
        <div className="node-title">{data.stepConfig?.event_config?.name || data.label}</div>
        <div className="node-details">
          {data.stepConfig?.event_config?.duration && (
            <div className="detail-item">
              <strong>Duration:</strong> {data.stepConfig.event_config.duration.distribution?.mean || 1} days
            </div>
          )}
          {data.stepConfig?.event_config?.resource_requirements?.length > 0 && (
            <div className="detail-item">
              <strong>Resources:</strong> {data.stepConfig.event_config.resource_requirements.length}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Decide Node Component - Diamond with cascading handles like Arena
export const DecideNode = ({ data, selected }) => {
  const allOutcomes = data.stepConfig?.decide_config?.outcomes || [];
  // Filter out outcomes with empty next_step_id (orphaned connections)
  const activeOutcomes = allOutcomes.filter(outcome => outcome.next_step_id && outcome.next_step_id.trim() !== "");
  // Only show handles for active outcomes + 1 always-available handle for new connections
  const actualOutcomes = activeOutcomes.length;
  const totalHandles = actualOutcomes + 1; // +1 for the always-available handle
  
  // Fixed diamond position - always centered in a 120px height area
  const fixedDiamondTop = 20; // Fixed top position for diamond (20px from top)
  const diamondHeight = 80; // Diamond height
  const diamondCenterY = fixedDiamondTop + (diamondHeight / 2); // Center of diamond
  
  // Start handles closer to diamond's right angle, not below it
  const handleStartTop = diamondCenterY + 5; // Start 5px below diamond center (right angle area)
  const handleSpacing = 15; // Closer spacing between handles
  
  const renderHandles = () => {
    const handles = [];
    
    // Render handles for existing outcomes only
    for (let i = 0; i < actualOutcomes; i++) {
      const topPosition = handleStartTop + (i * handleSpacing);
      handles.push(
        <Handle
          key={`outcome-${i}`}
          type="source"
          position={Position.Right}
          id={`outcome-${i}`}
          style={{ 
            right: '-12px', 
            top: `${topPosition}px`
          }}
          className="outcome-handle"
        />
      );
    }
    
    // Always-available handle at the bottom for new connections
    const newHandleTop = handleStartTop + (actualOutcomes * handleSpacing);
    handles.push(
      <Handle
        key="new-outcome"
        type="source"
        position={Position.Right}
        id={`outcome-${actualOutcomes}`}
        style={{ 
          right: '-12px', 
          top: `${newHandleTop}px`
        }}
        className="new-outcome-handle"
      />
    );
    
    return handles;
  };
  
  // Calculate total height needed for the node
  const nodeHeight = Math.max(120, handleStartTop + ((totalHandles) * handleSpacing) + 20); // Min 120px, +20 for bottom padding
  
  return (
    <div 
      className={`custom-node decide-step-node ${selected ? 'selected' : ''}`}
      style={{ height: `${nodeHeight}px` }}
    >
      <Handle type="target" position={Position.Left} style={{ left: '-12px', top: `${diamondCenterY}px` }} />
      <div className="diamond-shape" style={{ top: `${fixedDiamondTop}px`, left: '50%', marginTop: '0px', marginLeft: '-60px' }}>
        <div className="diamond-content">
          <div className="node-title">Decision</div>
        </div>
      </div>
      
      {/* Cascading handles on the right, similar to Arena */}
      {renderHandles()}
    </div>
  );
};

// Assign Node Component - Green rectangle for Arena-style assignments
export const AssignNode = ({ data, selected }) => {
  const assignments = data.stepConfig?.assign_config?.assignments || [];
  
  return (
    <div className={`custom-node assign-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-content">
        <div className="node-title">Assign</div>
        {assignments.length > 0 && (
          <div className="node-subtitle">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Release Node Component - Dispose shape (rectangle with angled side)
export const ReleaseNode = ({ data, selected }) => {
  return (
    <div className={`custom-node release-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="dispose-shape">
        <div className="dispose-content">
          <div className="node-title">Release</div>
          <div className="node-details">
            <div className="detail-item">End of flow</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Create Node Component - Circle shape (Arena-style Create module)
export const CreateNode = ({ data, selected }) => {
  const createConfig = data.stepConfig?.create_config || {};
  const entityTable = createConfig.entity_table || 'Entities';
  const interarrivalTime = createConfig.interarrival_time?.distribution || {};
  
  return (
    <div className={`custom-node create-step-node ${selected ? 'selected' : ''}`}>
      <div className="create-shape">
        <div className="create-content">
          <div className="node-title">Create</div>
          <div className="node-subtitle">{entityTable}</div>
          <div className="node-details">
            {interarrivalTime.type && (
              <div className="detail-item">
                <strong>{interarrivalTime.type}</strong>
                {interarrivalTime.scale && ` (${interarrivalTime.scale})`}
                {interarrivalTime.mean && ` (${interarrivalTime.mean}±${interarrivalTime.stddev || 0})`}
              </div>
            )}
            {createConfig.max_entities && createConfig.max_entities !== 'n/a' && (
              <div className="detail-item">Max: {createConfig.max_entities}</div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Node types definition
export const nodeTypes = {
  process: ProcessNode,
  decide: DecideNode,
  assign: AssignNode,
  release: ReleaseNode,
  create: CreateNode,
};