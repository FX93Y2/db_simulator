import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Form, 
  Button, 
  Modal,
  Spinner 
} from 'react-bootstrap';
import SplitPane from 'react-split-pane';
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

const DbConfigEditor = ({ projectId, isProjectTab = false }) => {
  const { configId } = useParams();
  const [config, setConfig] = useState(null);
  const [yamlContent, setYamlContent] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  
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
    setYamlContent(content);
  };
  
  // Handle ER diagram changes (not fully implemented)
  const handleDiagramChange = (schema) => {
    // This would need to convert the schema back to YAML
    console.log('Diagram changed:', schema);
  };
  
  // Handle adding a new table
  const handleAddTable = () => {
    try {
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
      setYamlContent(updatedYaml);
      
    } catch (error) {
      console.error('Error adding table:', error);
      alert('Failed to add table. Please check that your YAML is valid.');
    }
  };
  
  // Save configuration
  const handleSave = () => {
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
    try {
      setLoading(true);
      
      if (!name) {
        alert('Please enter a name for the configuration');
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
      
      let result;
      
      if (projectId && isProjectTab) {
        // Save within project context
        result = await window.api.saveProjectDbConfig(projectId, configData);
      } else if (config && !saveAsNew) {
        // Update existing configuration
        result = await window.api.updateConfig(config.id, configData);
      } else {
        // Save as new configuration
        result = await window.api.saveConfig(configData);
      }
      
      if (result.success) {
        // Close modal if showing
        if (showSaveModal) {
          handleCloseModal();
        }
        
        if (result.config) {
          setConfig(result.config);
        }
        
        // Show save confirmation
        alert('Configuration saved successfully');
      } else {
        alert('Error saving configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration');
    } finally {
      setLoading(false);
    }
  };
  
  // In project tab mode, we don't show the header and back button
  const renderEditor = () => (
    <div className="editor-container-split">
      <SplitPane
        split="vertical"
        minSize={200}
        defaultSize="40%"
        style={{ position: 'relative' }}
        paneStyle={{ overflow: 'auto' }}
      >
        <div className="editor-yaml-panel">
          <div className="panel-header">YAML Editor</div>
          {loading && !yamlContent ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2">Loading configuration...</div>
            </div>
          ) : (
            <YamlEditor 
              initialValue={yamlContent} 
              onSave={handleYamlChange}
              height="calc(100vh - 160px)"
            />
          )}
        </div>
        
        <div className="editor-canvas-panel">
          <div className="canvas-header d-flex justify-content-between align-items-center">
            <div>ER Diagram</div>
            <Button 
              variant="primary" 
              size="sm"
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
            />
          )}
        </div>
      </SplitPane>
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
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <Spinner size="sm" /> : <FiSave />} Save
        </Button>
      </div>
      
      {renderEditor()}
      
      {/* Save Configuration Modal */}
      <Modal show={showSaveModal} onHide={handleCloseModal}>
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
            variant="primary" 
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