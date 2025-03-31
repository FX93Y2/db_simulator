import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Form, 
  Button, 
  Tab, 
  Tabs, 
  Modal,
  Spinner 
} from 'react-bootstrap';
import YamlEditor from '../shared/YamlEditor';
import ERDiagram from '../shared/ERDiagram';
import { FiSave, FiArrowLeft } from 'react-icons/fi';

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

const DbConfigEditor = () => {
  const { configId } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [yamlContent, setYamlContent] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  
  // Load existing configuration if editing
  useEffect(() => {
    const loadConfig = async () => {
      if (configId) {
        try {
          setLoading(true);
          const result = await window.api.getConfig(configId);
          if (result.success) {
            setConfig(result.config);
            setName(result.config.name);
            setDescription(result.config.description || '');
            setYamlContent(result.config.content);
          }
        } catch (error) {
          console.error('Error loading configuration:', error);
        } finally {
          setLoading(false);
        }
      } else {
        // New configuration
        setYamlContent(DEFAULT_DB_CONFIG);
      }
    };
    
    loadConfig();
  }, [configId]);
  
  // Handle YAML content changes
  const handleYamlChange = (content) => {
    setYamlContent(content);
  };
  
  // Handle ER diagram changes (not fully implemented)
  const handleDiagramChange = (schema) => {
    // This would need to convert the schema back to YAML
    console.log('Diagram changed:', schema);
  };
  
  // Toggle save modal
  const handleSave = () => {
    setShowSaveModal(true);
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
        description
      };
      
      let result;
      
      if (configId && !saveAsNew) {
        // Update existing configuration
        result = await window.api.updateConfig(configId, configData);
      } else {
        // Save as new configuration
        result = await window.api.saveConfig(configData);
      }
      
      if (result.success) {
        // Close modal and navigate back to dashboard
        handleCloseModal();
        navigate('/dashboard');
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
  
  return (
    <div className="db-config-editor">
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <Button 
            variant="outline-secondary" 
            className="me-3"
            onClick={() => navigate('/dashboard')}
          >
            <FiArrowLeft /> Back
          </Button>
          <h2 className="mb-0">
            {configId ? `Edit Database Configuration: ${name}` : 'New Database Configuration'}
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
      
      <Tabs 
        defaultActiveKey="editor" 
        className="mb-4"
      >
        <Tab eventKey="editor" title="YAML Editor">
          {loading && !yamlContent ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2">Loading configuration...</div>
            </div>
          ) : (
            <YamlEditor 
              initialValue={yamlContent} 
              onSave={handleYamlChange} 
            />
          )}
        </Tab>
        <Tab eventKey="diagram" title="ER Diagram">
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
        </Tab>
      </Tabs>
      
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
            {configId && (
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