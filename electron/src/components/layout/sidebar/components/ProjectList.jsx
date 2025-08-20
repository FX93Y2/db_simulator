import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ProjectItem from './ProjectItem';
import ResultsList from './ResultsList';

const ProjectList = ({ 
  projects,
  currentProjectId,
  expandedProjects,
  projectResults,
  expandedResults,
  resultTables,
  currentResultId,
  currentTable,
  isCompact,
  onDragEnd,
  onToggleProjectExpansion,
  onProjectClick,
  onProjectContextMenu,
  onToggleResultExpansion,
  onResultClick,
  onTableClick,
  onDeleteResultClick
}) => {
  if (projects.length === 0) {
    return (
      <div className="no-projects">
        {isCompact ? 'No projects' : 'No projects found. Create your first project!'}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="projects-list">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {projects.map((project, index) => (
              <Draggable key={project.id} draggableId={project.id.toString()} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="project-container"
                  >
                    <ProjectItem
                      project={project}
                      isActive={project.id === currentProjectId}
                      isExpanded={expandedProjects[project.id]}
                      isCompact={isCompact}
                      isDragging={snapshot.isDragging}
                      onToggleExpansion={() => onToggleProjectExpansion(project.id)}
                      onProjectClick={() => onProjectClick(project.id)}
                      onContextMenu={(e) => onProjectContextMenu(e, project)}
                      dragHandleProps={provided.dragHandleProps}
                    />
                    
                    {expandedProjects[project.id] && (
                      <ResultsList
                        projectId={project.id}
                        results={projectResults[project.id]}
                        expandedResults={expandedResults}
                        resultTables={resultTables}
                        currentResultId={currentResultId}
                        currentTable={currentTable}
                        isCompact={isCompact}
                        onToggleResultExpansion={onToggleResultExpansion}
                        onResultClick={onResultClick}
                        onTableClick={onTableClick}
                        onDeleteResultClick={onDeleteResultClick}
                      />
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default ProjectList;