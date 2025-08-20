import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiPlus, FiMinus } from 'react-icons/fi';
import { ReactComponent as CircleSVG } from '../../../assets/svg/circle.svg';
import { ReactComponent as RectangleSVG } from '../../../assets/svg/rectangle.svg';
import { ReactComponent as DiamondSVG } from '../../../assets/svg/diamond.svg';
import { ReactComponent as PentagonSVG } from '../../../assets/svg/pentagon.svg';

// Process (Event) Node Component - Rectangle with step_id visible
export const ProcessNode = ({ data, selected }) => {
  return (
    <div className={`custom-node process-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="process-shape">
        <RectangleSVG className="node-svg" />
        <div className="node-content-overlay">
          <div className="node-label">{data.stepConfig?.step_id || "Event"}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Decide Node Component - Diamond with step_id visible and cascading handles
export const DecideNode = ({ data, selected }) => {
  const allOutcomes = data.stepConfig?.decide_config?.outcomes || [];
  const decisionType = data.stepConfig?.decide_config?.decision_type || '2way-chance';
  
  // Filter out outcomes with empty next_step_id (orphaned connections)
  const activeOutcomes = allOutcomes.filter(outcome => outcome.next_step_id && outcome.next_step_id.trim() !== "");
  
  // For 2-way decisions, we always show exactly 2 handles (right + below)
  // For N-way decisions, show handles for active outcomes + 1 always-available handle
  const is2Way = decisionType.startsWith('2way');
  const actualOutcomes = activeOutcomes.length;
  const totalHandles = is2Way ? 2 : actualOutcomes + 1;
  
  // Calculate handle positions
  const handleSpacing = 15;
  const handleStartTop = 50; // Center of diamond area
  
  const renderHandles = () => {
    const handles = [];
    
    if (is2Way) {
      // For 2-way decisions: one handle on right, one "else" handle below
      const primaryOutcome = activeOutcomes[0];
      const elseOutcome = activeOutcomes[1];
      
      // Generate tooltip text for primary handle
      let primaryTooltip = "Primary outcome";
      if (primaryOutcome?.conditions?.[0]) {
        const condition = primaryOutcome.conditions[0];
        if (condition.if === 'Probability') {
          primaryTooltip = `${(condition.value * 100).toFixed(0)}% chance`;
        } else {
          primaryTooltip = `${condition.name || 'Attribute'} ${condition.is} ${condition.value}`;
        }
      }
      
      // Generate tooltip text for else handle
      let elseTooltip = "Else outcome";
      if (decisionType === '2way-chance' && primaryOutcome?.conditions?.[0]?.if === 'Probability') {
        const elseProb = 1 - (primaryOutcome.conditions[0].value || 0.5);
        elseTooltip = `${(elseProb * 100).toFixed(0)}% chance (else)`;
      }
      
      handles.push(
        <Handle
          key="outcome-0"
          type="source"
          position={Position.Right}
          id="outcome-0"
          title={primaryTooltip}
          style={{ 
            right: '-6px', 
            top: '50%'
          }}
          className="outcome-handle"
        />
      );
      
      handles.push(
        <Handle
          key="outcome-1"
          type="source"
          position={Position.Bottom}
          id="outcome-1"
          title={elseTooltip}
          style={{ 
            bottom: '-6px',
            left: '50%'
          }}
          className="outcome-handle outcome-else"
        />
      );
    } else {
      // For N-way decisions: cascading handles on right + new handle
      for (let i = 0; i < actualOutcomes; i++) {
        const outcome = activeOutcomes[i];
        const topPosition = handleStartTop + (i * handleSpacing);
        
        // Generate tooltip text for N-way handles
        let tooltip = `Outcome ${i + 1}`;
        if (outcome?.conditions?.[0]) {
          const condition = outcome.conditions[0];
          if (condition.if === 'Probability') {
            tooltip = `${(condition.value * 100).toFixed(0)}% chance`;
          } else {
            tooltip = `${condition.name || 'Attribute'} ${condition.is} ${condition.value}`;
          }
        }
        
        handles.push(
          <Handle
            key={`outcome-${i}`}
            type="source"
            position={Position.Right}
            id={`outcome-${i}`}
            title={tooltip}
            style={{ 
              right: '-6px', 
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
          title="Connect to add new outcome"
          style={{ 
            right: '-6px', 
            top: `${newHandleTop}px`
          }}
          className="new-outcome-handle"
        />
      );
    }
    
    return handles;
  };
  
  // Calculate total height needed for the node
  const nodeHeight = is2Way ? 80 : Math.max(80, handleStartTop + ((totalHandles) * handleSpacing) + 20);
  
  return (
    <div 
      className={`custom-node decide-step-node ${selected ? 'selected' : ''}`}
      style={{ height: `${nodeHeight}px` }}
    >
      <Handle type="target" position={Position.Left} style={{ left: '-6px', top: '50%' }} />
      <div className="decide-shape">
        <DiamondSVG className="node-svg" />
        <div className="node-content-overlay">
          <div className="node-label">{data.stepConfig?.step_id || "Decide"}</div>
        </div>
      </div>
      
      {/* Cascading handles on the right */}
      {renderHandles()}
    </div>
  );
};

// Assign Node Component - Pentagon with step_id visible
export const AssignNode = ({ data, selected }) => {
  return (
    <div className={`custom-node assign-step-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="assign-shape">
        <PentagonSVG className="node-svg" />
        <div className="node-content-overlay">
          <div className="node-label">{data.stepConfig?.step_id || "Assign"}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Release Node Component - Circle with minus symbol, tooltip for step_id
export const ReleaseNode = ({ data, selected }) => {
  return (
    <div 
      className={`custom-node release-step-node ${selected ? 'selected' : ''}`}
      title={data.stepConfig?.step_id || "Release"} // Tooltip
    >
      <Handle type="target" position={Position.Left} />
      <div className="release-shape">
        <CircleSVG className="node-svg" />
        <div className="node-content-overlay">
          <FiMinus className="node-icon" size={24} />
        </div>
      </div>
    </div>
  );
};

// Create Node Component - Circle with plus symbol, tooltip for step_id
export const CreateNode = ({ data, selected }) => {
  return (
    <div 
      className={`custom-node create-step-node ${selected ? 'selected' : ''}`}
      title={data.stepConfig?.step_id || "Create"} // Tooltip
    >
      <div className="create-shape">
        <CircleSVG className="node-svg" />
        <div className="node-content-overlay">
          <FiPlus className="node-icon" size={24} />
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