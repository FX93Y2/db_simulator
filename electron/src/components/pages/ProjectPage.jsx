import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Tab, Nav, Button, Spinner, Modal, Form } from 'react-bootstrap';
import { FiDatabase, FiActivity, FiBarChart2, FiArrowLeft, FiEdit } from 'react-icons/fi';

import DbConfigEditor from './DbConfigEditor';
import SimConfigEditor from './SimConfigEditor';
import ResultsViewer from './ResultsViewer';
import { getProject, updateProject, formatDate } from '../../utils/projectApi';

// Cache for project data to reduce loading flicker
const projectCache = {};

const ProjectPage = () => {
  const { projectId, resultId, activeTab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [project, setProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Set default active tab based on URL or parameter
  const determineActiveTab = () => {
    if (location.pathname.includes('/results/')) {
      return 'results';
    } else if (activeTab) {
      return activeTab;
    } else {
      return 'database';
    }
  };
  
  const [currentTab, setCurrentTab] = useState(determineActiveTab());

  const loadProject = useCallback(async () => {
    if (!projectId) {
      navigate('/');
      return;
    }

    try {
      if (initialLoad) {
        setLoading(true);
      }

      // Check cache first for quick loading
      if (projectCache[projectId] && initialLoad) {
        setProject(projectCache[projectId]);
        setLoading(false);
        // Still fetch in background to ensure data is fresh
        const projectResult = await getProject(projectId);
        if (projectResult.success) {
          setProject(projectResult.project);
          projectCache[projectId] = projectResult.project;
        }
        return;
      }

      // For a new project, we'll create it here
      if (projectId === 'new') {
        // Create a new project with default values
        const newProject = {
          name: 'New Project',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProject(newProject);
      } else {
        // Load existing project
        const projectResult = await getProject(projectId);
        if (projectResult.success) {
          setProject(projectResult.project);
          // Cache the project data for future use
          projectCache[projectId] = projectResult.project;
        } else {
          console.error('Failed to load project');
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Error loading project:', error);
      navigate('/');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [projectId, navigate, initialLoad]);

  useEffect(() => {
    setInitialLoad(true);
    loadProject();
    
    // Update active tab based on URL changes
    setCurrentTab(determineActiveTab());
  }, [projectId, loadProject, determineActiveTab]);

  const handleTabChange = (tabKey) => {
    setCurrentTab(tabKey);
    
    // Update URL to reflect the active tab
    if (tabKey === 'results' && resultId) {
      navigate(`/project/${projectId}/results/${resultId}`);
    } else {
      navigate(`/project/${projectId}/${tabKey}`);
    }
  };

  const handleBack = () => {
    navigate('/', { state: { refreshProjects: true }});
  };
  
  const handleEditProjectName = () => {
    if (!project) return;
    setEditingProjectName(project.name);
    setShowEditModal(true);
  };
  
  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };
  
  const handleSaveProjectName = async () => {
    if (!editingProjectName.trim() || editingProjectName === project.name) {
      handleCloseEditModal();
      return;
    }
    
    try {
      setIsUpdating(true);
      // Update project name via API
      const result = await updateProject(projectId, {
        name: editingProjectName
      });
      
      if (result.success) {
        const updatedProject = {
          ...project,
          name: editingProjectName,
          updated_at: new Date().toISOString()
        };
        
        setProject(updatedProject);
        // Update the cache
        projectCache[projectId] = updatedProject;
        
        handleCloseEditModal();
      } else {
        alert('Failed to update project name');
      }
    } catch (error) {
      console.error('Error updating project name:', error);
      alert('Error updating project name');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <div className="mt-2">Loading project...</div>
      </div>
    );
  }

  return (
    <Container fluid className="project-page p-0">
      <div className="project-header mb-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <Button 
            variant="outline-secondary" 
            className="me-3"
            onClick={handleBack}
          >
            <FiArrowLeft /> Back
          </Button>
          <h2 className="mb-0">{project?.name || 'Project'}</h2>
          <Button
            variant="outline-secondary"
            size="sm"
            className="ms-2"
            onClick={handleEditProjectName}
            title="Edit project name"
          >
            <FiEdit />
          </Button>
        </div>
        <div>
          <small className="text-muted">
            Last updated: {formatDate(project?.updated_at).split(' ')[0]}
          </small>
        </div>
      </div>

      <Tab.Container 
        activeKey={currentTab}
        onSelect={handleTabChange}
      >
        <div className="project-tabs-wrapper">
          <Nav variant="tabs" className="project-tabs">
            <Nav.Item>
              <Nav.Link eventKey="database">
                <FiDatabase className="me-2" /> Database Configuration
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="simulation">
                <FiActivity className="me-2" /> Simulation Configuration
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="results" disabled={!resultId}>
                <FiBarChart2 className="me-2" /> Results Visualization
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content className="project-tab-content">
            <Tab.Pane eventKey="database">
              <DbConfigEditor projectId={projectId} isProjectTab={true} />
            </Tab.Pane>
            <Tab.Pane eventKey="simulation">
              <SimConfigEditor projectId={projectId} isProjectTab={true} />
            </Tab.Pane>
            <Tab.Pane eventKey="results">
              {resultId ? (
                <ResultsViewer projectId={projectId} isProjectTab={true} />
              ) : (
                <div className="text-center py-5">
                  <p>No simulation results available. Run a simulation first to see results.</p>
                </div>
              )}
            </Tab.Pane>
          </Tab.Content>
        </div>
      </Tab.Container>

      {/* Edit Project Modal */}
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Project Name</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Project Name</Form.Label>
            <Form.Control
              type="text"
              value={editingProjectName}
              onChange={(e) => setEditingProjectName(e.target.value)}
              placeholder="Enter project name"
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEditModal}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveProjectName}
            disabled={isUpdating}
          >
            {isUpdating ? <Spinner size="sm" animation="border" className="me-2" /> : null}
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProjectPage; 