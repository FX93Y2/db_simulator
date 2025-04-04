import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Row,
  Col,
  Form, 
  Button, 
  Modal,
  Spinner,
  InputGroup
} from 'react-bootstrap';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import YamlEditor from '../shared/YamlEditor';
import EventFlow from '../shared/EventFlow';
import { FiSave, FiArrowLeft, FiPlay, FiPlus } from 'react-icons/fi';

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

const SimConfigEditor = ({ projectId, isProjectTab, theme }) => {
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
  const instanceId = useRef(`simconfigeditor-${Math.random().toString(36).substr(2, 9)}`);
  const yamlUpdatesFromDiagram = useRef(0);
  const yamlUpdatesFromEditor = useRef(0);
  const isSaving = useRef(false);
  
  // Log component initialization
  useEffect(() => {
    console.log(`[SimConfigEditor ${instanceId.current}] Initialized with projectId: ${projectId}, isProjectTab: ${isProjectTab}`);
    return () => {
      console.log(`[SimConfigEditor ${instanceId.current}] Component unmounting`);
    };
  }, []);
  
  // Load existing configuration if editing
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      
      try {
        console.log(`[SimConfigEditor ${instanceId.current}] Loading configuration, projectId: ${projectId}, configId: ${configId}`);
        
        if (projectId) {
          // If we have a projectId, try to load the project's simulation config
          console.log(`[SimConfigEditor ${instanceId.current}] Loading project simulation config`);
          const result = await window.api.getProjectSimConfig(projectId);
          if (result.success && result.config) {
            console.log(`[SimConfigEditor ${instanceId.current}] Project simulation config loaded successfully, content length: ${result.config.content ? result.config.content.length : 0}`);
            setConfig(result.config);
            setName(result.config.name || `${result.projectName} Simulation`);
            setDescription(result.config.description || '');
            setYamlContent(result.config.content);
          } else {
            // New simulation config for this project
            console.log(`[SimConfigEditor ${instanceId.current}] No existing simulation config, creating new one`);
            setName(`${result.projectName || 'Project'} Simulation`);
            setYamlContent(DEFAULT_SIM_CONFIG);
          }
        } else if (configId) {
          // Load standalone config
          console.log(`[SimConfigEditor ${instanceId.current}] Loading standalone config by ID: ${configId}`);
          const result = await window.api.getConfig(configId);
          if (result.success) {
            console.log(`[SimConfigEditor ${instanceId.current}] Standalone config loaded successfully`);
            setConfig(result.config);
            setName(result.config.name);
            setDescription(result.config.description || '');
            setYamlContent(result.config.content);
          }
        } else {
          // New standalone configuration
          console.log(`[SimConfigEditor ${instanceId.current}] Creating new standalone simulation config`);
          setYamlContent(DEFAULT_SIM_CONFIG);
        }
      } catch (error) {
        console.error(`[SimConfigEditor ${instanceId.current}] Error loading configuration:`, error);
      } finally {
        setLoading(false);
      }
    };
    
    // Load database configurations for run simulation modal
    const loadDbConfigs = async () => {
      try {
        console.log(`[SimConfigEditor ${instanceId.current}] Loading database configurations`);
        
        if (projectId) {
          // Get project's database config
          console.log(`[SimConfigEditor ${instanceId.current}] Loading project database config`);
          const result = await window.api.getProjectDbConfig(projectId);
          if (result.success && result.config) {
            console.log(`[SimConfigEditor ${instanceId.current}] Project database config loaded successfully`);
            setDbConfigs([result.config]);
            setSelectedDbConfig(result.config.id);
          }
        } else {
          // Get all database configs
          console.log(`[SimConfigEditor ${instanceId.current}] Loading all database configs`);
          const result = await window.api.getConfigs('database');
          if (result.success) {
            console.log(`[SimConfigEditor ${instanceId.current}] Loaded ${result.configs ? result.configs.length : 0} database configs`);
            setDbConfigs(result.configs || []);
          }
        }
      } catch (error) {
        console.error(`[SimConfigEditor ${instanceId.current}] Error loading database configurations:`, error);
      }
    };
    
    loadConfig();
    loadDbConfigs();
  }, [configId, projectId]);
  
  // Handle YAML content changes
  const handleYamlChange = (content) => {
    console.log(`[SimConfigEditor ${instanceId.current}] YAML content changed from editor, length: ${content.length}`);
    yamlUpdatesFromEditor.current += 1;
    setYamlContent(content);
  };
  
  // Track YAML update counts
  useEffect(() => {
    console.log(`[SimConfigEditor ${instanceId.current}] YAML content updated, stats:`, {
      length: yamlContent ? yamlContent.length : 0,
      updatesFromEditor: yamlUpdatesFromEditor.current,
      updatesFromDiagram: yamlUpdatesFromDiagram.current
    });
  }, [yamlContent]);
  
  // Handle adding a new event
  const handleAddEvent = () => {
    try {
      console.log(`[SimConfigEditor ${instanceId.current}] Adding new event to YAML`);
      // Parse existing YAML
      const yaml = require('js-yaml');
      const parsedYaml = yaml.load(yamlContent) || {};
      
      // Ensure event_simulation structure exists
      if (!parsedYaml.event_simulation) {
        parsedYaml.event_simulation = {};
      }
      
      if (!parsedYaml.event_simulation.event_sequence) {
        parsedYaml.event_simulation.event_sequence = {};
      }
      
      if (!parsedYaml.event_simulation.event_sequence.event_types) {
        parsedYaml.event_simulation.event_sequence.event_types = [];
      }
      
      // Generate a unique event name
      const baseEventName = "NewEvent";
      let eventName = baseEventName;
      let counter = 1;
      
      while (parsedYaml.event_simulation.event_sequence.event_types.some(
        event => event.name === eventName)) {
        eventName = `${baseEventName}${counter}`;
        counter++;
      }
      
      console.log(`[SimConfigEditor ${instanceId.current}] Generated unique event name: ${eventName}`);
      
      // Add new event template
      parsedYaml.event_simulation.event_sequence.event_types.push({
        name: eventName,
        duration: {
          distribution: {
            type: "normal",
            mean: 5,
            stddev: 1
          }
        },
        resource_requirements: [
          {
            resource_table: "Resource",
            value: "Type1",
            count: 1
          }
        ]
      });
      
      // Convert back to YAML
      const updatedYaml = yaml.dump(parsedYaml, { lineWidth: 120 });
      console.log(`[SimConfigEditor ${instanceId.current}] Added new event, updating YAML content, new length: ${updatedYaml.length}`);
      yamlUpdatesFromEditor.current += 1;
      setYamlContent(updatedYaml);
      
    } catch (error) {
      console.error(`[SimConfigEditor ${instanceId.current}] Error adding event:`, error);
      alert('Failed to add event. Please check that your YAML is valid.');
    }
  };
  
  // Handle event flow diagram changes
  const handleDiagramChange = (updatedYaml) => {
    // Update the editor content with the changes from the diagram
    if (updatedYaml) {
      console.log(`[SimConfigEditor ${instanceId.current}] Diagram initiated YAML update, length: ${updatedYaml.length}`);
      yamlUpdatesFromDiagram.current += 1;
      setYamlContent(updatedYaml);
      
      // If in project context, also auto-save to ensure backend is updated
      if (projectId && isProjectTab) {
        console.log(`[SimConfigEditor ${instanceId.current}] Auto-saving after diagram change`);
        const configData = {
          name: name || 'Project Simulation',
          config_type: 'simulation',
          content: updatedYaml, // Use the updated YAML directly
          description
        };
        
        // Schedule this after state update to ensure we're using latest content
        setTimeout(() => {
          console.log(`[SimConfigEditor ${instanceId.current}] Executing delayed save after diagram change`);
          saveConfigWithContent(configData);
        }, 0);
      }
    }
  };
  
  // Toggle save modal
  const handleSave = () => {
    console.log(`[SimConfigEditor ${instanceId.current}] Save button clicked`);
    if (projectId && isProjectTab) {
      // For project tabs, save directly without the modal
      handleSaveConfig();
    } else {
      setShowSaveModal(true);
    }
  };
  
  // Toggle run simulation modal
  const handleRun = () => {
    console.log(`[SimConfigEditor ${instanceId.current}] Run button clicked`);
    setShowRunModal(true);
  };
  
  // Close save modal
  const handleCloseModal = () => {
    console.log(`[SimConfigEditor ${instanceId.current}] Closing save modal`);
    setShowSaveModal(false);
    setSaveAsNew(false);
  };
  
  // Close run modal
  const handleCloseRunModal = () => {
    console.log(`[SimConfigEditor ${instanceId.current}] Closing run modal`);
    setShowRunModal(false);
  };
  
  // Save the configuration
  const handleSaveConfig = async () => {
    console.log(`[SimConfigEditor ${instanceId.current}] Saving config with name: ${name}, YAML length: ${yamlContent ? yamlContent.length : 0}`);
    
    try {
      setLoading(true);
      
      if (!name && !projectId) {
        console.warn(`[SimConfigEditor ${instanceId.current}] Save failed - missing name`);
        alert('Please enter a name for the configuration');
        setLoading(false);
        return;
      }
      
      // Validate YAML content before sending
      try {
        const yaml = require('js-yaml');
        const parsedYaml = yaml.load(yamlContent);
        console.log(`[SimConfigEditor ${instanceId.current}] YAML validation passed:`, { hasContent: !!parsedYaml });
      } catch (yamlError) {
        console.error(`[SimConfigEditor ${instanceId.current}] YAML validation failed:`, yamlError);
        alert('The YAML content appears to be invalid. Please check your configuration.');
        setLoading(false);
        return;
      }
      
      const configData = {
        name: name || 'Project Simulation',
        config_type: 'simulation',
        content: yamlContent,
        description
      };
      
      console.log(`[SimConfigEditor ${instanceId.current}] Calling saveConfigWithContent`);
      
      // Call the shared save function with this config data
      await saveConfigWithContent(configData);
      
    } catch (error) {
      console.error(`[SimConfigEditor ${instanceId.current}] Error saving configuration:`, error);
      alert('Error saving configuration');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to save configuration with provided content
  const saveConfigWithContent = async (configData) => {
    if (isSaving.current) {
      console.log(`[SimConfigEditor ${instanceId.current}] Save already in progress, skipping duplicate call`);
      return;
    }
    
    try {
      console.log(`[SimConfigEditor ${instanceId.current}] Saving config with content length: ${configData.content.length}`);
      isSaving.current = true;
      setLoading(true);
      let result;
      
      if (projectId && isProjectTab) {
        // Save as project simulation config
        console.log(`[SimConfigEditor ${instanceId.current}] Saving project sim config for projectId: ${projectId}`);
        result = await window.api.saveProjectSimConfig(projectId, configData);
        
        if (result.success) {
          // Just update locally in project tab mode
          console.log(`[SimConfigEditor ${instanceId.current}] Project sim config saved successfully`);
          setConfig(result.config);
          
          // Add success message
          alert('Simulation configuration saved successfully');
        } else {
          console.error(`[SimConfigEditor ${instanceId.current}] Error saving project sim config:`, result);
          alert('Error saving configuration');
        }
      } else if (configId && !saveAsNew) {
        // Update existing standalone configuration
        console.log(`[SimConfigEditor ${instanceId.current}] Updating existing config with ID: ${configId}`);
        result = await window.api.updateConfig(configId, configData);
        
        if (result.success) {
          // Close modal and navigate back to dashboard
          console.log(`[SimConfigEditor ${instanceId.current}] Config updated successfully`);
          handleCloseModal();
          navigate('/');
        }
      } else {
        // Save as new standalone configuration
        console.log(`[SimConfigEditor ${instanceId.current}] Saving as new standalone config`);
        result = await window.api.saveConfig(configData);
        
        if (result.success) {
          // Close modal and navigate to the new config
          console.log(`[SimConfigEditor ${instanceId.current}] New config saved with ID: ${result.config_id}`);
          handleCloseModal();
          navigate(`/sim-config/${result.config_id}`);
        }
      }
      
      console.log(`[SimConfigEditor ${instanceId.current}] Save result:`, {
        success: result.success,
        message: result.message,
        config_id: result.config_id
      });
      
      if (!result.success) {
        console.error(`[SimConfigEditor ${instanceId.current}] Save failed:`, result);
        alert('Error saving configuration');
      }
      
      return result;
    } catch (error) {
      console.error(`[SimConfigEditor ${instanceId.current}] Error in saveConfigWithContent:`, error);
      alert('Error saving configuration');
      throw error;
    } finally {
      setLoading(false);
      isSaving.current = false;
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
      
      if (projectId) {
        // Save as project simulation config first
        const configData = {
          name: name || 'Project Simulation',
          config_type: 'simulation',
          content: yamlContent,
          description
        };
        
        const saveResult = await saveConfigWithContent(configData);
        
        if (!saveResult || !saveResult.success) {
          alert('Error saving simulation configuration');
          setLoading(false);
          return;
        }
        
        simConfigId = saveResult.config_id;
      } else if (!simConfigId || saveAsNew) {
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
        
        const saveResult = await saveConfigWithContent(configData);
        
        if (!saveResult || !saveResult.success) {
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
        
        if (projectId && isProjectTab) {
          // In project context, navigate to project results tab
          navigate(`/project/${projectId}/results/${encodeURIComponent(result.database_path)}`);
        } else {
          // Standalone navigation
          navigate(`/results/${encodeURIComponent(result.database_path)}`);
        }
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
  
  // Navigate back based on context
  const handleBack = () => {
    if (projectId && isProjectTab) {
      // In project tab context, stay in the current page
      // The tab navigation will be handled by the parent component
      return;
    } else if (projectId) {
      // Navigate back to project page
      navigate(`/project/${projectId}`);
    } else {
      // Navigate back to dashboard
      navigate('/');
    }
  };
  
  const renderEditor = () => (
    <div className="editor-container-split">
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
                  console.log(`[SimConfigEditor ${instanceId.current}] YamlEditor onSave callback triggered, content length: ${content.length}`);
                  // Update content first
                  handleYamlChange(content);
                  
                  // Auto-save if in project context
                  if (projectId && isProjectTab) {
                    console.log(`[SimConfigEditor ${instanceId.current}] Auto-saving from YamlEditor change`);
                    const configData = {
                      name: name || 'Project Simulation',
                      config_type: 'simulation',
                      content, // Use the content parameter directly
                      description
                    };
                    
                    // Validate YAML content before sending
                    try {
                      const yaml = require('js-yaml');
                      yaml.load(content); // Just check if it parses without error
                      saveConfigWithContent(configData);
                    } catch (yamlError) {
                      console.error(`[SimConfigEditor ${instanceId.current}] YAML validation failed:`, yamlError);
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
              <div>Event Flow</div>
              <Button 
                size="sm"
                className="btn-custom-toolbar"
                onClick={handleAddEvent}
                disabled={loading}
              >
                <FiPlus /> Add Event
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <div className="mt-2">Loading event flow...</div>
              </div>
            ) : (
              <EventFlow 
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
              {configId ? `Edit Simulation Configuration: ${name}` : 'New Simulation Configuration'}
            </h2>
          </div>
          <div>
            <Button 
              className="me-2 run-simulation-btn"
              onClick={handleRun}
              disabled={loading}
            >
              <FiPlay className="me-2" /> Run Simulation
            </Button>
          </div>
        </div>
      )}
      
      {renderEditor()}
      
      {/* Save Configuration Modal - only used for standalone configurations */}
      <Modal show={showSaveModal} onHide={handleCloseModal} centered>
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
            className="btn-custom-toolbar"
            onClick={handleSaveConfig}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : 'Save'}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Run Simulation Modal */}
      <Modal show={showRunModal} onHide={handleCloseRunModal} centered>
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
                disabled={projectId && dbConfigs.length === 1}
              >
                <option value="">Select a database configuration</option>
                {dbConfigs.map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {projectId ? 
                  "Using the project's database configuration" : 
                  "Select the database configuration to use for this simulation"}
              </Form.Text>
            </Form.Group>
            {!projectId && !configId && (
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
            {configId && !projectId && (
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
            className="btn-primary"
            onClick={handleRunSimulation}
            disabled={loading || !selectedDbConfig}
          >
            {loading ? <Spinner size="sm" /> : <><FiPlay className="me-2" /> Run</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SimConfigEditor; 