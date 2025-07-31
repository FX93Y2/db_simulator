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
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import yaml from 'yaml';
import YamlEditor from '../shared/YamlEditor';
import ERDiagram from '../shared/ERDiagram';
import { FiSave, FiPlus } from 'react-icons/fi';
import { useToastContext } from '../../contexts/ToastContext';

// Default template for a new database configuration
const DEFAULT_DB_CONFIG = `# Database Configuration Template
entities:
  - name: Example
    rows: 100
    attributes:
      - name: id
        type: pk
      - name: name
        type: string
        generator:
          type: faker
          method: name
`;

// Accept theme as a prop
const DbConfigEditor = ({ projectId, isProjectTab = false, theme, onConfigChange, onSaveSuccess }) => {
  const { configId } = useParams();
  const { showSuccess, showError, showWarning } = useToastContext();
  const [config, setConfig] = useState(null);
  const [yamlContent, setYamlContent] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  
  // Ref to access ERDiagram methods
  const erDiagramRef = useRef(null);
  
  // Track if YAML change came from ERDiagram to prevent loops
  const yamlChangeFromDiagram = useRef(false);
  
  // Load existing configuration or create new one for the project
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        
        if (projectId === 'new') {
          // For a new project, set default config
          setYamlContent(DEFAULT_DB_CONFIG);
          setName('New Project - Database');
          return;
        }
        
        // Try to load the database config for this project
        const result = await window.api.getProjectDbConfig(projectId);
        
        if (result && result.success && result.config) {
          setConfig(result.config);
          // Add a fallback for name in case it's null
          setName(result.config.name || `Project Database Configuration`);
          setDescription(result.config.description || '');
          setYamlContent(result.config.content || DEFAULT_DB_CONFIG);
        } else {
          // No existing config found, set default
          setYamlContent(DEFAULT_DB_CONFIG);
          setName(`Project Database Configuration`);
        }
      } catch (error) {
        console.error('Error loading configuration:', error);
        // Set defaults in case of error
        setYamlContent(DEFAULT_DB_CONFIG);
        setName(`Project Database Configuration`);
      } finally {
        setLoading(false);
      }
    };
    
    // Reset initialization flag when project/config changes
    setERDiagramInitialized(false);
    
    if (projectId) {
      loadConfig();
    } else if (configId) {
      // Legacy support for direct config loading by ID
      loadConfigById();
    } else {
      // Completely new configuration outside project context
      setYamlContent(DEFAULT_DB_CONFIG);
      setName('New Database Configuration');
    }
  }, [projectId, configId]);

  // Track if ERDiagram has been initialized to prevent loops
  const [erDiagramInitialized, setERDiagramInitialized] = useState(false);

  // Initialize ERDiagram with initial YAML content (only once)
  useEffect(() => {
    if (yamlContent && erDiagramRef.current && !erDiagramInitialized) {
      console.log('[DbConfigEditor] Initializing ERDiagram with YAML content, length:', yamlContent.length);
      erDiagramRef.current.handleYAMLChange(yamlContent);
      setERDiagramInitialized(true);
    } else if (yamlContent && erDiagramRef.current && erDiagramInitialized) {
      console.log('[DbConfigEditor] Skipping ERDiagram initialization - already initialized');
    }
  }, [yamlContent, erDiagramInitialized]); // Only initialize once
  
  // Legacy method to load config directly by ID
  const loadConfigById = async () => {
    if (!configId) return;
    
    try {
      setLoading(true);
      const result = await window.api.getConfig(configId);
      if (result && result.success && result.config) {
        setConfig(result.config);
        setName(result.config.name || 'Database Configuration');
        setDescription(result.config.description || '');
        setYamlContent(result.config.content || DEFAULT_DB_CONFIG);
      } else {
        // Handle error case
        setYamlContent(DEFAULT_DB_CONFIG);
        setName('Database Configuration');
      }
    } catch (error) {
      console.error('Error loading configuration by ID:', error);
      // Set defaults in error case
      setYamlContent(DEFAULT_DB_CONFIG);
      setName('Database Configuration');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle YAML content changes
  const handleYamlChange = (content) => {
    console.log('[DbConfigEditor] handleYamlChange called, content length:', content?.length);
    console.log('[DbConfigEditor] yamlChangeFromDiagram.current:', yamlChangeFromDiagram.current);
    
    setYamlContent(content);
    
    // Only send changes to ERDiagram if they didn't come from ERDiagram
    // This prevents infinite loops
    if (erDiagramRef.current && !yamlChangeFromDiagram.current) {
      console.log('[DbConfigEditor] Sending YAML change to ERDiagram');
      erDiagramRef.current.handleYAMLChange(content);
    } else {
      console.log('[DbConfigEditor] Skipping ERDiagram update - change came from diagram');
    }
    
    // Reset the flag
    yamlChangeFromDiagram.current = false;
    
    // Notify parent component of the change for real-time reactivity
    if (onConfigChange) {
      onConfigChange(content);
    }
  };
  
  // Handle diagram changes - now much simpler since ERDiagram generates YAML
  const handleDiagramChange = useCallback((updatedYamlContent) => {
    console.log('[DbConfigEditor] Received YAML update from ERDiagram');
    
    // Set flag to indicate this change came from ERDiagram
    yamlChangeFromDiagram.current = true;
    
    setYamlContent(updatedYamlContent);
    
    // Notify parent component of the change for real-time reactivity
    if (onConfigChange) {
      onConfigChange(updatedYamlContent);
    }
  }, [onConfigChange]);
  
  // Validation function using the new library
  const validateYaml = (content) => {
    try {
      yaml.parse(content); // Use yaml.parse
      return { parsed: true };
    } catch (e) {
      console.error("YAML validation failed:", e);
      return { parsed: false, error: e };
    }
  };
  
  // Function to save configuration with provided content
  // This separates the saving logic from building the config object
  const saveConfigWithContent = async (configData) => {
    try {
      setLoading(true);
      let result;
      
      if (projectId && isProjectTab) {
        // Save within project context
        console.log("DbConfigEditor: Saving with saveProjectDbConfig, projectId:", projectId);
        result = await window.api.saveProjectDbConfig(projectId, configData);
        
        if (result.success) {
          setConfig(result.config);
          showSuccess('Database configuration saved successfully');
          
          // Don't update YAML content from save response to prevent ERDiagram clearing
          // The current yamlContent is already what we saved
          console.log('[DbConfigEditor] Save successful, keeping current YAML content');
          
          if (onSaveSuccess) {
            onSaveSuccess();
          }
        } else {
          console.error("DbConfigEditor: Error saving configuration:", result);
          showError('Error saving configuration');
        }
      } else if (config && !saveAsNew) {
        // Update existing configuration
        console.log("DbConfigEditor: Updating config with updateConfig, config.id:", config.id);
        result = await window.api.updateConfig(config.id, configData);
        
        if (result.success) {
          handleCloseModal();
          navigate('/');
        }
      } else {
        // Save as new configuration
        console.log("DbConfigEditor: Saving as new with saveConfig");
        result = await window.api.saveConfig(configData);
        
        if (result.success) {
          handleCloseModal();
          navigate(`/db-config/${result.config_id}`);
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
    } finally {
      setLoading(false);
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
      setLoading(true);
      
      if (!name) {
        showError('Please enter a name for the configuration');
        setLoading(false);
        return;
      }
      
      // Validate YAML content before sending
      const validationResult = validateYaml(yamlContent);
      if (!validationResult.parsed) {
        console.error("DbConfigEditor: YAML validation failed:", validationResult.error);
        showError('The YAML content appears to be invalid. Please check your configuration.');
        setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };
  
  // In project tab mode, we don't show the header and back button
  const renderEditor = () => (
    <div className="editor-container-split" onClick={() => console.log("Editor container clicked")}>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={40} minSize={20} order={1}>
          <div className="editor-yaml-panel">
            <div className="panel-header">
              <span>YAML Editor</span>
              <div className="panel-header-actions">
                <Button 
                  size="sm" 
                  className="action-button btn-custom-toolbar save-config-btn"
                  onClick={handleSave} 
                  disabled={loading}
                  title="Save Configuration"
                >
                  <FiSave className="save-icon" /> Save
                </Button>
              </div>
            </div>
            {loading && !yamlContent ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <div className="mt-2">Loading configuration...</div>
              </div>
            ) : (
              <YamlEditor 
                initialValue={yamlContent} 
                onChange={handleYamlChange}
                onSave={handleSave}
                height="calc(100vh - 220px)"
                theme={theme}
              />
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="editor-resize-handle" />
        <Panel defaultSize={60} minSize={30} order={2}>
          <div className="editor-canvas-panel">
            <div className="canvas-header d-flex justify-content-between align-items-center">
              <div>ER Diagram</div>
              <Button 
                size="sm"
                className="btn-custom-toolbar"
                onClick={handleAddTable}
                disabled={loading}
              >
                <FiPlus /> Add Table
              </Button>
            </div>
            
            <div className="canvas-content position-relative">
              <ERDiagram 
                ref={erDiagramRef}
                yamlContent={yamlContent} 
                onDiagramChange={handleDiagramChange}
                theme={theme}
              />
              {loading && (
                <div className="position-absolute top-50 start-50 translate-middle">
                  <div className="d-flex flex-column align-items-center bg-white p-3 rounded shadow">
                    <Spinner animation="border" />
                    <div className="mt-2">Saving...</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
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
                onChange={(e) => setName(e.target.value)} 
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
                onChange={(e) => setDescription(e.target.value)}
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
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : 'Save'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DbConfigEditor; 