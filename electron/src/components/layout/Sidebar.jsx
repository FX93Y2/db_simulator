import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPlus, FiTrash2, FiChevronDown, FiChevronRight, FiDatabase, FiTable } from 'react-icons/fi';
import { Button, Spinner, Modal, Form } from 'react-bootstrap';
import { getProjects, formatDate, createDefaultProject, deleteProject, updateProject } from '../../utils/projectApi';
import { FiEdit } from 'react-icons/fi';
import { useToastContext } from '../../contexts/ToastContext';
import { createSafeNavigate } from '../../utils/navigationHelper';
import ConfirmationModal from '../shared/ConfirmationModal';

const ProjectSidebar = ({ theme = 'light' }) => {
  const { showSuccess, showError } = useToastContext();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

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
    
    const loadProjects = async () => {
      try {
        if (mounted) setLoading(true);
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
          console.log("No projects returned or API error, might retry...");
          
          // If this is the initial app load, retry a few times
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying project load (${retryCount}/${maxRetries}) in ${retryDelay}ms...`);
            setTimeout(loadProjects, retryDelay);
            return;
          }
          
          if (mounted) setProjects([]);
        }
      } catch (error) {
        console.error('Error loading projects:', error);
        
        // If this is the initial app load, retry a few times
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying project load after error (${retryCount}/${maxRetries}) in ${retryDelay}ms...`);
          setTimeout(loadProjects, retryDelay);
          return;
        }
        
        if (mounted) setProjects([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    // Add a small initial delay on first load to ensure backend is ready
    const initialLoadDelay = 500; // 500ms delay on first load
    const timer = setTimeout(loadProjects, initialLoadDelay);
    
    // Cleanup function
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [location.pathname, refreshTrigger]);
  
  // Add this to check for refresh signal from location state
  useEffect(() => {
    if (!location.state) return;
    
    console.log("Navigation state detected:", location.state);
    
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
      
      console.log(`Force refreshing results for project: ${currentProjectId}`);
      
      try {
        // Slight delay to ensure file system has completed writing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Load the latest results
        const results = await window.api.scanProjectResults(currentProjectId);
        
        if (results.success) {
          console.log(`Refreshed results, found ${results.results.length} items`);
          setProjectResults(prev => ({
            ...prev,
            [currentProjectId]: results.results || []
          }));
        }
      } catch (error) {
        console.error("Error refreshing project results:", error);
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
        // Add the new project to the list
        if (result.project) {
          setProjects([...projects, result.project]);
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
      console.error('Error creating project:', error);
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
          safeNavigate('/');
        }
        
        // Force a refresh of the projects list
        setRefreshTrigger(prev => prev + 1);
        
        handleCloseDeleteModal();
      } else {
        showError('Failed to delete project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting project:', error);
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
        console.log(`Loading results for project ${projectId}`);
        const results = await window.api.scanProjectResults(projectId);
        
        if (results.success) {
          setProjectResults({
            ...projectResults,
            [projectId]: results.results || []
          });
        }
      } catch (error) {
        console.error("Error loading project results:", error);
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
        console.log(`Loading tables for result ${resultId}`);
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
        console.error("Error loading result tables:", error);
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
      console.log(`Attempting to delete result at path: ${dbPath}`);
      
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
      console.error('Error deleting result:', error);
      showError('Error deleting result');
    } finally {
      setDeletingResult(false);
    }
  };
  
  return (
    <div className="app-sidebar">
      <div className="sidebar-header">
        <h5 className={`m-0 ${isCompact ? 'text-truncate' : ''}`}>
          {isCompact ? 'Explorer' : 'Database Explorer'}
        </h5>
        <div className="d-flex">
          <div 
            className="create-db-button"
            onClick={handleOpenCreateModal}
            title="Create New Database"
          >
            <FiDatabase className="db-icon" />
            <FiPlus className="plus-icon" />
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="sidebar-loading">
          <Spinner animation="border" size="sm" className="me-2" />
          {!isCompact && 'Loading projects...'}
        </div>
      ) : (
        <div className="sidebar-projects">
          {projects.length === 0 ? (
            <div className="no-projects">
              {isCompact ? 'No projects' : 'No projects found. Create your first project!'}
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="project-container"
              >
                <div
                  className={`project-item ${project.id === currentProjectId ? 'active' : ''}`}
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
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="project-edit-btn ms-1"
                    title="Edit project name"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToEdit(project);
                      setEditingProjectName(project.name);
                      setShowEditModal(true);
                    }}
                  >
                    <FiEdit />
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    className="project-delete-btn ms-1"
                    onClick={(e) => handleDeleteClick(e, project)}
                  >
                    <FiTrash2 />
                  </Button>
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
            ))
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
                  // Trigger sidebar refresh
                  window.dispatchEvent(new Event('refreshProjects'));
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
    </div>
  );
};

export default ProjectSidebar;