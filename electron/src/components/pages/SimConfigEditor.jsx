import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Form,
  Button,
  Modal,
  Spinner,
  InputGroup,
  Tabs,
  Tab,
  Dropdown
} from 'react-bootstrap';
import { FiSave, FiArrowLeft, FiPlay, FiSettings, FiGitBranch, FiClock, FiTag, FiUpload, FiDownload } from 'react-icons/fi';
import { VscEmptyWindow } from 'react-icons/vsc';
import { LuUndo2, LuRedo2 } from 'react-icons/lu';
import { useToastContext } from '../../contexts/ToastContext';
import useResizableGrid from '../../hooks/shared/useResizableGrid';

// New store imports
import {
  useSimulationConfigStore,
  useYamlContent,
  useParsedSchema,
  useCanonicalSteps,
  useCurrentState,
  useIsLoading,
  useError,
  useActiveTab,
  useHasUnsavedSimulation,
  useYamlActions,
  useCanvasActions,
  useConfigActions,
  useWorkflowActions,
  useUIActions
} from '../../stores/simulationConfigStore';

// Components
import YamlEditor from '../shared/YamlEditor';
import ModularEventFlow from '../shared/ModularEventFlow';
import ResourceEditor from '../shared/ResourceEditor';
import SimulationEditor from '../shared/SimulationEditor';
import FloatingToolbar from '../shared/FloatingToolbar';

// Remove store initialization import - not needed anymore

/**
 * Rebuilt SimConfigEditor with centralized Zustand store
 * No local state - everything managed through store
 * Clean, predictable data flow without circular dependencies
 */
