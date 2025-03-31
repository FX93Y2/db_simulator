import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Form, 
  Button, 
  Tab, 
  Tabs, 
  Modal,
  Spinner,
  InputGroup
} from 'react-bootstrap';
import YamlEditor from '../shared/YamlEditor';
import EventFlow from '../shared/EventFlow';
import { FiSave, FiArrowLeft, FiPlay } from 'react-icons/fi';

// Default template for a new simulation configuration
const DEFAULT_SIM_CONFIG = `# Simulation Configuration Template
simulation:
  duration_days: 30
  start_date: 2024-01-01
  random_seed: 42

event_simulation:
  table_specification:
    entity_table: Project
    event_table: Deliverable
    resource_table: Consultant
  
  entity_arrival:
    interarrival_time:
      distribution:
        type: exponential
        scale: 5
    max_entities: 50
  
  event_sequence:
    event_types:
      - name: Event1
        duration:
          distribution:
            type: normal
            mean: 3
            stddev: 0.5
        resource_requirements:
          - resource_table: Consultant
            value: Developer
            count: 1
      
      - name: Event2
        duration:
          distribution:
            type: normal
            mean: 5
            stddev: 1
        resource_requirements:
          - resource_table: Consultant
            value: Developer
            count: 2
    
    transitions:
      - from: Event1
        to:
          - event_type: Event2
            probability: 1.0
`;

const SimConfigEditor = () => {
  const { configId } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [yamlContent, setYamlContent] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [dbConfigs, setDbConfigs] = useState([]);
  const [selectedDbConfig, setSelectedDbConfig] = useState('');
  
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
        setYamlContent(DEFAULT_SIM_CONFIG);
      }
    };
    
    // Load database configurations for run simulation modal
    const loadDbConfigs = async () => {
      try {
        const result = await window.api.getConfigs('database');
        if (result.success) {
          setDbConfigs(result.configs || []);
        }
      } catch (error) {
        console.error('Error loading database configurations:', error);
      }
    };
    
    loadConfig();
    loadDbConfigs();
  }, [configId]);
  
  // Handle YAML content changes
  const handleYamlChange = (content) => {
    setYamlContent(content);
  };
  
  // Handle event flow diagram changes (not fully implemented)
  const handleDiagramChange = (schema) => {
    // This would need to convert the schema back to YAML
    console.log('Event flow changed:', schema);
  };
  
  // Toggle save modal
  const handleSave = () => {
    setShowSaveModal(true);
  };
  
  // Toggle run simulation modal
  const handleRun = () => {
    setShowRunModal(true);
  };
  
  // Close save modal
  const handleCloseModal = () => {
    setShowSaveModal(false);
    setSaveAsNew(false);
  };
  
  // Close run modal
  const handleCloseRunModal = () => {
    setShowRunModal(false);
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
        config_type: 'simulation',
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
  
  // Run the simulation
  const handleRunSimulation = async () => {
    try {
      setLoading(true);
      
      if (!selectedDbConfig) {
        alert('Please select a database configuration');
        setLoading(false);
        return;
      }
      
      // First, save the current simulation configuration if needed
      let simConfigId = configId;
      if (!simConfigId || saveAsNew) {
        if (!name) {
          alert('Please enter a name for the configuration');
          setLoading(false);
          return;
        }
        
        const saveResult = await window.api.saveConfig({
          name,
          config_type: 'simulation',
          content: yamlContent,
          description
        });
        
        if (!saveResult.success) {
          alert('Error saving simulation configuration');
          setLoading(false);
          return;
        }
        
        simConfigId = saveResult.config_id;
      }
      
      // Run the simulation
      const result = await window.api.generateAndSimulate({
        db_config_id: selectedDbConfig,
        sim_config_id: simConfigId
      });
      
      if (result.success) {
        // Close modal and navigate to results
        handleCloseRunModal();
        navigate(`/results/${encodeURIComponent(result.database_path)}`);
      } else {
        alert('Error running simulation');
      }
    } catch (error) {
      console.error('Error running simulation:', error);
      alert('Error running simulation');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="sim-config-editor">
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
            {configId ? `Edit Simulation Configuration: ${name}` : 'New Simulation Configuration'}
          </h2>
        </div>
        <div>
          <Button 
            variant="success" 
            className="me-2"
            onClick={handleRun}
            disabled={loading}
          >
            <FiPlay /> Run Simulation
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
            disabled={loading}
          >
            <FiSave /> Save
          </Button>
        </div>
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
        <Tab eventKey="flow" title="Event Flow">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <div className="mt-2">Loading event flow...</div>
            </div>
          ) : (
            <EventFlow 
              yamlContent={yamlContent} 
              onDiagramChange={handleDiagramChange} 
            />
          )}
        </Tab>
      </Tabs>
      
      {/* Save Configuration Modal */}
      <Modal show={showSaveModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Save Simulation Configuration</Modal.Title>
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
      
      {/* Run Simulation Modal */}
      <Modal show={showRunModal} onHide={handleCloseRunModal}>
        <Modal.Header closeButton>
          <Modal.Title>Run Simulation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Database Configuration</Form.Label>
              <Form.Select 
                value={selectedDbConfig} 
                onChange={(e) => setSelectedDbConfig(e.target.value)}
                required
              >
                <option value="">Select a database configuration</option>
                {dbConfigs.map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Select the database configuration to use for this simulation
              </Form.Text>
            </Form.Group>
            {!configId && (
              <>
                <hr />
                <p>The simulation configuration will be saved before running.</p>
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
                    rows={2} 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </Form.Group>
              </>
            )}
            {configId && (
              <Form.Group className="mb-3">
                <Form.Check 
                  type="checkbox" 
                  label="Save as a new configuration before running" 
                  checked={saveAsNew}
                  onChange={(e) => setSaveAsNew(e.target.checked)}
                />
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseRunModal}>
            Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={handleRunSimulation}
            disabled={loading || !selectedDbConfig}
          >
            {loading ? <Spinner size="sm" /> : <><FiPlay /> Run</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SimConfigEditor; 