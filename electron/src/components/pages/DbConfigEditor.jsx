import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Form,
  Button,
  Modal,
  Spinner
} from 'react-bootstrap';
import YamlEditor from '../shared/YamlEditor';
import ERDiagram from '../shared/ERDiagram';
import FloatingToolbar from '../shared/FloatingToolbar';
import { FiSave, FiUpload, FiDownload } from 'react-icons/fi';
import { VscEmptyWindow } from 'react-icons/vsc';
import { LuUndo2, LuRedo2 } from 'react-icons/lu';
import { useToastContext } from '../../contexts/ToastContext';
import useResizableGrid from '../../hooks/shared/useResizableGrid';

// Database store imports
import {
  useDatabaseYamlContent,
  useDatabaseCurrentState,
  useDatabaseIsLoading,
  useDatabaseError,
  useDatabaseName,
  useDatabaseDescription,
  useDatabaseConfig,
  useDatabaseConfigActions,
  useEntityYamlActions
} from '../../stores/databaseConfigStore';


// Accept theme as a prop
const DbConfigEditor = ({ projectId, isProjectTab = false, theme, onConfigChange, onSaveSuccess }) => {
  const { configId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToastContext();
  
  // Store state subscriptions
  const yamlContent = useDatabaseYamlContent(projectId);
  const currentState = useDatabaseCurrentState(projectId);
  const isLoading = useDatabaseIsLoading(projectId);
  const error = useDatabaseError(projectId);
  const name = useDatabaseName(projectId);
  const description = useDatabaseDescription(projectId);
  const config = useDatabaseConfig(projectId);
  
  // Store actions
  const {
    loadDatabaseConfig,
    saveDatabaseConfig,
    initializeDatabaseConfig,
    updateConfigMetadata,
    undo,
    redo,
    canUndo,
    canRedo
  } = useDatabaseConfigActions(projectId);
  
  const { importEntityYaml } = useEntityYamlActions(projectId);
  
  // Local modal state only
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  
  // Ref to access ERDiagram methods
  const erDiagramRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Resizable grid hook for panel sizing
  const { handleMouseDown } = useResizableGrid({
    minWidthPercent: 15,
    maxWidthPercent: 60,
    defaultWidthPercent: 20,
    cssVariable: '--yaml-panel-width',
    storageKey: 'db-editor-yaml-panel-width'
  });
  
  // Initialize database configuration context
  useEffect(() => {
    initializeDatabaseConfig({
      projectId,
      isProjectTab,
      theme,
      onConfigChange
    });

    console.log('🔧 DbConfigEditor: Database configuration context initialized');
  }, [projectId, isProjectTab, theme, onConfigChange, initializeDatabaseConfig]);

  // Load existing configuration
  useEffect(() => {
    const loadConfiguration = async () => {
      if (configId) {
        console.log('📂 DbConfigEditor: Loading standalone config:', configId);
        await loadDatabaseConfig(configId);
      } else if (projectId) {
        console.log('📂 DbConfigEditor: Loading project config:', projectId);
        await loadDatabaseConfig(null, projectId);
      }
    };

    loadConfiguration();
  }, [configId, projectId, loadDatabaseConfig]);

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
    }
  }, [error, showError]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle shortcuts when focused on the component
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'z':
            if (event.shiftKey) {
              // Ctrl+Shift+Z for redo
              event.preventDefault();
              if (canRedo()) {
                redo();
              }
            } else {
              // Ctrl+Z for undo
              event.preventDefault();
              if (canUndo()) {
                undo();
              }
            }
            break;
          case 'y':
            // Ctrl+Y for redo (alternative)
            event.preventDefault();
            if (canRedo()) {
              redo();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, canUndo, canRedo]);
  
  
  // Handle YAML import from files
  const handleYamlImport = async (content) => {
    console.log('[DbConfigEditor] handleYamlImport called, content length:', content?.length);
    
    try {
      const result = await importEntityYaml(content);
      console.log('[DbConfigEditor] YAML import result:', result);
      
      return result;
    } catch (error) {
      console.error('[DbConfigEditor] YAML import failed:', error);
      return { success: false, message: error.message };
    }
  };
  
  
  // Handle file import
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const content = await file.text();
      const result = await handleYamlImport(content);
      if (!result.success) {
        alert(`Import failed: ${result.message}`);
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      // Reset file input
      event.target.value = '';
    }
  };

  // Handle file export
  const handleExport = () => {
    if (!yamlContent) {
      alert('No content to export');
      return;
    }

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'database-config.yaml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  
  // Function to save configuration with provided content
  // This separates the saving logic from building the config object
  const saveConfigWithContent = async (configData) => {
    try {
      let result;
      
      if (projectId && isProjectTab) {
        // Save within project context using store action
        console.log("DbConfigEditor: Saving with saveDatabaseConfig, projectId:", projectId);
        result = await saveDatabaseConfig({
          ...configData,
          project_id: projectId
        });
        
        if (result.success) {
          showSuccess('Database configuration saved successfully');
          
          console.log('[DbConfigEditor] Save successful via store action');
          
          if (onSaveSuccess) {
            onSaveSuccess();
          }
        } else {
          console.error("DbConfigEditor: Error saving configuration:", result);
          showError('Error saving configuration');
        }
      } else if (config && !saveAsNew) {
        // Update existing configuration using store action
        console.log("DbConfigEditor: Updating config with saveDatabaseConfig, config.id:", config.id);
        result = await saveDatabaseConfig(configData);
        
        if (result.success) {
          handleCloseModal();
          navigate('/');
        }
      } else {
        // Save as new configuration using store action
        console.log("DbConfigEditor: Saving as new with saveDatabaseConfig");
        result = await saveDatabaseConfig({
          ...configData,
          saveAsNew: true
        });
        
        if (result.success) {
          handleCloseModal();
          navigate(`/db-config/${result.config.id}`);
        }
      }
      
      console.log("DbConfigEditor: Save result:", result);
      
      if (!result.success) {
        console.error("DbConfigEditor: Error: result.success is false", result);
        showError('Error saving configuration');
      }
      
      return result;
    } catch (error) {
      console.error('DbConfigEditor: Error in saveConfigWithContent:', error);
      showError('Error saving configuration');
      throw error;
    }
  };
  
  // Handle adding a new table - now uses ERDiagram API directly
  const handleAddTable = () => {
    if (!erDiagramRef.current) {
      showError('ERDiagram not ready. Please try again.');
      return;
    }

    try {
      // Get current entities to generate unique name
      const currentEntities = erDiagramRef.current.getCanonicalEntities();
      
      // Generate a unique table name
      const baseTableName = "NewTable";
      let tableName = baseTableName;
      let counter = 1;
      
      while (currentEntities.some(entity => entity.name === tableName)) {
        tableName = `${baseTableName}${counter}`;
        counter++;
      }
      
      // Add new table via ERDiagram API
      const newEntity = {
        name: tableName,
        rows: 100,
        attributes: [
          {
            name: "id",
            type: "pk"
          },
          {
            name: "name",
            type: "string",
            generator: {
              type: "faker",
              method: "name"
            }
          }
        ]
      };
      
      console.log('[DbConfigEditor] Adding table via ERDiagram API:', newEntity);
      erDiagramRef.current.addEntity(newEntity);
      
    } catch (error) {
      console.error('Error adding table:', error);
      showError('Failed to add table. Please try again.');
    }
  };
  
  // Save configuration
  const handleSave = () => {
    console.log("DbConfigEditor: handleSave called");
    // If we're in project context, auto-save
    if (projectId && isProjectTab) {
      handleSaveConfig();
    } else {
      // Otherwise show modal
      setShowSaveModal(true);
    }
  };
  
  // Close save modal
  const handleCloseModal = () => {
    setShowSaveModal(false);
    setSaveAsNew(false);
  };
  
  // Save the configuration
  const handleSaveConfig = async () => {
    console.log("DbConfigEditor: handleSaveConfig called with:", { 
      name, 
      hasContent: !!yamlContent && yamlContent.length > 0,
      yamlContentLength: yamlContent ? yamlContent.length : 0,
      projectId 
    });
    
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
      
      console.log("DbConfigEditor: About to save with configData:", configData);
      
      // Use the shared save function
      await saveConfigWithContent(configData);
    } catch (error) {
      console.error('DbConfigEditor: Error saving configuration:', error);
      showError('Error saving configuration');
    }
  };
  
  // CSS Grid-based editor layout (VS Code architecture)
  const renderEditor = () => (
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

      {/* Canvas Panel Header */}
      <div className="grid-canvas-header">
        <div>ER Diagram</div>
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
            onSave={handleSave}
            readOnly={true}
            showImportExport={false}
            filename="database-config"
            theme={theme}
          />
        )}
      </div>

      {/* Canvas Panel Content */}
      <div className="grid-canvas-content">
        <div className="canvas-content position-relative">
          <ERDiagram 
            key={projectId} 
            ref={erDiagramRef}
            theme={theme}
            projectId={projectId}
          />
          
          {/* Floating Toolbar */}
          <FloatingToolbar
            items={[
              {
                type: 'button',
                icon: <VscEmptyWindow />,
                onClick: handleAddTable,
                disabled: isLoading,
                variant: 'primary',
                tooltip: 'Add Table'
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
          
          {isLoading && (
            <div className="position-absolute top-50 start-50 translate-middle">
              <div className="d-flex flex-column align-items-center bg-white p-3 rounded shadow">
                <Spinner animation="border" />
                <div className="mt-2">Saving...</div>
              </div>
            </div>
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
  );
  
  // If part of a project tab, return just the editor
  if (isProjectTab) {
    return (
      <div className="db-config-editor">
        {renderEditor()}
      </div>
    );
  }
  
  // Otherwise return the full standalone page
  return (
    <div className="db-config-editor">
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <h2 className="mb-0">
            {config ? `Edit Database Configuration: ${name}` : 'New Database Configuration'}
          </h2>
        </div>
        {/* Remove the redundant Save button - we'll use the one in YamlEditor */}
      </div>
      
      {renderEditor()}
      
      {/* Save Configuration Modal */}
      <Modal
        show={showSaveModal}
        onHide={handleCloseModal}
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
          <Button variant="secondary" onClick={handleCloseModal}>
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