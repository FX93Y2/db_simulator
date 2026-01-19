import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Form, Button, Modal, Spinner } from 'react-bootstrap';
import YamlEditor from '../shared/YamlEditor';
import ERDiagram from '../database/ERDiagram';
import FloatingToolbar from '../shared/FloatingToolbar';
import EditorHeader from '../shared/EditorHeader';
import EditorLayout from '../shared/EditorLayout';
import { useToastContext } from '../../contexts/ToastContext';
import useResizableGrid from '../../hooks/shared/useResizableGrid';
import useYamlOperations from '../../hooks/shared/useYamlOperations';
import useExportAllConfigs from '../../hooks/shared/useExportAllConfigs';
import useKeyboardShortcuts from '../../hooks/shared/useKeyboardShortcuts';
import useConfigurationLoader from '../../hooks/shared/useConfigurationLoader';
import { getDbToolbarItems } from '../../config/toolbars/dbToolbarConfig';

// Database store imports
import {
  useDatabaseYamlContent,
  useDatabaseIsLoading,
  useDatabaseError,
  useDatabaseName,
  useDatabaseDescription,
  useDatabaseConfig,
  useDatabaseConfigActions,
  useEntityYamlActions,
  useSelectionMode,
  useEntityUIActions
} from '../../stores/databaseConfigStore';

// Simulation store imports (for Export All feature)
import { useYamlContent as useSimulationYamlContent } from '../../stores/simulationConfigStore';

/**
 * Refactored DbConfigEditor - significantly reduced from 626 lines to ~200 lines
 * Uses shared components and hooks to eliminate code duplication
 */
