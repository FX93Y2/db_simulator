import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { Button, Spinner, Modal, Form } from 'react-bootstrap';
import { getProjects, formatDate, createDefaultProject, deleteProject } from '../../utils/projectApi';

const ProjectSidebar = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get currently selected project ID from the URL
  const currentProjectId = location.pathname.startsWith('/project/') 
    ? location.pathname.split('/project/')[1].split('/')[0]
    : null;
  
  // Add this to keep track of when to reload
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
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
    if (location.state?.refreshProjects) {
      // Clear the state so it doesn't trigger again on other navigations
      window.history.replaceState({}, document.title);
      // Trigger a refresh
      setRefreshTrigger(prev => prev + 1);
    }
  }, [location.state]);
  
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
                className={`project-item ${project.id === currentProjectId ? 'active' : ''}`}
              >
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
    </div>
  );
};

export default ProjectSidebar;