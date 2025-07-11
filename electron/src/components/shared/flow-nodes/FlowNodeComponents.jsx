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

// Decide Node Component - Diamond
export const DecideNode = ({ data, selected }) => {
  const outcomes = data.stepConfig?.decide_config?.outcomes || [];
  
  return (
    <div className={`custom-node decide-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ left: '0%', top: '50%' }} />
      <div className="diamond-shape">
        <div className="diamond-content">
          <div className="node-title">Decision</div>
        </div>
      </div>
      {/* All source handles on the right point */}
      <Handle type="source" position={Position.Right} id="outcome-0" style={{ right: '0%', top: '45%' }} />
      <Handle type="source" position={Position.Right} id="outcome-1" style={{ right: '0%', top: '55%' }} />
      {outcomes.length > 2 && (
        <Handle type="source" position={Position.Right} id="outcome-2" style={{ right: '0%', top: '50%' }} />
      )}
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
          <div className="node-title">{data.label}</div>
          <div className="node-details">
            <div className="detail-item">End of flow</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Node types definition
export const nodeTypes = {
  process: ProcessNode,
  decide: DecideNode,
  release: ReleaseNode,
};