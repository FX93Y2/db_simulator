import React from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { formatDate } from '../../../../utils/projectApi';

const ProjectItem = ({ 
  project, 
  isActive, 
  isExpanded,
  isCompact,
  isDragging,
  onToggleExpansion,
  onProjectClick,
  onContextMenu,
  dragHandleProps
}) => {
  return (
    <div
      className={`project-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onContextMenu={onContextMenu}
    >
      <div className="project-item-expand-icon" onClick={onToggleExpansion}>
        {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
      </div>
      <div
        {...dragHandleProps}
        className="project-item-content"
        onClick={onProjectClick}
      >
        <div className={`project-item-name ${isCompact ? 'text-truncate' : ''}`}>
          {project.name}
        </div>
        {!isCompact && (
          <div className="project-item-date">
            {formatDate(project.lastUpdated || project.updated_at).split(' ')[0]}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectItem;