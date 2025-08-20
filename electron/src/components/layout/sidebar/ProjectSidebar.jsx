import React, { useState } from 'react';
import { Spinner } from 'react-bootstrap';
import ConfirmationModal from '../../shared/ConfirmationModal';

// Extracted components
import SidebarHeader from './components/SidebarHeader';
import ProjectList from './components/ProjectList';
import ContextMenu from './components/ContextMenu';
import CreateProjectModal from './modals/CreateProjectModal';
import EditProjectModal from './modals/EditProjectModal';

// Extracted hooks
import { useProjectManagement } from './hooks/useProjectManagement';
import { useResultsManagement } from './hooks/useResultsManagement';
import { useSidebarState } from './hooks/useSidebarState';

const ProjectSidebar = ({ theme = 'light', visible = true }) => {
  // Project management
  const {
    projects,
    loading,
    isRefreshing,
    currentProjectId,
    handleOpenProject,
    handleCreateProject,
    handleDeleteProject,
    handleUpdateProject,
    handleDragEnd
  } = useProjectManagement();

  // Results management
  const {
    expandedResults,
    projectResults,
    resultTables,
    currentResultId,
    currentTable,
    loadProjectResults,
    toggleResultExpansion,
    handleResultClick,
    handleTableClick,
    handleDeleteResult
  } = useResultsManagement(currentProjectId);

  // Sidebar state
  const {
    expandedProjects,
    isCompact,
    contextMenu,
    toggleProjectExpansion,
    expandProject,
    handleProjectContextMenu,
    closeContextMenu
  } = useSidebarState();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteResultModal, setShowDeleteResultModal] = useState(false);

  // Form states
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [resultToDelete, setResultToDelete] = useState(null);

  // Loading states
  const [creatingProject, setCreatingProject] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deletingResult, setDeletingResult] = useState(false);

  // Modal handlers
  const handleOpenCreateModal = () => {
    setNewProjectName('');
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleCreateNewProject = async () => {
    setCreatingProject(true);
    try {
      const result = await handleCreateProject(newProjectName);
      if (result.success) {
        handleCloseCreateModal();
      }
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteClick = (e, project) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setProjectToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setDeletingProject(true);
    try {
      const result = await handleDeleteProject(projectToDelete);
      if (result.success) {
        handleCloseDeleteModal();
      }
    } finally {
      setDeletingProject(false);
    }
  };

  const handleDeleteResultClick = (e, projectId, result) => {
    e.stopPropagation();
    setResultToDelete({ projectId, result });
    setShowDeleteResultModal(true);
  };

  const handleCloseDeleteResultModal = () => {
    setShowDeleteResultModal(false);
    setResultToDelete(null);
  };

  const handleConfirmDeleteResult = async () => {
    if (!resultToDelete) return;
    
    setDeletingResult(true);
    try {
      const { projectId, result } = resultToDelete;
      const deleteResult = await handleDeleteResult(projectId, result);
      if (deleteResult.success) {
        handleCloseDeleteResultModal();
      }
    } finally {
      setDeletingResult(false);
    }
  };

  const handleToggleProjectExpansion = (projectId) => {
    toggleProjectExpansion(projectId, loadProjectResults);
  };

  // Context menu handlers
  const handleContextEdit = () => {
    const project = contextMenu.project;
    setProjectToEdit(project);
    setEditingProjectName(project.name);
    setShowEditModal(true);
    closeContextMenu();
  };

  const handleContextDelete = () => {
    const project = contextMenu.project;
    const fakeEvent = { stopPropagation: () => {} };
    handleDeleteClick(fakeEvent, project);
    closeContextMenu();
  };

  const handleUpdateProjectName = async () => {
    setIsUpdating(true);
    try {
      const result = await handleUpdateProject(projectToEdit.id, { name: editingProjectName });
      if (result.success) {
        setShowEditModal(false);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`app-sidebar ${visible ? 'visible' : 'hidden'}`}>
      <SidebarHeader 
        isCompact={isCompact}
        onCreateNew={handleOpenCreateModal}
      />
      
      {loading && projects.length === 0 ? (
        <div className="sidebar-loading">
          <Spinner animation="border" size="sm" className="me-2" />
          {!isCompact && 'Loading projects...'}
        </div>
      ) : (
        <div className={`sidebar-projects ${isRefreshing ? 'refreshing' : ''}`}>
          <ProjectList
            projects={projects}
            currentProjectId={currentProjectId}
            expandedProjects={expandedProjects}
            projectResults={projectResults}
            expandedResults={expandedResults}
            resultTables={resultTables}
            currentResultId={currentResultId}
            currentTable={currentTable}
            isCompact={isCompact}
            onDragEnd={handleDragEnd}
            onToggleProjectExpansion={handleToggleProjectExpansion}
            onProjectClick={handleOpenProject}
            onProjectContextMenu={handleProjectContextMenu}
            onToggleResultExpansion={toggleResultExpansion}
            onResultClick={handleResultClick}
            onTableClick={handleTableClick}
            onDeleteResultClick={handleDeleteResultClick}
          />
        </div>
      )}

      {/* Modals */}
      <CreateProjectModal
        show={showCreateModal}
        onHide={handleCloseCreateModal}
        onCreate={handleCreateNewProject}
        projectName={newProjectName}
        onProjectNameChange={setNewProjectName}
        isCreating={creatingProject}
      />

      <EditProjectModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        onUpdate={handleUpdateProjectName}
        project={projectToEdit}
        projectName={editingProjectName}
        onProjectNameChange={setEditingProjectName}
        isUpdating={isUpdating}
      />

      <ConfirmationModal
        show={showDeleteModal}
        onHide={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete the project "${projectToDelete?.name}"? This action cannot be undone and all associated configurations will be deleted.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        variant="danger"
        theme={theme}
      />
      
      <ConfirmationModal
        show={showDeleteResultModal}
        onHide={handleCloseDeleteResultModal}
        onConfirm={handleConfirmDeleteResult}
        title="Delete Simulation Result"
        message="Are you sure you want to delete this simulation result? This action cannot be undone and all generated data will be lost."
        confirmText="Delete Result"
        cancelText="Cancel"
        variant="danger"
        theme={theme}
      />

      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onEdit={handleContextEdit}
        onDelete={handleContextDelete}
        onClose={closeContextMenu}
      />
    </div>
  );
};

export default ProjectSidebar;