import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPlus, FiTrash2, FiChevronDown, FiChevronRight, FiDatabase, FiBarChart2 } from 'react-icons/fi';
import { Button, Spinner, Modal, Form } from 'react-bootstrap';
import { getProjects, formatDate, createDefaultProject, deleteProject } from '../../utils/projectApi';

const ProjectSidebar = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [projectResults, setProjectResults] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get currently selected project ID from the URL
  const currentProjectId = location.pathname.startsWith('/project/') 
    ? location.pathname.split('/project/')[1].split('/')[0]
    : null;
  
  // Add this to keep track of when to reload
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [resultsRefreshTrigger, setResultsRefreshTrigger] = useState(0);
  
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
    navigate(`/project/${projectId}`);
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
      alert('Please enter a project name');
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
        navigate(`/project/${result.project.id}`);
      } else {
        alert('Failed to create project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project');
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
          navigate('/');
        }
        
        // Force a refresh of the projects list
        setRefreshTrigger(prev => prev + 1);
        
        handleCloseDeleteModal();
      } else {
        alert('Failed to delete project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error deleting project');
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
  
  // Handle result click
  const handleResultClick = (projectId, resultId) => {
    navigate(`/project/${projectId}/results/${resultId}`);
  };
  
  // Handle delete result click
  const handleDeleteResultClick = (e, projectId, result) => {
    e.stopPropagation();
    setResultToDelete({ projectId, result });
    setShowDeleteResultModal(true);
  };
  
  // Handle close delete result modal
  const handleCloseDeleteResultModal = () => {
    setShowDeleteResultModal(false);
    setResultToDelete(null);
  };
  
  // Handle confirm delete result
  const handleConfirmDeleteResult = async () => {
    if (!resultToDelete) return;
    
    try {
      setDeletingResult(true);
      const result = await window.api.deleteResult(resultToDelete.result.path);
      
      if (result.success) {
        // Remove the deleted result from the list
        const updatedResults = { ...projectResults };
        updatedResults[resultToDelete.projectId] = updatedResults[resultToDelete.projectId].filter(
          r => r.id !== resultToDelete.result.id
        );
        setProjectResults(updatedResults);
        
        // If we're currently viewing this result, navigate to project page
        const currentPath = location.pathname;
        if (currentPath.includes(`/results/${resultToDelete.result.id}`)) {
          navigate(`/project/${resultToDelete.projectId}`);
        }
        
        handleCloseDeleteResultModal();
      } else {
        alert('Failed to delete result: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting result:', error);
      alert('Error deleting result');
    } finally {
      setDeletingResult(false);
    }
  };
  
  return (
    <div className="app-sidebar">
      <div className="sidebar-header">
        <h5 className="m-0">Projects</h5>
        <div className="d-flex">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={handleOpenCreateModal}
          >
            <FiPlus />
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="sidebar-loading">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading projects...
        </div>
      ) : (
        <div className="sidebar-projects">
          {projects.length === 0 ? (
            <div className="no-projects">No projects found. Create your first project!</div>
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
                    <div className="project-item-name">{project.name}</div>
                    <div className="project-item-date">
                      {formatDate(project.lastUpdated || project.updated_at).split(' ')[0]}
                    </div>
                  </div>
                  <Button 
                    variant="outline-danger"
                    size="sm"
                    className="project-delete-btn"
                    onClick={(e) => handleDeleteClick(e, project)}
                  >
                    <FiTrash2 />
                  </Button>
                </div>
                
                {/* Results list */}
                {expandedProjects[project.id] && (
                  <div className="project-results-list">
                    {projectResults[project.id] && projectResults[project.id].length > 0 ? (
                      projectResults[project.id].map((result) => (
                        <div 
                          key={result.id}
                          className="project-result-item"
                          onClick={() => handleResultClick(project.id, result.id)}
                        >
                          <div className="result-item-icon">
                            <FiBarChart2 />
                          </div>
                          <div className="result-item-content">
                            <div className="result-item-name">
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
                      ))
                    ) : (
                      <div className="no-results">No simulation results found</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal show={showCreateModal} onHide={handleCloseCreateModal}>
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
      <Modal show={showDeleteModal} onHide={handleCloseDeleteModal}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the project "{projectToDelete?.name}"? 
          This action cannot be undone and all associated configurations will be deleted.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleConfirmDelete}
            disabled={deletingProject}
          >
            {deletingProject ? <Spinner size="sm" animation="border" className="me-2" /> : <FiTrash2 className="me-2" />}
            Delete Project
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Delete Result Modal */}
      <Modal show={showDeleteResultModal} onHide={handleCloseDeleteResultModal}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Simulation Result</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this simulation result?</p>
          <p>This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteResultModal}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleConfirmDeleteResult}
            disabled={deletingResult}
          >
            {deletingResult ? <Spinner size="sm" animation="border" className="me-2" /> : <FiTrash2 className="me-2" />}
            Delete Result
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectSidebar;