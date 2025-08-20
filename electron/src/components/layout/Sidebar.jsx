import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPlus, FiTrash2, FiChevronDown, FiChevronRight, FiDatabase, FiTable } from 'react-icons/fi';
import { Button, Spinner, Modal, Form, Dropdown } from 'react-bootstrap';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getProjects, formatDate, createDefaultProject, deleteProject, updateProject, updateProjectOrder } from '../../utils/projectApi';
import { FiEdit } from 'react-icons/fi';
import { useToastContext } from '../../contexts/ToastContext';
import { createSafeNavigate } from '../../utils/navigationHelper';
import ConfirmationModal from '../shared/ConfirmationModal';

// Context Menu component that renders in a portal
const ContextMenu = ({ visible, x, y, onEdit, onDelete, onClose }) => {
  if (!visible) return null;

  // Ensure position doesn't go off screen
  const adjustedX = Math.min(x, window.innerWidth - 160); // Account for menu width
  const adjustedY = Math.min(y, window.innerHeight - 80); // Account for menu height

  const contextMenuElement = (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        zIndex: 10000, // Higher than sidebar z-index
        backgroundColor: 'var(--theme-card-bg)',
        border: '1px solid var(--theme-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        minWidth: '150px',
        animation: 'contextMenuFadeIn 0.15s ease-out'
      }}
    >
      <div
        className="context-menu-item"
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
          borderBottom: '1px solid var(--theme-border)'
        }}
        onClick={onEdit}
        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
      >
        <FiEdit className="me-2" />
        Edit Name
      </div>
      <div
        className="context-menu-item"
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          color: '#dc3545'
        }}
        onClick={onDelete}
        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--theme-hover-bg)'}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
      >
        <FiTrash2 className="me-2" />
        Delete Project
      </div>
    </div>
  );

  return ReactDOM.createPortal(contextMenuElement, document.body);
};

