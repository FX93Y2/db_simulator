import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Tab, Nav, Button, Spinner, Modal, Form } from 'react-bootstrap';
import { FiDatabase, FiActivity, FiBarChart2, FiArrowLeft, FiEdit, FiPlay } from 'react-icons/fi';

import DbConfigEditor from './DbConfigEditor';
import SimConfigEditor from './SimConfigEditor';
import ResultsViewer from './ResultsViewer';
import { getProject, updateProject, formatDate, getProjectDbConfig, getProjectSimConfig } from '../../utils/projectApi';

// Cache for project data to reduce loading flicker
const projectCache = {};

const ProjectPage = ({ theme }) => {
  const { projectId, resultId, activeTab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [project, setProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [existingResults, setExistingResults] = useState([]);
  
  // Set default active tab based on URL or parameter
  const determineActiveTab = useCallback(() => {
    if (location.pathname.includes('/results/')) {
      // If viewing results, don't select any tab
      return 'none';
    } else if (activeTab) {
      return activeTab;
    } else {
      return 'database';
    }
  }, [location.pathname, activeTab]);
  
  const [currentTab, setCurrentTab] = useState(determineActiveTab());

  // Memoize the loadProject function
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

  // Load existing simulation results for this project
  const loadExistingResults = useCallback(async () => {
    if (!projectId) return;
    
    try {
      console.log(`Scanning for existing simulation results for project: ${projectId}`);
      
      const results = await window.api.scanProjectResults(projectId);
      
      if (results.success && results.results) {
        console.log(`Found ${results.results.length} existing results:`, results.results);
        setExistingResults(results.results);
        
        // If we have a resultId in the URL, set it as the current result
        if (resultId && !simulationResult) {
          const matchingResult = results.results.find(r => r.id === resultId);
          if (matchingResult) {
            setSimulationResult({
              database_path: matchingResult.path
            });
          }
        }
      } else {
        console.log("No existing results found or error scanning:", results.error);
        setExistingResults([]);
      }
    } catch (error) {
      console.error("Error scanning for existing results:", error);
      setExistingResults([]);
    }
  }, [projectId, resultId]);

  // Effect to load project data
  useEffect(() => {
    setInitialLoad(true);
    loadProject();
    
    // Update active tab based on URL changes
    setCurrentTab(determineActiveTab());
  }, [projectId, loadProject, determineActiveTab]);
  
  // Separate effect for loading existing results that only runs when project changes
  useEffect(() => {
    if (projectId) {
      loadExistingResults();
    }
  }, [projectId, loadExistingResults]);

  const handleTabChange = (tabKey) => {
    setCurrentTab(tabKey);
    
    // Update URL to reflect the active tab
    navigate(`/project/${projectId}/${tabKey}`);
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

  // Add a function to run the simulation
  const handleRunSimulation = async () => {
    if (!projectId) return;
    
    try {
      setRunningSimulation(true);
      
      // First, ensure we have both database and simulation configurations
      const dbConfigResult = await getProjectDbConfig(projectId);
      const simConfigResult = await getProjectSimConfig(projectId);
      
      if (!dbConfigResult.success || !dbConfigResult.config) {
        alert('Database configuration not found. Please create and save a database configuration first.');
        setRunningSimulation(false);
        return;
      }
      
      if (!simConfigResult.success || !simConfigResult.config) {
        alert('Simulation configuration not found. Please create and save a simulation configuration first.');
        setRunningSimulation(false);
        return;
      }
      
      // Create a timestamp for the database name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dbName = `${project.name.replace(/\s+/g, '_')}_${timestamp}`;
      
      console.log("Running simulation with project ID:", projectId);
      
      // Call the generate-simulate API endpoint
      const result = await window.api.generateAndSimulate({
        db_config_id: dbConfigResult.config.id,
        sim_config_id: simConfigResult.config.id,
        project_id: projectId, // Pass the project_id to ensure proper directory structure
        output_dir: 'output',
        name: dbName
      });
      
      if (result.success) {
        setSimulationResult(result);
        console.log("Simulation completed with result:", result);
        alert('Simulation completed successfully!');
        
        // Refresh the existing results list
        await loadExistingResults();
        
        // Navigate to the results page
        if (result.database_path) {
          // Extract the database file name for the result ID
          const dbPath = result.database_path;
          const resultId = dbPath.split(/[\/\\]/).pop().replace('.db', '');
          console.log("Navigating to results with ID:", resultId);
          
          // Add navigation state to signal that we should refresh results and expand the project
          navigate(`/project/${projectId}/results/${resultId}`, { 
            state: { 
              refreshProjects: true, 
              expandProject: projectId,
              newResult: resultId
            }
          });
        }
      } else {
        console.error("Simulation failed:", result.error);
        alert(`Error running simulation: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error running simulation:', error);
      alert('Error running simulation. Check console for details.');
    } finally {
      setRunningSimulation(false);
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
          <h2 className="mb-0 me-2">{project?.name || 'Project'}</h2>
          <Button
            size="sm"
            className="ms-2 btn-custom-toolbar"
            onClick={handleEditProjectName}
            title="Edit project name"
          >
            <FiEdit />
          </Button>
        </div>
      </div>

      {/* Show ResultsViewer if we're on a results page */}
      {resultId ? (
        <ResultsViewer projectId={projectId} isProjectTab={false} />
      ) : (
        <Tab.Container 
          activeKey={currentTab}
          onSelect={handleTabChange}
        >
          <div className="project-tabs-wrapper">
            <div className="d-flex justify-content-between align-items-center border-bottom">
              <Nav variant="tabs" className="project-tabs flex-grow-1">
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
              </Nav>
              <Button
                className="ms-auto run-simulation-btn"
                onClick={handleRunSimulation}
                disabled={runningSimulation}
              >
                {runningSimulation ? (
                  <>
                    <Spinner size="sm" className="me-2" animation="border" />
                    Running...
                  </>
                ) : (
                  <>
                    <FiPlay className="me-2" /> Run Simulation
                  </>
                )}
              </Button>
            </div>

            <Tab.Content className="project-tab-content">
              <Tab.Pane eventKey="database">
                <DbConfigEditor projectId={projectId} isProjectTab={true} theme={theme} />
              </Tab.Pane>
              <Tab.Pane eventKey="simulation">
                <SimConfigEditor projectId={projectId} isProjectTab={true} theme={theme} />
              </Tab.Pane>
            </Tab.Content>
          </div>
        </Tab.Container>
      )}

      {/* Edit Project Modal */}
      <Modal show={showEditModal} onHide={handleCloseEditModal} centered>
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
            className="btn-custom-toolbar"
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