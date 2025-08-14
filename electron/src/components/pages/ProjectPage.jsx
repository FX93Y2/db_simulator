import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Button, Spinner, Modal, Form } from 'react-bootstrap';
import { FiBarChart2, FiArrowLeft, FiEdit, FiPlay } from 'react-icons/fi';

import DbConfigEditor from './DbConfigEditor';
import SimConfigEditor from './SimConfigEditor';
import ResultsViewer from './ResultsViewer';
import { getProject, updateProject, formatDate, getProjectDbConfig, getProjectSimConfig, saveProjectDbConfig, saveProjectSimConfig } from '../../utils/projectApi';
import { useToastContext } from '../../contexts/ToastContext';
import { useNavigationBlocker } from '../../hooks/shared/useNavigationBlocker';
import UnsavedChangesModal from '../modals/UnsavedChangesModal';

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
      } else {
        // For new projects with no config, initialize both states as empty
        setDbConfigContent('');
        setLastSavedDbConfig('');
      }
    } catch (error) {
      console.error('Error loading database configuration content:', error);
      // On error, also initialize as empty
      setDbConfigContent('');
      setLastSavedDbConfig('');
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
      } else {
        // For new projects with no config, initialize both states as empty
        setSimConfigContent('');
        setLastSavedSimConfig('');
      }
    } catch (error) {
      console.error('Error loading simulation configuration content:', error);
      // On error, also initialize as empty
      setSimConfigContent('');
      setLastSavedSimConfig('');
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

  // Handle saving all configurations
  const handleSaveAll = useCallback(async () => {
    try {
      const savePromises = [];
      
      // Save database config if it has changes
      const hasDbChanges = dbConfigContent !== lastSavedDbConfig;
      if (hasDbChanges) {
        savePromises.push(
          saveProjectDbConfig(projectId, { content: dbConfigContent })
            .then(() => setLastSavedDbConfig(dbConfigContent))
        );
      }
      
      // Save simulation config if it has changes
      const hasSimChanges = simConfigContent !== lastSavedSimConfig;
      if (hasSimChanges) {
        savePromises.push(
          saveProjectSimConfig(projectId, { content: simConfigContent })
            .then(() => setLastSavedSimConfig(simConfigContent))
        );
      }
      
      // Wait for all saves to complete
      if (savePromises.length > 0) {
        await Promise.all(savePromises);
        showSuccess('All changes saved successfully');
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error saving configurations:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }, [projectId, dbConfigContent, simConfigContent, lastSavedDbConfig, lastSavedSimConfig, showSuccess]);

  // Track unsaved changes
  useEffect(() => {
    const hasDbChanges = dbConfigContent !== lastSavedDbConfig;
    const hasSimChanges = simConfigContent !== lastSavedSimConfig;
    setHasUnsavedChanges(hasDbChanges || hasSimChanges);
  }, [dbConfigContent, simConfigContent, lastSavedDbConfig, lastSavedSimConfig]);

  // Navigation warning for unsaved changes (reload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        // Prevent the default browser behavior
        e.preventDefault();
        
        // Show our custom modal for reload
        setShowUnsavedModal(true);
        setPendingNavigation({
          state: 'blocked',
          targetPath: 'reload', // Specific to reload actions
          proceed: async () => {
            // Force reload by temporarily disabling unsaved changes check
            setHasUnsavedChanges(false);
            // Use requestAnimationFrame to ensure state update is processed
            requestAnimationFrame(async () => {
              if (window.api?.reloadApp) {
                await window.api.reloadApp();
              } else {
                window.location.reload();
              }
            });
          },
          reset: () => {
            // Just close the modal, stay on current page
            setShowUnsavedModal(false);
            setPendingNavigation(null);
          }
        });
        
        // Return empty string to prevent browser dialog
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // App close warning for unsaved changes
  useEffect(() => {
    if (window.api?.onAppCloseRequested) {
      const cleanup = window.api.onAppCloseRequested(() => {
        if (hasUnsavedChanges) {
          // Show our custom modal for close
          setShowUnsavedModal(true);
          setPendingNavigation({
            state: 'blocked',
            targetPath: 'close', // Specific to close actions
            proceed: async () => {
              // Force close by temporarily disabling unsaved changes check
              setHasUnsavedChanges(false);
              // Use requestAnimationFrame to ensure state update is processed
              requestAnimationFrame(async () => {
                if (window.api?.closeApp) {
                  await window.api.closeApp();
                }
              });
            },
            reset: () => {
              // Just close the modal, stay on current page
              setShowUnsavedModal(false);
              setPendingNavigation(null);
            }
          });
        } else {
          // No unsaved changes, close immediately
          if (window.api?.closeApp) {
            window.api.closeApp();
          }
        }
      });

      return cleanup;
    }
  }, [hasUnsavedChanges]);

  // Navigation blocker state and modal
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Handle navigation blocking when there are unsaved changes
  const handleNavigationBlocked = useCallback((navigation) => {
    setPendingNavigation(navigation);
    setShowUnsavedModal(true);
  }, []);

  // Use navigation blocker hook
  const blocker = useNavigationBlocker(hasUnsavedChanges, handleNavigationBlocked);

  // Modal handlers
  const handleSaveAndContinue = useCallback(async () => {
    try {
      await handleSaveAll();
      setShowUnsavedModal(false);
      
      // Check if this is a reload/close action or navigation
      if (pendingNavigation?.targetPath === 'reload' || pendingNavigation?.targetPath === 'close') {
        // For reload/close, use our custom proceed function
        pendingNavigation.proceed();
      } else if (blocker.state === 'blocked') {
        // For navigation, use the blocker's proceed function
        blocker.proceed();
      }
    } catch (error) {
      showError('Failed to save changes. Please try again.');
    }
  }, [handleSaveAll, blocker, pendingNavigation, showError]);

  const handleDiscardAndContinue = useCallback(() => {
    // Check if this is a reload/close action or navigation
    if (pendingNavigation?.targetPath === 'reload' || pendingNavigation?.targetPath === 'close') {
      // For reload/close, discard changes by reverting to last saved state
      setDbConfigContent(lastSavedDbConfig);
      setSimConfigContent(lastSavedSimConfig);
      setShowUnsavedModal(false);
      // Use our custom proceed function to reload or close
      pendingNavigation.proceed();
    } else {
      // For navigation, just proceed without saving
      setShowUnsavedModal(false);
      if (blocker.state === 'blocked') {
        blocker.proceed();
      }
    }
  }, [blocker, pendingNavigation, lastSavedDbConfig, lastSavedSimConfig]);

  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedModal(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

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
        <div className="project-content-wrapper">
          {currentTab === 'database' ? (
            <DbConfigEditor
              projectId={projectId}
              isProjectTab={true}
              theme={theme}
              currentTab={currentTab}
              onTabChange={handleTabChange}
              onRunSimulation={handleRunSimulation}
              runningSimulation={runningSimulation}
              onConfigChange={handleDbConfigChange}
              onSaveSuccess={handleDbConfigSaveSuccess}
            />
          ) : (
            <SimConfigEditor
              projectId={projectId}
              isProjectTab={true}
              theme={theme}
              currentTab={currentTab}
              onTabChange={handleTabChange}
              onRunSimulation={handleRunSimulation}
              runningSimulation={runningSimulation}
              dbConfigContent={dbConfigContent}
              onConfigChange={handleSimConfigChange}
              onSaveSuccess={handleSimConfigSaveSuccess}
            />
          )}
        </div>
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

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        show={showUnsavedModal}
        onHide={handleCancelNavigation}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscardAndContinue}
        onCancel={handleCancelNavigation}
        title="Unsaved Changes"
        message={
          pendingNavigation?.targetPath === 'reload' 
            ? "You have unsaved changes in your project configuration. What would you like to do before reloading?"
            : pendingNavigation?.targetPath === 'close'
            ? "You have unsaved changes in your project configuration. What would you like to do before closing?"
            : "You have unsaved changes in your project configuration. What would you like to do?"
        }
      />
    </Container>
  );
};

export default ProjectPage; 