const ProjectSidebar = ({ theme = 'light', visible = true }) => {
  const { showSuccess, showError } = useToastContext();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit project name modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteResultModal, setShowDeleteResultModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [resultToDelete, setResultToDelete] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deletingResult, setDeletingResult] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedResults, setExpandedResults] = useState({});
  const [projectResults, setProjectResults] = useState({});
  const [resultTables, setResultTables] = useState({});
  // Track if sidebar is in compact mode
  const [isCompact, setIsCompact] = useState(false);
  // Context menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, project: null });
  
  const navigate = useNavigate();
  const safeNavigate = createSafeNavigate(navigate);
  const location = useLocation();
  
  // Get currently selected project ID from the URL
  const currentProjectId = location.pathname.startsWith('/project/') 
    ? location.pathname.split('/project/')[1].split('/')[0]
    : null;
    
  // Get currently selected result ID from the URL
  const currentResultId = location.pathname.includes('/results/') 
    ? location.pathname.split('/results/')[1].split('/')[0]
    : null;
  
  // Get currently selected table from the URL query parameter
  const currentTable = new URLSearchParams(location.search).get('table');

  // Listen for custom refreshProjects event to trigger a sidebar refresh
  React.useEffect(() => {
    const handler = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('refreshProjects', handler);
    return () => {
      window.removeEventListener('refreshProjects', handler);
    };
  }, []);
  
  // Listen for project-specific result refresh events
  React.useEffect(() => {
    const handler = (event) => {
      const { projectId } = event.detail;
      
      // If this is the current project, refresh its results and expand it
      if (projectId === currentProjectId) {
        setResultsRefreshTrigger(prev => prev + 1);
        setExpandedProjects(prev => ({
          ...prev,
          [projectId]: true
        }));
      }
    };
    
    window.addEventListener('refreshProjectResults', handler);
    return () => {
      window.removeEventListener('refreshProjectResults', handler);
    };
  }, [currentProjectId]);
  
  // Add this to keep track of when to reload
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [resultsRefreshTrigger, setResultsRefreshTrigger] = useState(0);

  // Check sidebar width and set compact mode if below threshold
  useEffect(() => {
    const handleResize = () => {
      // Get sidebar element
      const sidebar = document.querySelector('.app-sidebar');
      if (sidebar) {
        setIsCompact(sidebar.offsetWidth < 200);
      }
    };

    // Set initial value
    handleResize();

    // Add resize observer to detect width changes in the sidebar
    const resizeObserver = new ResizeObserver(handleResize);
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) {
      resizeObserver.observe(sidebar);
    }

    return () => {
      if (sidebar) {
        resizeObserver.unobserve(sidebar);
      }
      resizeObserver.disconnect();
    };
  }, []);
  
  // Refresh projects when location changes or refresh trigger changes
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second delay between retries
    
    const loadProjects = async (isInitialLoad = false) => {
      try {
        if (mounted) {
          if (isInitialLoad || projects.length === 0) {
            setLoading(true);
          } else {
            setIsRefreshing(true);
          }
        }
        
        // Load projects from API
        const projectsResult = await getProjects();
        
        if (projectsResult.success) {
          if (mounted) {
            setProjects(projectsResult.projects || []);
            // Reset retry count on success
            retryCount = 0;
          }
        } else {
          // No projects returned or API error
          
          // If this is the initial app load, retry a few times
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(() => loadProjects(isInitialLoad), retryDelay);
            return;
          }
          
          // Only clear projects if this is initial load, otherwise keep existing projects
          if (mounted && (isInitialLoad || projects.length === 0)) {
            setProjects([]);
          }
        }
      } catch (error) {
        
        // If this is the initial app load, retry a few times
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => loadProjects(isInitialLoad), retryDelay);
          return;
        }
        
        // Only clear projects if this is initial load, otherwise keep existing projects
        if (mounted && (isInitialLoad || projects.length === 0)) {
          setProjects([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };
    
    // Add a small initial delay on first load to ensure backend is ready
    const initialLoadDelay = 200; // Reduced delay for better UX
    const timer = setTimeout(() => loadProjects(true), initialLoadDelay);
    
    // Cleanup function
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [location.pathname, refreshTrigger]);
  
  // Add this to check for refresh signal from location state
  useEffect(() => {
    if (!location.state) return;
    
    
    if (location.state.refreshProjects) {
      // Trigger a refresh of projects list
      setRefreshTrigger(prev => prev + 1);
    }
    
    // Check if we should expand a project
    if (location.state.expandProject) {
      const projectId = location.state.expandProject;
      
      // Force a refresh of the results list, then expand
      setResultsRefreshTrigger(prev => prev + 1);
      
      // Set the project to expanded immediately for better UX
      setExpandedProjects(prev => ({
        ...prev,
        [projectId]: true
      }));
    }
    
    // Clear the state so it doesn't trigger again
    window.history.replaceState({}, document.title);
  }, [location.state]);
  
  // Add a separate effect to handle results refreshing
  useEffect(() => {
    if (resultsRefreshTrigger === 0) return; // Skip initial render
    
    const refreshResults = async () => {
      // Get the current project ID from the URL
      if (!currentProjectId) return;
      
      
      try {
        // Slight delay to ensure file system has completed writing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Load the latest results
        const results = await window.api.scanProjectResults(currentProjectId);
        
        if (results.success) {
          setProjectResults(prev => ({
            ...prev,
            [currentProjectId]: results.results || []
          }));
        }
      } catch (error) {
      }
    };
    
    refreshResults();
  }, [resultsRefreshTrigger, currentProjectId]);
  
  const handleOpenProject = (projectId) => {
    safeNavigate(`/project/${projectId}`);
  };
  
  const handleOpenCreateModal = () => {
    setNewProjectName('');
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      showError('Please enter a project name');
      return;
    }

    try {
      setCreatingProject(true);
      const result = await createDefaultProject(newProjectName.trim());
      
      if (result.success) {
        // Add the new project to the list with proper order
        if (result.project) {
          const newProject = {
            ...result.project,
            display_order: projects.length // Add to end
          };
          setProjects([...projects, newProject]);
        }
        
        // Force a refresh of the projects list
        setRefreshTrigger(prev => prev + 1);
        
        handleCloseCreateModal();
        // Navigate to the new project
        safeNavigate(`/project/${result.project.id}`);
      } else {
        showError('Failed to create project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      showError('Error creating project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteClick = (e, project) => {
    e.stopPropagation(); // Prevent opening the project when clicking delete
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setProjectToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      setDeletingProject(true);
      const result = await deleteProject(projectToDelete.id);
      
      if (result.success) {
        // Remove the deleted project from the list
        setProjects(projects.filter(p => p.id !== projectToDelete.id));
        
        // If we're currently viewing this project, navigate to home
        if (projectToDelete.id === currentProjectId) {
          // Clear unsaved changes state since user confirmed deletion
          if (window.__unsavedChangesState) {
            window.__unsavedChangesState.hasUnsavedChanges = false;
          }
          // Use regular navigate since user already confirmed deletion
          navigate('/');
        }
        
        // Force a refresh of the projects list
        setRefreshTrigger(prev => prev + 1);
        
        handleCloseDeleteModal();
      } else {
        showError('Failed to delete project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      showError('Error deleting project');
    } finally {
      setDeletingProject(false);
    }
  };
  
  // Toggle project expansion
  const toggleProjectExpansion = async (projectId) => {
    const newExpandedState = { ...expandedProjects };
    
    // If toggling to expanded and we don't have results yet, load them
    if (!expandedProjects[projectId]) {
      try {
        const results = await window.api.scanProjectResults(projectId);
        
        if (results.success) {
          setProjectResults({
            ...projectResults,
            [projectId]: results.results || []
          });
        }
      } catch (error) {
      }
    }
    
    newExpandedState[projectId] = !expandedProjects[projectId];
    setExpandedProjects(newExpandedState);
  };
  
  // Toggle result expansion
  const toggleResultExpansion = async (projectId, resultId) => {
    const resultKey = `${projectId}-${resultId}`;
    const newExpandedState = { ...expandedResults };
    
    // If toggling to expanded and we don't have tables yet, load them
    if (!expandedResults[resultKey]) {
      try {
        // Construct the database path
        const dbPath = `output/${projectId}/${resultId}.db`;
        
        // Get list of tables in the database
        const tablesResult = await window.api.getDatabaseTables(dbPath);
        if (tablesResult.success && tablesResult.tables) {
          setResultTables({
            ...resultTables,
            [resultKey]: tablesResult.tables || []
          });
        }
      } catch (error) {
      }
    }
    
    newExpandedState[resultKey] = !expandedResults[resultKey];
    setExpandedResults(newExpandedState);
  };
  
  // Handle result click
  const handleResultClick = (projectId, resultId) => {
    safeNavigate(`/project/${projectId}/results/${resultId}`);
  };
  
  // Handle table click
  const handleTableClick = (projectId, resultId, table) => {
    // Navigate to the result page but with a specific table selected
    safeNavigate(`/project/${projectId}/results/${resultId}?table=${table}`);
  };
  
  // Handle delete result click
  const handleDeleteResultClick = (e, projectId, result) => {
    e.stopPropagation(); // Prevent opening the result when clicking delete
    setResultToDelete({ projectId, result });
    setShowDeleteResultModal(true);
  };
  
  const handleCloseDeleteResultModal = () => {
    setShowDeleteResultModal(false);
    setResultToDelete(null);
  };
  
  const handleConfirmDeleteResult = async () => {
    if (!resultToDelete) return;
    
    try {
      setDeletingResult(true);
      const { projectId, result } = resultToDelete;
      
      // Construct the path to the result database
      const dbPath = `output/${projectId}/${result.id}.db`;
      
      // Call the correct API function with the path
      const deleteResponse = await window.api.deleteResult(dbPath);
      
      if (deleteResponse.success) {
        // Remove the deleted result from the list
        const updatedResults = (projectResults[projectId] || []).filter(r => r.id !== result.id);
        setProjectResults({
          ...projectResults,
          [projectId]: updatedResults
        });
        
        // If we're currently viewing this result, navigate back to project
        if (currentResultId === result.id) {
          safeNavigate(`/project/${projectId}`);
        }
        
        handleCloseDeleteResultModal();
      } else {
        showError('Failed to delete result: ' + (deleteResponse.error || 'Unknown error'));
      }
    } catch (error) {
      showError('Error deleting result');
    } finally {
      setDeletingResult(false);
    }
  };

  // Handle drag end for projects reordering
  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(projects);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for smooth UX
    setProjects(items);
    
    // Persist the new order to the backend
    try {
      const projectIds = items.map(project => project.id);
      const result = await updateProjectOrder(projectIds);
      
      if (!result.success) {
        showError('Failed to save project order');
        // Optionally reload projects to restore original order
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      showError('Error saving project order');
      // Optionally reload projects to restore original order
      setRefreshTrigger(prev => prev + 1);
    }
  };

  // Handle right-click context menu
  const handleProjectContextMenu = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      project: project
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, project: null });
  };

  // Handle context menu edit
  const handleContextEdit = () => {
    const project = contextMenu.project;
    setProjectToEdit(project);
    setEditingProjectName(project.name);
    setShowEditModal(true);
    closeContextMenu();
  };

  // Handle context menu delete
  const handleContextDelete = () => {
    const project = contextMenu.project;
    // Create a fake event object since handleDeleteClick expects an event
    const fakeEvent = { stopPropagation: () => {} };
    handleDeleteClick(fakeEvent, project);
    closeContextMenu();
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);
  
  return (
    <div className={`app-sidebar ${visible ? 'visible' : 'hidden'}`}>
      <div className="sidebar-header">
        <h5 className={`sidebar-title ${isCompact ? 'text-truncate' : ''}`}>
          {isCompact ? 'Explorer' : 'Database Explorer'}
        </h5>
        <div className="sidebar-header-actions">
          <button 
            className="sidebar-action-button"
            onClick={handleOpenCreateModal}
            title="Create New Database"
          >
            <div className="compound-icon">
              <FiDatabase className="base-icon" />
              <FiPlus className="overlay-icon" />
            </div>
          </button>
        </div>
      </div>
      
      {loading && projects.length === 0 ? (
        <div className="sidebar-loading">
          <Spinner animation="border" size="sm" className="me-2" />
          {!isCompact && 'Loading projects...'}
        </div>
      ) : (
        <div className={`sidebar-projects ${isRefreshing ? 'refreshing' : ''}`}>
          {projects.length === 0 ? (
            <div className="no-projects">
              {isCompact ? 'No projects' : 'No projects found. Create your first project!'}
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
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
                            <div
                              {...provided.dragHandleProps}
                              className={`project-item ${project.id === currentProjectId ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                              onContextMenu={(e) => handleProjectContextMenu(e, project)}
                            >
                              <div className="project-item-expand-icon" onClick={() => toggleProjectExpansion(project.id)}>
                                {expandedProjects[project.id] ? <FiChevronDown /> : <FiChevronRight />}
                              </div>
                              <div
                                className="project-item-content"
                                onClick={() => handleOpenProject(project.id)}
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
                
                {/* Results list */}
                {expandedProjects[project.id] && (
                  <div className="project-results-list">
                    {projectResults[project.id] && projectResults[project.id].length > 0 ? (
                      projectResults[project.id].map((result) => {
                        const resultKey = `${project.id}-${result.id}`;
                        const isActive = currentResultId === result.id;
                        
                        return (
                          <div key={result.id} className="database-explorer-container">
                            <div 
                              className={`project-result-item ${isActive ? 'active' : ''}`}
                            >
                              <div className="project-item-expand-icon" onClick={(e) => {
                                e.stopPropagation();
                                toggleResultExpansion(project.id, result.id);
                              }}>
                                {expandedResults[resultKey] ? <FiChevronDown /> : <FiChevronRight />}
                              </div>
                              <div className="result-item-icon">
                                <FiDatabase />
                              </div>
                              <div 
                                className="result-item-content"
                                onClick={() => handleResultClick(project.id, result.id)}
                              >
                                <div className={`result-item-name ${isCompact ? 'text-truncate' : ''}`}>
                                  {new Date(result.created).toLocaleString()}
                                </div>
                              </div>
                              <Button 
                                variant="outline-danger"
                                size="sm"
                                className="result-delete-btn"
                                onClick={(e) => handleDeleteResultClick(e, project.id, result)}
                              >
                                <FiTrash2 />
                              </Button>
                            </div>
                            
                            {/* Tables list */}
                            {expandedResults[resultKey] && (
                              <div className="database-tables-list">
                                {resultTables[resultKey] && resultTables[resultKey].length > 0 ? (
                                  resultTables[resultKey].map((table) => {
                                    // Check if this table is the currently selected one
                                    const isTableActive = currentTable === table;
                                    return (
                                      <div 
                                        key={table} 
                                        // Add 'active' class if this table matches the URL query param
                                        className={`database-table-item ${isTableActive ? 'active' : ''}`}
                                        onClick={() => handleTableClick(project.id, result.id, table)}
                                      >
                                        <div className="table-item-icon">
                                          <FiTable />
                                        </div>
                                        <div className={`table-item-name ${isCompact ? 'text-truncate' : ''}`}>
                                          {table}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="no-tables">
                                    {isCompact ? 'No tables' : 'No tables found'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-results">
                        {isCompact ? 'No results' : 'No simulation results found'}
                      </div>
                    )}
                  </div>
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
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal show={showCreateModal} onHide={handleCloseCreateModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create New Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Project Name</Form.Label>
            <Form.Control
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseCreateModal}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateProject}
            disabled={creatingProject}
          >
            {creatingProject ? <Spinner size="sm" animation="border" className="me-2" /> : <FiPlus className="me-2" />}
            Create Project
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Project Modal */}
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
      
      {/* Delete Result Modal */}
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

      {/* Edit Project Name Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Project Name</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Project Name</Form.Label>
              <Form.Control
                type="text"
                value={editingProjectName}
                onChange={(e) => setEditingProjectName(e.target.value)}
                autoFocus
                disabled={isUpdating}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!editingProjectName.trim() || editingProjectName === projectToEdit?.name) {
                setShowEditModal(false);
                return;
              }
              setIsUpdating(true);
              try {
                const result = await updateProject(projectToEdit.id, { name: editingProjectName });
                if (result.success) {
                  // Update the project in the list
                  setProjects((prev) =>
                    prev.map((p) =>
                      p.id === projectToEdit.id
                        ? { ...p, name: editingProjectName, updated_at: new Date().toISOString() }
                        : p
                    )
                  );
                  setShowEditModal(false);
                } else {
                  showError('Failed to update project name');
                }
              } catch (error) {
                showError('Error updating project name');
              } finally {
                setIsUpdating(false);
              }
            }}
            disabled={isUpdating}
          >
            {isUpdating ? <Spinner animation="border" size="sm" /> : 'Save'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Context Menu Portal */}
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