const SimConfigEditor = ({ projectId, isProjectTab, theme, dbConfigContent, onConfigChange, onSaveSuccess }) => {
  const { configId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToastContext();
  const fileInputRef = useRef(null);

  // Resizable grid hook for panel sizing
  const { handleMouseDown } = useResizableGrid({
    minWidthPercent: 15,
    maxWidthPercent: 60,
    defaultWidthPercent: 20,
    cssVariable: '--sim-yaml-panel-width',
    storageKey: 'sim-editor-yaml-panel-width'
  });

  // Store state subscriptions (selective to prevent unnecessary re-renders)
  const yamlContent = useYamlContent(projectId);
  const parsedSchema = useParsedSchema(projectId);
  const canonicalSteps = useCanonicalSteps(projectId);
  const currentState = useCurrentState(projectId);
  const isLoading = useIsLoading(projectId);
  const error = useError(projectId);
  const activeTab = useActiveTab(projectId);
  const hasUnsavedSimulation = useHasUnsavedSimulation(projectId);

  // Store actions
  const { importYaml, exportYaml } = useYamlActions(projectId);
  const { addNode } = useCanvasActions(projectId);
  const { loadConfig, saveConfig, initializeConfig, undo, redo, canUndo, canRedo } = useConfigActions(projectId);
  const { clearError } = useWorkflowActions(projectId);
  const { setActiveTab } = useUIActions(projectId);

  // Project-specific store now accessed through reactive hooks above

  // Initialize configuration context
  useEffect(() => {
    initializeConfig({
      projectId,
      isProjectTab,
      theme,
      dbConfigContent
    });

    console.log('🔧 SimConfigEditor: Configuration context initialized');
  }, [projectId, isProjectTab, theme, dbConfigContent, initializeConfig]);

  // Load existing configuration
  useEffect(() => {
    const loadConfiguration = async () => {
      if (configId) {
        console.log('📂 SimConfigEditor: Loading standalone config:', configId);
        await loadConfig(configId);
      } else if (projectId) {
        console.log('📂 SimConfigEditor: Loading project config:', projectId);
        await loadConfig(null, projectId);
      }
    };

    loadConfiguration();
  }, [configId, projectId, loadConfig]);

  // Handle configuration changes for parent component
  useEffect(() => {
    if (onConfigChange && yamlContent) {
      onConfigChange(yamlContent);
    }
  }, [yamlContent, onConfigChange]);

  // Handle errors
  useEffect(() => {
    if (error) {
      showError(error);
      // Auto-clear errors after showing them
      setTimeout(() => clearError(), 5000);
    }
  }, [error, showError, clearError]);

  // YAML import handler
  const handleYamlImport = useCallback(async (content) => {
    console.log('📥 SimConfigEditor: Starting YAML import');
    
    const result = await importYaml(content);
    
    if (result.success) {
      showSuccess(result.message);
    } else {
      showError(`Import failed: ${result.message}`);
    }
    
    return result;
  }, [importYaml, showSuccess, showError]);

  // File import handler
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const content = await file.text();
      await handleYamlImport(content);
    } catch (error) {
      showError(`Import failed: ${error.message}`);
    } finally {
      // Reset file input
      event.target.value = '';
    }
  }, [handleYamlImport, showError]);

  // File export handler
  const handleExport = useCallback(() => {
    if (!yamlContent) {
      showWarning('No content to export');
      return;
    }

    const result = exportYaml('simulation-config.yaml');
    if (result.success) {
      showSuccess(result.message);
    } else {
      showError(result.message);
    }
  }, [yamlContent, exportYaml, showSuccess, showError, showWarning]);

  // Generate collision-free step ID
  const generateStepId = useCallback((stepType) => {
    const existingStepIds = canonicalSteps.map(s => s.step_id);
    
    if (stepType === 'create') {
      let counter = 1;
      let stepId = `create_entities_${counter}`;
      while (existingStepIds.includes(stepId)) {
        counter++;
        stepId = `create_entities_${counter}`;
      }
      return stepId;
    }
    
    let counter = 1;
    let stepId = `${stepType}_${counter}`;
    while (existingStepIds.includes(stepId)) {
      counter++;
      stepId = `${stepType}_${counter}`;
    }
    
    return stepId;
  }, [canonicalSteps]);


  // Add module handler
  const handleAddModule = useCallback((moduleType) => {
    if (!parsedSchema) {
      showError('Configure Simulation Duration First!');
      return;
    }

    const stepId = generateStepId(moduleType);
    const position = {
      x: 50 + (canonicalSteps.length % 3) * 300,
      y: 100 + Math.floor(canonicalSteps.length / 3) * 200
    };

    // Create step based on type
    let newStep = {
      step_id: stepId,
      step_type: moduleType
    };

    switch (moduleType) {
      case 'event':
        newStep.event_config = {
          duration: { distribution: { type: "normal", mean: 5, stddev: 1 } },
          resource_requirements: []
        };
        newStep.next_steps = [];
        break;
      case 'decide':
        newStep.decide_config = {
          module_id: stepId,
          decision_type: "probability",
          outcomes: [
            {
              outcome_id: "outcome_1",
              next_step_id: "",
              conditions: [{ if: "Probability", is: "==", value: 0.5 }]
            },
            {
              outcome_id: "outcome_2", 
              next_step_id: "",
              conditions: [{ if: "Probability", is: "==", value: 0.5 }]
            }
          ]
        };
        break;
      case 'assign':
        newStep.assign_config = {
          module_id: stepId,
          assignments: [{
            assignment_type: "attribute",
            attribute_name: "new_attribute",
            value: "default_value"
          }]
        };
        newStep.next_steps = [];
        break;
      case 'release':
        // Release steps no longer need event_config.name
        // Display name is derived from step_id instead
        newStep.event_config = {};
        break;
      case 'create':
        newStep.create_config = {
          entity_table: "Entity",
          interarrival_time: {
            distribution: {
              type: "exponential",
              scale: 2
            }
          },
          max_entities: "n/a"
        };
        break;
      default:
        console.warn('Unknown module type:', moduleType);
        return;
    }

    // Add to store
    addNode(newStep, position);
    console.log('➕ SimConfigEditor: Added module:', stepId);
  }, [parsedSchema, canonicalSteps, generateStepId, addNode, showError]);

  // Save handler
  const handleSave = useCallback(async () => {
    console.log('💾 SimConfigEditor: Save requested');
    
    if (projectId && isProjectTab) {
      // Save directly for project tabs
      const result = await saveConfig();
      if (result.success && onSaveSuccess) {
        onSaveSuccess();
      }
    } else {
      // Show save modal for standalone configs
      setShowSaveModal(true);
    }
  }, [projectId, isProjectTab, saveConfig, onSaveSuccess]);

  // Navigation handler
  const handleBack = useCallback(() => {
    if (projectId && isProjectTab) {
      return; // Tab navigation handled by parent
    } else if (projectId) {
      navigate(`/project/${projectId}`);
    } else {
      navigate('/');
    }
  }, [projectId, isProjectTab, navigate]);

  // Modal state (local only for UI)
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [showRunModal, setShowRunModal] = React.useState(false);
  const [dbConfigs, setDbConfigs] = React.useState([]);
  const [selectedDbConfig, setSelectedDbConfig] = React.useState('');

  // Load database configs for run modal
  useEffect(() => {
    const loadDbConfigs = async () => {
      try {
        if (projectId) {
          const result = await window.api.getProjectDbConfig(projectId);
          if (result.success && result.config) {
            setDbConfigs([result.config]);
            setSelectedDbConfig(result.config.id);
          }
        } else {
          const result = await window.api.getConfigs('database');
          if (result.success) {
            setDbConfigs(result.configs || []);
            if (result.configs && result.configs.length === 1) {
              setSelectedDbConfig(result.configs[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Error loading database configurations:', error);
      }
    };

    loadDbConfigs();
  }, [projectId]);

  // CSS Grid-based editor component (VS Code architecture)
  const editorComponent = useMemo(() => (
    <div className="editor-grid-container">
      {/* YAML Panel Header */}
      <div className="grid-yaml-header">
        <div className="panel-header-actions">
          <Button
            size="sm"
            className="btn-custom-toolbar me-2"
            onClick={handleImport}
            disabled={isLoading}
            title="Import YAML file"
          >
            <FiUpload className="me-1" />
            Import
          </Button>
          <Button
            size="sm"
            className="btn-custom-toolbar me-2"
            onClick={handleExport}
            disabled={!yamlContent || isLoading}
            title="Export YAML file"
          >
            <FiDownload className="me-1" />
            Export
          </Button>
          <Button 
            size="sm" 
            className="action-button btn-custom-toolbar save-config-btn"
            onClick={handleSave} 
            disabled={isLoading}
            title="Save Configuration"
          >
            <FiSave className="save-icon" /> Save
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Canvas Panel Header with Tabs */}
      <div className="grid-canvas-header has-tabs">
        <Tabs
          activeKey={activeTab}
          onSelect={setActiveTab}
          className="mb-0"
        >
          <Tab
            eventKey="event-flow"
            title={<span><FiGitBranch className="me-2" />Event Flow</span>}
          />
          <Tab
            eventKey="resources"
            title={<span><FiSettings className="me-2" />Resources</span>}
          />
          <Tab
            eventKey="simulation"
            title={
              <span>
                <FiClock className="me-2" />
                Simulation
                {hasUnsavedSimulation && <span className="text-warning ms-2">●</span>}
              </span>
            }
          />
        </Tabs>
      </div>

      {/* YAML Panel Content */}
      <div className="grid-yaml-content">
        {isLoading && !yamlContent ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <div className="mt-2">Loading configuration...</div>
          </div>
        ) : (
          <YamlEditor 
            initialValue={yamlContent} 
            onSave={null}
            readOnly={true}
            showImportExport={false}
            filename="simulation-config"
            theme={theme}
          />
        )}
      </div>

      {/* Canvas Panel Content */}
      <div className="grid-canvas-content">
        <div className="canvas-content">
          {isLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2">Loading...</div>
            </div>
          ) : (
            <>
              {activeTab === 'event-flow' && (
                <div className="position-relative" style={{ height: '100%' }}>
                  <ModularEventFlow
                    theme={theme}
                    dbConfigContent={dbConfigContent}
                    projectId={projectId}
                  />
                  
                  {/* Floating Toolbar for Event Flow */}
                  <FloatingToolbar
                    items={[
                      {
                        type: 'dropdown',
                        icon: <VscEmptyWindow />,
                        disabled: isLoading,
                        variant: 'primary',
                        tooltip: 'Add Module',
                        dropDirection: 'end',
                        children: [
                          {
                            icon: <VscEmptyWindow />,
                            label: 'Create',
                            onClick: () => handleAddModule('create')
                          },
                          {
                            icon: <FiSettings />,
                            label: 'Process (Event)',
                            onClick: () => handleAddModule('event')
                          },
                          {
                            icon: <FiGitBranch />,
                            label: 'Decide',
                            onClick: () => handleAddModule('decide')
                          },
                          {
                            icon: <FiTag />,
                            label: 'Assign',
                            onClick: () => handleAddModule('assign')
                          },
                          {
                            icon: <FiPlay />,
                            label: 'Release (Dispose)',
                            onClick: () => handleAddModule('release')
                          }
                        ]
                      },
                      {
                        type: 'separator'
                      },
                      {
                        type: 'button',
                        icon: <LuUndo2 />,
                        onClick: undo,
                        disabled: isLoading || !canUndo(),
                        variant: 'primary',
                        tooltip: 'Undo'
                      },
                      {
                        type: 'button',
                        icon: <LuRedo2 />,
                        onClick: redo,
                        disabled: isLoading || !canRedo(),
                        variant: 'primary',
                        tooltip: 'Redo'
                      }
                    ]}
                    position="left"
                    theme={theme}
                  />
                </div>
              )}
              
              {activeTab === 'resources' && (
                <ResourceEditor
                  theme={theme}
                  dbConfigContent={dbConfigContent}
                />
              )}
              
              {activeTab === 'simulation' && (
                <SimulationEditor
                  projectId={projectId}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="grid-resize-handle"
        onMouseDown={handleMouseDown}
        title="Drag to resize panels"
      />

    </div>
  ), [yamlContent, activeTab, theme, isLoading, handleImport, handleExport, handleSave, handleAddModule, handleFileChange, dbConfigContent, projectId, setActiveTab, hasUnsavedSimulation, handleMouseDown]);

  // Store is always initialized now

  return (
    <div className="sim-config-editor">
      {!isProjectTab && (
        <div className="mb-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <Button 
              className="me-3"
              onClick={handleBack}
            >
              <FiArrowLeft /> Back
            </Button>
            <h2 className="mb-0">
              {configId ? `Edit Simulation Configuration` : 'New Simulation Configuration'}
            </h2>
          </div>
          <div>
            <Button 
              className="run-simulation-btn"
              onClick={() => setShowRunModal(true)}
              disabled={isLoading}
            >
              <FiPlay className="me-2" /> Run Simulation
            </Button>
          </div>
        </div>
      )}
      
      {editorComponent}
      
      {/* Modals remain the same for now - can be moved to store later if needed */}
      {/* Save Modal */}
      <Modal
        show={showSaveModal}
        onHide={() => setShowSaveModal(false)}
        centered
        enforceFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Save Simulation Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Save functionality will be implemented with the new store actions.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
            Cancel
          </Button>
          <Button className="btn-custom-toolbar" onClick={() => setShowSaveModal(false)}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Run Modal */}
      <Modal
        show={showRunModal}
        onHide={() => setShowRunModal(false)}
        centered
        enforceFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Run Simulation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Run simulation functionality will be implemented with the new store actions.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRunModal(false)}>
            Cancel
          </Button>
          <Button className="btn-primary" onClick={() => setShowRunModal(false)}>
            <FiPlay className="me-2" /> Run
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SimConfigEditor;