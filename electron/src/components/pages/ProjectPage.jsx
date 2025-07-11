import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Tab, Nav, Button, Spinner, Modal, Form } from 'react-bootstrap';
import { FiDatabase, FiActivity, FiBarChart2, FiArrowLeft, FiEdit, FiPlay } from 'react-icons/fi';

import DbConfigEditor from './DbConfigEditor';
import SimConfigEditor from './SimConfigEditor';
import ResultsViewer from './ResultsViewer';
import { getProject, updateProject, formatDate, getProjectDbConfig, getProjectSimConfig } from '../../utils/projectApi';
import { useToastContext } from '../../contexts/ToastContext';

// Cache for project data to reduce loading flicker
const projectCache = {};

const ProjectPage = ({ theme }) => {
  const { projectId, resultId, activeTab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [project, setProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [existingResults, setExistingResults] = useState([]);
  const [dbConfigContent, setDbConfigContent] = useState('');
  const [simConfigContent, setSimConfigContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedDbConfig, setLastSavedDbConfig] = useState('');
  const [lastSavedSimConfig, setLastSavedSimConfig] = useState('');
  
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
  }, [projectId, navigate]);

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

  // Load database configuration content
  const loadDbConfigContent = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const result = await getProjectDbConfig(projectId);
      if (result.success && result.config) {
        const content = result.config.content || '';
        setDbConfigContent(content);
        setLastSavedDbConfig(content); // Set initial saved state
      }
    } catch (error) {
      console.error('Error loading database configuration content:', error);
    }
  }, [projectId]);

  // Load simulation configuration content
  const loadSimConfigContent = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const result = await getProjectSimConfig(projectId);
      if (result.success && result.config) {
        const content = result.config.content || '';
        setSimConfigContent(content);
        setLastSavedSimConfig(content); // Set initial saved state
      }
    } catch (error) {
      console.error('Error loading simulation configuration content:', error);
    }
  }, [projectId]);

  // Handle database configuration changes
  const handleDbConfigChange = useCallback((newContent) => {
    setDbConfigContent(newContent);
  }, []);

  // Handle simulation configuration changes
  const handleSimConfigChange = useCallback((newContent) => {
    setSimConfigContent(newContent);
  }, []);

  // Handle successful database config save
  const handleDbConfigSaveSuccess = useCallback(() => {
    setLastSavedDbConfig(dbConfigContent);
  }, [dbConfigContent]);

  // Handle successful simulation config save
  const handleSimConfigSaveSuccess = useCallback(() => {
    setLastSavedSimConfig(simConfigContent);
  }, [simConfigContent]);

  // Track unsaved changes
  useEffect(() => {
    const hasDbChanges = dbConfigContent !== lastSavedDbConfig;
    const hasSimChanges = simConfigContent !== lastSavedSimConfig;
    setHasUnsavedChanges(hasDbChanges || hasSimChanges);
  }, [dbConfigContent, simConfigContent, lastSavedDbConfig, lastSavedSimConfig]);

  // Navigation warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Effect to load project data
  useEffect(() => {
    setInitialLoad(true);
    loadProject();
    loadDbConfigContent();
    loadSimConfigContent();
    // Update active tab based on URL changes
    setCurrentTab(determineActiveTab());
    // Only run when projectId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  
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
  
  // Auto-update project name with debouncing
  useEffect(() => {
    if (!editingProjectName.trim() || editingProjectName === project?.name || !showEditModal) {
      return;
    }

    const timeoutId = setTimeout(async () => {
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
          
          // Trigger sidebar refresh by dispatching a custom event
          window.dispatchEvent(new Event('refreshProjects'));
        } else {
          showError('Failed to update project name');
        }
      } catch (error) {
        console.error('Error updating project name:', error);
        showError('Error updating project name');
      } finally {
        setIsUpdating(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [editingProjectName, project?.name, projectId, showEditModal]);

  // Add a function to run the simulation
  const handleRunSimulation = async () => {
    if (!projectId) return;
    
    try {
      setRunningSimulation(true);
      
      // First, ensure we have both database and simulation configurations
      const dbConfigResult = await getProjectDbConfig(projectId);
      const simConfigResult = await getProjectSimConfig(projectId);
      
      if (!dbConfigResult.success || !dbConfigResult.config) {
        showError('Database configuration not found. Please create and save a database configuration first.');
        setRunningSimulation(false);
        return;
      }
      
      if (!simConfigResult.success || !simConfigResult.config) {
        showError('Simulation configuration not found. Please create and save a simulation configuration first.');
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
        showSuccess('Simulation completed successfully!');
        
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
        showError(`Error running simulation: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error running simulation:', error);
      showError('Error running simulation. Check console for details.');
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
      {/* Project header removed: project name and edit button now in sidebar */}

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
                <DbConfigEditor
                  projectId={projectId}
                  isProjectTab={true}
                  theme={theme}
                  onConfigChange={handleDbConfigChange}
                  onSaveSuccess={handleDbConfigSaveSuccess}
                />
              </Tab.Pane>
              <Tab.Pane eventKey="simulation">
                <SimConfigEditor
                  projectId={projectId}
                  isProjectTab={true}
                  theme={theme}
                  dbConfigContent={dbConfigContent}
                  onConfigChange={handleSimConfigChange}
                  onSaveSuccess={handleSimConfigSaveSuccess}
                />
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
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProjectPage; 