import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Form, 
  Button, 
  Modal,
  Spinner 
} from 'react-bootstrap';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import YamlEditor from '../shared/YamlEditor';
import ERDiagram from '../shared/ERDiagram';
import { FiSave, FiPlus } from 'react-icons/fi';

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
const DbConfigEditor = ({ projectId, isProjectTab = false, theme }) => {
  const { configId } = useParams();
  const [config, setConfig] = useState(null);
  const [yamlContent, setYamlContent] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  const instanceId = useRef(`dbconfigeditor-${Math.random().toString(36).substr(2, 9)}`);
  const yamlUpdatesFromDiagram = useRef(0);
  const yamlUpdatesFromEditor = useRef(0);
  const isSaving = useRef(false);
  
  // Log component initialization
  useEffect(() => {
    console.log(`[DbConfigEditor ${instanceId.current}] Initialized with projectId: ${projectId}, isProjectTab: ${isProjectTab}`);
    return () => {
      console.log(`[DbConfigEditor ${instanceId.current}] Component unmounting`);
    };
  }, []);
  
  // Load existing configuration or create new one for the project
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        console.log(`[DbConfigEditor ${instanceId.current}] Loading configuration for projectId: ${projectId}`);
        
        if (projectId === 'new') {
          // For a new project, set default config
          console.log(`[DbConfigEditor ${instanceId.current}] New project, setting default config`);
          setYamlContent(DEFAULT_DB_CONFIG);
          setName('New Project - Database');
          return;
        }
        
        // Try to load the database config for this project
        console.log(`[DbConfigEditor ${instanceId.current}] Fetching project db config from API`);
        const result = await window.api.getProjectDbConfig(projectId);
        
        if (result && result.success && result.config) {
          console.log(`[DbConfigEditor ${instanceId.current}] Config loaded successfully, content length: ${result.config.content ? result.config.content.length : 0}`);
          setConfig(result.config);
          // Add a fallback for name in case it's null
          setName(result.config.name || `Project Database Configuration`);
          setDescription(result.config.description || '');
          setYamlContent(result.config.content || DEFAULT_DB_CONFIG);
        } else {
          // No existing config found, set default
          console.log(`[DbConfigEditor ${instanceId.current}] No existing config found, using default`);
          setYamlContent(DEFAULT_DB_CONFIG);
          setName(`Project Database Configuration`);
        }
      } catch (error) {
        console.error(`[DbConfigEditor ${instanceId.current}] Error loading configuration:`, error);
        // Set defaults in case of error
        setYamlContent(DEFAULT_DB_CONFIG);
        setName(`Project Database Configuration`);
      } finally {
        setLoading(false);
      }
    };
    
    if (projectId) {
      loadConfig();
    } else if (configId) {
      // Legacy support for direct config loading by ID
      loadConfigById();
    } else {
      // Completely new configuration outside project context
      console.log(`[DbConfigEditor ${instanceId.current}] Creating new standalone config`);
      setYamlContent(DEFAULT_DB_CONFIG);
      setName('New Database Configuration');
    }
  }, [projectId, configId]);
  
  // Legacy method to load config directly by ID
  const loadConfigById = async () => {
    if (!configId) return;
    
    try {
      setLoading(true);
      console.log(`[DbConfigEditor ${instanceId.current}] Loading config by ID: ${configId}`);
      const result = await window.api.getConfig(configId);
      if (result && result.success && result.config) {
        console.log(`[DbConfigEditor ${instanceId.current}] Config loaded by ID successfully`);
        setConfig(result.config);
        setName(result.config.name || 'Database Configuration');
        setDescription(result.config.description || '');
        setYamlContent(result.config.content || DEFAULT_DB_CONFIG);
      } else {
        // Handle error case
        console.warn(`[DbConfigEditor ${instanceId.current}] Failed to load config by ID, using default`);
        setYamlContent(DEFAULT_DB_CONFIG);
        setName('Database Configuration');
      }
    } catch (error) {
      console.error(`[DbConfigEditor ${instanceId.current}] Error loading configuration by ID:`, error);
      // Set defaults in error case
      setYamlContent(DEFAULT_DB_CONFIG);
      setName('Database Configuration');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle YAML content changes
  const handleYamlChange = (content) => {
    console.log(`[DbConfigEditor ${instanceId.current}] YAML content changed from editor, length: ${content.length}`);
    yamlUpdatesFromEditor.current += 1;
    setYamlContent(content);
  };
  
  // Function to save configuration with provided content
  const saveConfigWithContent = async (configData) => {
    if (isSaving.current) {
      console.log(`[DbConfigEditor ${instanceId.current}] Save already in progress, skipping duplicate call`);
      return;
    }
    
    try {
      console.log(`[DbConfigEditor ${instanceId.current}] Saving config with content length: ${configData.content.length}`);
      isSaving.current = true;
      setLoading(true);
      let result;
      
      if (projectId && isProjectTab) {
        // Save within project context
        console.log(`[DbConfigEditor ${instanceId.current}] Saving project db config for projectId: ${projectId}`);
        result = await window.api.saveProjectDbConfig(projectId, configData);
        
        if (result.success) {
          console.log(`[DbConfigEditor ${instanceId.current}] Project db config saved successfully`);
          setConfig(result.config);
          alert('Database configuration saved successfully');
        } else {
          console.error(`[DbConfigEditor ${instanceId.current}] Error saving project db config:`, result);
          alert('Error saving configuration');
        }
      } else if (config && !saveAsNew) {
        // Update existing configuration
        console.log(`[DbConfigEditor ${instanceId.current}] Updating existing config with ID: ${config.id}`);
        result = await window.api.updateConfig(config.id, configData);
        
        if (result.success) {
          console.log(`[DbConfigEditor ${instanceId.current}] Config updated successfully`);
          handleCloseModal();
          navigate('/');
        }
      } else {
        // Save as new configuration
        console.log(`[DbConfigEditor ${instanceId.current}] Saving as new config`);
        result = await window.api.saveConfig(configData);
        
        if (result.success) {
          console.log(`[DbConfigEditor ${instanceId.current}] New config saved successfully with ID: ${result.config_id}`);
          handleCloseModal();
          navigate(`/db-config/${result.config_id}`);
        }
      }
      
      console.log(`[DbConfigEditor ${instanceId.current}] Save result:`, {
        success: result.success,
        message: result.message,
        config_id: result.config_id
      });
      
      if (!result.success) {
        console.error(`[DbConfigEditor ${instanceId.current}] Save failed:`, result);
        alert('Error saving configuration');
      }
      
      return result;
    } catch (error) {
      console.error(`[DbConfigEditor ${instanceId.current}] Error in saveConfigWithContent:`, error);
      alert('Error saving configuration');
      throw error;
    } finally {
      setLoading(false);
      isSaving.current = false;
    }
  };
  
  // Handle ER diagram changes
  const handleDiagramChange = (updatedYaml) => {
    // Update the editor content with the changes from the diagram
    if (updatedYaml) {
      console.log(`[DbConfigEditor ${instanceId.current}] Diagram initiated YAML update, length: ${updatedYaml.length}`);
      yamlUpdatesFromDiagram.current += 1;
      setYamlContent(updatedYaml);
      
      // If in project context, also auto-save to ensure backend is updated
      if (projectId && isProjectTab) {
        console.log(`[DbConfigEditor ${instanceId.current}] Auto-saving after diagram change`);
        const configData = {
          name: name || 'Database Configuration',
          config_type: 'database',
          content: updatedYaml, // Use the updated YAML directly
          description
        };
        
        // Schedule this after state update to ensure we're using latest content
        setTimeout(() => {
          console.log(`[DbConfigEditor ${instanceId.current}] Executing delayed save after diagram change`);
          saveConfigWithContent(configData);
        }, 0);
      }
    }
  };
  
  // Handle adding a new table
  const handleAddTable = () => {
    try {
      console.log(`[DbConfigEditor ${instanceId.current}] Adding new table to YAML`);
      // Parse existing YAML
      const yaml = require('js-yaml');
      const parsedYaml = yaml.load(yamlContent) || {};
      
      // Ensure entities array exists
      if (!parsedYaml.entities) {
        parsedYaml.entities = [];
      }
      
      // Generate a unique table name
      const baseTableName = "NewTable";
      let tableName = baseTableName;
      let counter = 1;
      
      while (parsedYaml.entities.some(entity => entity.name === tableName)) {
        tableName = `${baseTableName}${counter}`;
        counter++;
      }
      
      console.log(`[DbConfigEditor ${instanceId.current}] Generated unique table name: ${tableName}`);
      
      // Add new table template
      parsedYaml.entities.push({
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
      });
      
      // Convert back to YAML
      const updatedYaml = yaml.dump(parsedYaml, { lineWidth: 120 });
      console.log(`[DbConfigEditor ${instanceId.current}] Added new table, updating YAML content, new length: ${updatedYaml.length}`);
      yamlUpdatesFromEditor.current += 1;
      setYamlContent(updatedYaml);
      
    } catch (error) {
      console.error(`[DbConfigEditor ${instanceId.current}] Error adding table:`, error);
      alert('Failed to add table. Please check that your YAML is valid.');
    }
  };
  
  // Save configuration
  const handleSave = () => {
    console.log(`[DbConfigEditor ${instanceId.current}] Handle save button clicked`);
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
    console.log(`[DbConfigEditor ${instanceId.current}] Closing save modal`);
    setShowSaveModal(false);
    setSaveAsNew(false);
  };
  
  // Save the configuration
  const handleSaveConfig = async () => {
    console.log(`[DbConfigEditor ${instanceId.current}] Saving config with name: ${name}, yamlContent length: ${yamlContent ? yamlContent.length : 0}`);
    
    try {
      setLoading(true);
      
      if (!name) {
        console.warn(`[DbConfigEditor ${instanceId.current}] Save failed - missing name`);
        alert('Please enter a name for the configuration');
        setLoading(false);
        return;
      }
      
      // Validate YAML content before sending
      try {
        const yaml = require('js-yaml');
        const parsedYaml = yaml.load(yamlContent);
        console.log(`[DbConfigEditor ${instanceId.current}] YAML validation passed`, { parsed: !!parsedYaml });
      } catch (yamlError) {
        console.error(`[DbConfigEditor ${instanceId.current}] YAML validation failed:`, yamlError);
        alert('The YAML content appears to be invalid. Please check your configuration.');
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
      
      console.log(`[DbConfigEditor ${instanceId.current}] Calling saveConfigWithContent`);
      
      // Use the shared save function
      await saveConfigWithContent(configData);
    } catch (error) {
      console.error(`[DbConfigEditor ${instanceId.current}] Error saving configuration:`, error);
      alert('Error saving configuration');
    } finally {
      setLoading(false);
    }
  };
  
  // Track YAML update counts
  useEffect(() => {
    console.log(`[DbConfigEditor ${instanceId.current}] YAML content updated, stats:`, {
      length: yamlContent ? yamlContent.length : 0,
      updatesFromEditor: yamlUpdatesFromEditor.current,
      updatesFromDiagram: yamlUpdatesFromDiagram.current
    });
  }, [yamlContent]);
  
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
                onSave={(content) => {
                  console.log(`[DbConfigEditor ${instanceId.current}] YamlEditor onSave callback triggered, content length: ${content.length}`);
                  // Update content first
                  handleYamlChange(content);
                  
                  // Auto-save if in project context
                  if (projectId && isProjectTab) {
                    console.log(`[DbConfigEditor ${instanceId.current}] Auto-saving from YamlEditor change`);
                    const configData = {
                      name,
                      config_type: 'database',
                      content, // Use the content parameter directly
                      description,
                      project_id: projectId
                    };
                    
                    // Validate YAML content before sending
                    try {
                      const yaml = require('js-yaml');
                      yaml.load(content); // Just check if it parses without error
                      saveConfigWithContent(configData);
                    } catch (yamlError) {
                      console.error(`[DbConfigEditor ${instanceId.current}] YAML validation failed:`, yamlError);
                      alert('The YAML content appears to be invalid. Please check your configuration.');
                    }
                  }
                }}
                height="calc(100vh - 160px)"
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
            
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <div className="mt-2">Loading diagram...</div>
              </div>
            ) : (
              <ERDiagram 
                yamlContent={yamlContent} 
                onDiagramChange={handleDiagramChange}
                theme={theme}
              />
            )}
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
      <Modal show={showSaveModal} onHide={handleCloseModal} centered>
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