const DbConfigEditor = ({
  projectId,
  isProjectTab = false,
  theme,
  currentTab,
  onTabChange,
  onConfigChange,
  onSaveSuccess,
  onSaveAll = null
}) => {
  const { configId } = useParams();
  const { showSuccess, showError } = useToastContext();

  // Store state subscriptions
  const yamlContent = useDatabaseYamlContent(projectId);
  const simYamlContent = useSimulationYamlContent(projectId);
  const isLoading = useDatabaseIsLoading(projectId);
  const error = useDatabaseError(projectId);
  const name = useDatabaseName(projectId);
  const description = useDatabaseDescription(projectId);
  const config = useDatabaseConfig(projectId);
  const selectionMode = useSelectionMode(projectId);

  // Store actions
  const {
    loadDatabaseConfig,
    saveDatabaseConfig,
    initializeDatabaseConfig,
    updateConfigMetadata,
    hasContent,
    undo,
    redo,
    canUndo,
    canRedo
  } = useDatabaseConfigActions(projectId);

  const { importEntityYaml } = useEntityYamlActions(projectId);

  const { toggleSelectionMode } = useEntityUIActions(projectId);

  // Local modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);

  // Refs
  const erDiagramRef = useRef(null);

  // Resizable grid hook
  const { handleMouseDown } = useResizableGrid({
    minWidthPercent: 22,
    maxWidthPercent: 60,
    defaultWidthPercent: 20,
    cssVariable: '--yaml-panel-width',
    storageKey: 'unified-yaml-panel-width'
  });

  // Custom hooks for shared functionality
  const yamlOperations = useYamlOperations({
    yamlContent,
    onImport: importEntityYaml,
    filename: 'database-config',
    saveConfig: saveDatabaseConfig,
    isProjectTab,
    projectId,
    configType: 'database'
  });

  const { handleExportAll } = useExportAllConfigs({
    projectName: name || 'project',
    dbYamlContent: yamlContent,
    simYamlContent: simYamlContent
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
    initializeConfig: initializeDatabaseConfig,
    loadConfig: loadDatabaseConfig,
    hasContent
  });

  // Component-specific handlers
  const handleAddTable = () => {
    if (!erDiagramRef.current) {
      showError('ERDiagram not ready. Please try again.');
      return;
    }

    try {
      const currentEntities = erDiagramRef.current.getCanonicalEntities();

      const baseTableName = "NewTable";
      let tableName = baseTableName;
      let counter = 1;

      while (currentEntities.some(entity => entity.name === tableName)) {
        tableName = `${baseTableName}${counter}`;
        counter++;
      }

      const newEntity = {
        name: tableName,
        rows: 'n/a',
        attributes: [
          { name: "id", type: "pk" }
        ]
      };

      erDiagramRef.current.addEntity(newEntity);
    } catch (error) {
      showError('Failed to add table. Please try again.');
    }
  };

  const handleSave = () => {
    if (projectId && isProjectTab && onSaveAll) {
      // Use unified save function for project tabs when available
      onSaveAll();
    } else if (projectId && isProjectTab) {
      handleSaveConfig();
    } else {
      setShowSaveModal(true);
    }
  };

  const handleSaveConfig = async () => {
    try {
      if (!name) {
        showError('Please enter a name for the configuration');
        return;
      }

      const configData = {
        name,
        config_type: 'database',
        content: yamlContent,
        description,
        project_id: projectId
      };

      const result = await saveDatabaseConfig(configData);

      if (result.success) {
        showSuccess('Database configuration saved successfully');
        if (onSaveSuccess) onSaveSuccess();
        if (!isProjectTab) setShowSaveModal(false);
      } else {
        showError('Error saving configuration');
      }
    } catch (error) {
      showError('Error saving configuration');
    }
  };

  // Get toolbar configuration
  const toolbarItems = getDbToolbarItems({
    handleAddTable,
    toggleSelectionMode,
    selectionMode,
    undo,
    redo,
    canUndo,
    canRedo,
    isLoading
  });

  // Render editor layout
  const renderEditor = () => (
    <EditorLayout
      header={
        <EditorHeader
          currentTab={currentTab}
          onTabChange={onTabChange}
          onImport={yamlOperations.handleImport}
          onExport={yamlOperations.handleExport}
          onExportAll={handleExportAll}
          onSave={handleSave}
          yamlContent={yamlContent}
          isLoading={isLoading}
          fileInputRef={yamlOperations.fileInputRef}
          saveAll={isProjectTab && !!onSaveAll}
        />
      }
      yamlContent={yamlContent}
      yamlContentComponent={
        <YamlEditor
          initialValue={yamlContent}
          onSave={handleSave}
          readOnly={true}
          showImportExport={false}
          filename="database-config"
          theme={theme}
        />
      }
      canvasContent={
        <div className="position-relative" style={{ height: '100%' }}>
          <ERDiagram
            key={projectId}
            ref={erDiagramRef}
            theme={theme}
            projectId={projectId}
          />

          <FloatingToolbar
            items={toolbarItems}
            position="top-center"
            theme={theme}
          />

          {isLoading && (
            <div className="position-absolute top-50 start-50 translate-middle">
              <div className="d-flex flex-column align-items-center bg-white p-3 rounded shadow">
                <Spinner animation="border" />
                <div className="mt-2">Saving...</div>
              </div>
            </div>
          )}
        </div>
      }
      onResize={handleMouseDown}
      isLoading={isLoading}
    />
  );

  // Project tab version (simplified)
  if (isProjectTab) {
    return (
      <div className="db-config-editor">
        {renderEditor()}
        <input
          ref={yamlOperations.fileInputRef}
          type="file"
          accept=".yaml,.yml"
          style={{ display: 'none' }}
          onChange={yamlOperations.handleFileChange}
        />
      </div>
    );
  }

  // Standalone version with modal
  return (
    <div className="db-config-editor">
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <h2 className="mb-0">
            {config ? `Edit Database Configuration: ${name}` : 'New Database Configuration'}
          </h2>
        </div>
      </div>

      {renderEditor()}

      <input
        ref={yamlOperations.fileInputRef}
        type="file"
        accept=".yaml,.yml"
        style={{ display: 'none' }}
        onChange={yamlOperations.handleFileChange}
      />

      {/* Save Configuration Modal */}
      <Modal
        show={showSaveModal}
        onHide={() => setShowSaveModal(false)}
        centered
        enforceFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Save Database Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Configuration Name</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={(e) => updateConfigMetadata({ name: e.target.value })}
                placeholder="Enter a name for this configuration"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={description}
                onChange={(e) => updateConfigMetadata({ description: e.target.value })}
                placeholder="Optional description"
              />
            </Form.Group>
            {config && (
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Save as a new configuration"
                  checked={saveAsNew}
                  onChange={(e) => setSaveAsNew(e.target.checked)}
                />
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
            Cancel
          </Button>
          <Button
            className="btn-custom-toolbar"
            onClick={handleSaveConfig}
            disabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" /> : 'Save'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DbConfigEditor;