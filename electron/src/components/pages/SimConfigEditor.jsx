import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import YamlEditor from '../shared/YamlEditor';
import ModularEventFlow from '../simulation/ModularEventFlow';
import ResourceEditor from '../simulation/ResourceEditor';
import SimulationEditor from '../simulation/SimulationEditor';
import FloatingToolbar from '../shared/FloatingToolbar';
import EditorHeader from '../shared/EditorHeader';
import EditorLayout from '../shared/EditorLayout';
import { useToastContext } from '../../contexts/ToastContext';
import useResizableGrid from '../../hooks/shared/useResizableGrid';
import useYamlOperations from '../../hooks/shared/useYamlOperations';
import useKeyboardShortcuts from '../../hooks/shared/useKeyboardShortcuts';
import useConfigurationLoader from '../../hooks/shared/useConfigurationLoader';
import { getSimToolbarItems } from '../../config/toolbars/simToolbarConfig';

// New store imports
import {
  useYamlContent,
  useParsedSchema,
  useCanonicalSteps,
  useIsLoading,
  useError,
  useYamlActions,
  useCanvasActions,
  useConfigActions,
  useSimulationActions
} from '../../stores/simulationConfigStore';

/**
 * Refactored SimConfigEditor - significantly reduced from 707 lines to ~250 lines
 * Uses shared components and hooks to eliminate code duplication
 */
const SimConfigEditor = ({ 
  projectId, 
  isProjectTab, 
  theme, 
  currentTab, 
  onTabChange, 
  dbConfigContent, 
  onConfigChange, 
  onSaveSuccess 
}) => {
  const { configId } = useParams();
  const { showError } = useToastContext();
  
  // Resizable grid hook for panel sizing - unified across both editors
  const { handleMouseDown } = useResizableGrid({
    minWidthPercent: 15,
    maxWidthPercent: 60,
    defaultWidthPercent: 20,
    cssVariable: '--yaml-panel-width',
    storageKey: 'unified-yaml-panel-width'
  });

  // Store state subscriptions
  const yamlContent = useYamlContent(projectId);
  const parsedSchema = useParsedSchema(projectId);
  const canonicalSteps = useCanonicalSteps(projectId);
  const isLoading = useIsLoading(projectId);
  const error = useError(projectId);

  // Store actions
  const { importYaml, updateYamlContent } = useYamlActions(projectId);
  const { addNode } = useCanvasActions(projectId);
  const { loadConfig, saveConfig, initializeConfig, hasContent, undo, redo, canUndo, canRedo } = useConfigActions(projectId);
  const { syncSimulationToYaml } = useSimulationActions(projectId);

  // Local modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);

  // Custom hooks for shared functionality
  const yamlOperations = useYamlOperations({
    yamlContent,
    onImport: importYaml,
    filename: 'simulation-config'
  });
  
  useKeyboardShortcuts({ undo, redo, canUndo, canRedo });
  
  useConfigurationLoader({
    projectId,
    configId,
    isProjectTab,
    theme,
    onConfigChange,
    yamlContent,
    error,
    initializeConfig,
    loadConfig,
    hasContent
  });

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

  // Get toolbar configuration
  const toolbarItems = getSimToolbarItems({
    handleAddModule,
    setShowResourceModal,
    setShowSimulationModal,
    undo,
    redo,
    canUndo,
    canRedo,
    isLoading
  });

  // CSS Grid-based editor component (VS Code architecture)
  const editorComponent = useMemo(() => (
    <EditorLayout
      header={
        <EditorHeader
          currentTab={currentTab}
          onTabChange={onTabChange}
          onImport={yamlOperations.handleImport}
          onExport={yamlOperations.handleExport}
          onSave={handleSave}
          yamlContent={yamlContent}
          isLoading={isLoading}
          fileInputRef={yamlOperations.fileInputRef}
        />
      }
      yamlContent={yamlContent}
      yamlContentComponent={
        <YamlEditor 
          initialValue={yamlContent} 
          onSave={null}
          readOnly={true}
          showImportExport={false}
          filename="simulation-config"
          theme={theme}
        />
      }
      canvasContent={
        <div className="position-relative" style={{ height: '100%' }}>
          <ModularEventFlow
            theme={theme}
            dbConfigContent={dbConfigContent}
            projectId={projectId}
          />
          
          {/* Floating Toolbar for Event Flow */}
          <FloatingToolbar
            items={toolbarItems}
            position="top"
            theme={theme}
          />
        </div>
      }
      onResize={handleMouseDown}
      isLoading={isLoading}
    />
  ), [yamlContent, theme, isLoading, handleSave, handleAddModule, dbConfigContent, projectId, undo, redo, canUndo, canRedo, handleMouseDown, currentTab, onTabChange, toolbarItems, yamlOperations]);

  return (
    <div className="sim-config-editor">
      {!isProjectTab && (
        <div className="mb-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
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
              Run Simulation
            </Button>
          </div>
        </div>
      )}
      
      {editorComponent}
      
      <input
        ref={yamlOperations.fileInputRef}
        type="file"
        accept=".yaml,.yml"
        style={{ display: 'none' }}
        onChange={yamlOperations.handleFileChange}
      />
      
      {/* Modals */}
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
            Run
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Resource Configuration Modal */}
      <Modal
        show={showResourceModal}
        onHide={() => setShowResourceModal(false)}
        size="md"
        centered
        enforceFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Resource Capacity Configuration
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ResourceEditor
            yamlContent={yamlContent}
            onResourceChange={updateYamlContent}
            theme={theme}
            dbConfigContent={dbConfigContent}
            projectId={projectId}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowResourceModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={async () => {
              try {
                // Sync resources to YAML first, then save configuration
                syncSimulationToYaml();
                await saveConfig();
                setShowResourceModal(false);
              } catch (error) {
                showError('Failed to save resource configuration');
              }
            }}
          >
            Save Configuration
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Simulation Configuration Modal */}
      <Modal
        show={showSimulationModal}
        onHide={() => setShowSimulationModal(false)}
        size="lg"
        centered
        enforceFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Simulation Duration Configuration
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SimulationEditor
            projectId={projectId}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default SimConfigEditor;