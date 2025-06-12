import React, { useState, useEffect, useCallback } from 'react';
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
import yaml from 'yaml';
import YamlEditor from '../shared/YamlEditor';
import EventFlow from '../shared/EventFlow';
import { FiSave, FiArrowLeft, FiPlay, FiPlus } from 'react-icons/fi';
import { useToastContext } from '../../contexts/ToastContext';

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
  const { showSuccess, showError, showWarning } = useToastContext();
  const [config, setConfig] = useState(null);
  const [yamlContent, setYamlContent] = useState('');
  const [parsedYamlObject, setParsedYamlObject] = useState(null);
  const [yamlError, setYamlError] = useState(null);
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
      setLoading(true);
      
      try {
        if (projectId) {
          // If we have a projectId, try to load the project's simulation config
          const result = await window.api.getProjectSimConfig(projectId);
          if (result.success && result.config) {
            setConfig(result.config);
            setName(result.config.name || `${result.projectName} Simulation`);
            setDescription(result.config.description || '');
            setYamlContent(result.config.content);
          } else {
            // New simulation config for this project
            setName(`${result.projectName || 'Project'} Simulation`);
            setYamlContent(DEFAULT_SIM_CONFIG);
          }
        } else if (configId) {
          // Load standalone config
          const result = await window.api.getConfig(configId);
          if (result.success) {
            setConfig(result.config);
            setName(result.config.name);
            setDescription(result.config.description || '');
            setYamlContent(result.config.content);
          }
        } else {
          // New standalone configuration
          setYamlContent(DEFAULT_SIM_CONFIG);
        }
      } catch (error) {
        console.error('Error loading configuration:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Load database configurations for run simulation modal
    const loadDbConfigs = async () => {
      try {
        if (projectId) {
          // Get project's database config
          const result = await window.api.getProjectDbConfig(projectId);
          if (result.success && result.config) {
            setDbConfigs([result.config]);
            setSelectedDbConfig(result.config.id);
          }
        } else {
          // Get all database configs
          const result = await window.api.getConfigs('database');
          if (result.success) {
            setDbConfigs(result.configs || []);
          }
        }
      } catch (error) {
        console.error('Error loading database configurations:', error);
      }
    };
    
    loadConfig();
    loadDbConfigs();
  }, [configId, projectId]);
  
  // Effect to parse YAML content whenever it changes
  useEffect(() => {
    try {
      if (yamlContent) {
        // Use parseDocument to keep track of structure/comments if needed later
        const doc = yaml.parseDocument(yamlContent);
        // Check for parse errors reported by the document model
         if (doc.errors && doc.errors.length > 0) {
          console.error("YAML Parsing Errors:", doc.errors);
          setYamlError(doc.errors[0]); // Store first error
          setParsedYamlObject(null); // Clear parsed object on error
        } else {
          setParsedYamlObject(doc.toJSON()); // Store the JS object representation
          setYamlError(null); // Clear errors on successful parse
        }
      } else {
         setParsedYamlObject(null);
         setYamlError(null);
      }
    } catch (e) {
      // Catch errors not caught by parseDocument.errors (e.g., completely invalid syntax)
      console.error("YAML Parsing Exception:", e);
      setYamlError(e);
      setParsedYamlObject(null);
    }
  }, [yamlContent]);
  
  // Handle YAML content changes from editor
  const handleYamlChange = useCallback((content) => {
     setYamlContent(content);
     // Parsing happens in the useEffect above
  }, []);
  
  // Handle diagram changes - expects object, stringifies it
  const handleDiagramChange = useCallback((updatedDiagramData) => {
    try {
      // updatedDiagramData is the JS object from EventFlow
      const updatedYaml = yaml.stringify(updatedDiagramData);
      setYamlContent(updatedYaml); // Update string state, triggers re-parse effect
      setParsedYamlObject(updatedDiagramData); // Optimistically update parsed state
      setYamlError(null); // Assume diagram changes produce valid structure
    } catch (error) {
      console.error('Error stringifying diagram changes:', error);
      setYamlError(error);
    }
  }, []);
  
  // Handle adding a new event - operates on object if possible
  const handleAddEvent = () => {
    if (yamlError || !parsedYamlObject) {
        showError('Cannot add event: Current YAML has errors or is empty.');
        return;
    }

    try {
      // Work on a deep copy of the parsed object
      const updatedSchema = JSON.parse(JSON.stringify(parsedYamlObject));

      // ... (logic to add new event to updatedSchema, similar to before but using the object) ...
      if (!updatedSchema.event_simulation) updatedSchema.event_simulation = {};
      if (!updatedSchema.event_simulation.event_sequence) updatedSchema.event_simulation.event_sequence = {};
      if (!updatedSchema.event_simulation.event_sequence.event_types) updatedSchema.event_simulation.event_sequence.event_types = [];
       // (Unique name generation logic)
      const baseEventName = "NewEvent";
      let eventName = baseEventName;
      let counter = 1;
      while (updatedSchema.event_simulation.event_sequence.event_types.some(
        event => event.name === eventName)) {
        eventName = `${baseEventName}${counter}`;
        counter++;
      }
      // (Add event template)
      updatedSchema.event_simulation.event_sequence.event_types.push({
        name: eventName,
        duration: { distribution: { type: "normal", mean: 5, stddev: 1 } },
        resource_requirements: [{ resource_table: "Resource", value: "Type1", count: 1 }]
      });


      // Convert back to YAML and update state
      const updatedYaml = yaml.stringify(updatedSchema);
      setYamlContent(updatedYaml); // Update string state, triggers re-parse
      setParsedYamlObject(updatedSchema); // Optimistically update parsed state

    } catch (error) {
      console.error('Error adding event:', error);
      showError('Failed to add event.');
      setYamlError(error);
    }
  };
  
  // Toggle save modal
  const handleSave = () => {
    console.log("SimConfigEditor: handleSave button clicked");
    if (projectId && isProjectTab) {
      // For project tabs, save directly without the modal
      handleSaveConfig();
    } else {
      setShowSaveModal(true);
    }
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
    console.log("SimConfigEditor: handleSaveConfig called with:", { 
      name, 
      hasContent: !!yamlContent && yamlContent.length > 0,
      yamlContentLength: yamlContent ? yamlContent.length : 0,
      projectId,
      configId,
      saveAsNew 
    });
    
    try {
      setLoading(true);
      
      if (!name && !projectId) {
        showError('Please enter a name for the configuration');
        setLoading(false);
        return;
      }
      
      // Check for YAML errors before saving
      if (yamlError) {
          console.error("SimConfigEditor: Cannot save due to YAML errors:", yamlError);
          showError(`Cannot save configuration. Please fix the YAML errors first.\nError: ${yamlError.message || 'Invalid YAML'}`);
          setLoading(false);
          return;
      }
      
      const configData = {
        name: name || 'Project Simulation',
        config_type: 'simulation',
        content: yamlContent,
        description
      };
      
      console.log("SimConfigEditor: About to save with configData:", configData);
      
      // Call the shared save function with this config data
      await saveConfigWithContent(configData);
      
    } catch (error) {
      console.error('SimConfigEditor: Error saving configuration:', error);
      showError('Error saving configuration');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to save configuration with provided content
  // This separates the saving logic from building the config object
  const saveConfigWithContent = async (configData) => {
    try {
      setLoading(true);
      let result;
      
      if (projectId && isProjectTab) {
        // Save as project simulation config
        console.log("SimConfigEditor: Saving as project sim config, projectId:", projectId);
        result = await window.api.saveProjectSimConfig(projectId, configData);
        
        if (result.success) {
          // Just update locally in project tab mode
          console.log("SimConfigEditor: Save successful, updating local config");
          setConfig(result.config);
          
          // Add success message
          showSuccess('Simulation configuration saved successfully');
        } else {
          console.error("SimConfigEditor: Error saving configuration:", result);
          showError('Error saving configuration');
        }
      } else if (configId && !saveAsNew) {
        // Update existing standalone configuration
        console.log("SimConfigEditor: Updating existing config, configId:", configId);
        result = await window.api.updateConfig(configId, configData);
        
        if (result.success) {
          // Close modal and navigate back to dashboard
          console.log("SimConfigEditor: Update successful, closing modal and navigating");
          handleCloseModal();
          navigate('/');
        }
      } else {
        // Save as new standalone configuration
        console.log("SimConfigEditor: Saving as new standalone config");
        result = await window.api.saveConfig(configData);
        
        if (result.success) {
          // Close modal and navigate to the new config
          console.log("SimConfigEditor: Save successful, closing modal and navigating to new config");
          handleCloseModal();
          navigate(`/sim-config/${result.config_id}`);
        }
      }
      
      console.log("SimConfigEditor: Save result:", result);
      
      if (!result.success) {
        console.error("SimConfigEditor: Error: result.success is false", result);
        showError('Error saving configuration');
      }
      
      return result;
    } catch (error) {
      console.error('SimConfigEditor: Error in saveConfigWithContent:', error);
      showError('Error saving configuration');
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Run the simulation
  const handleRunSimulation = async () => {
    try {
      setLoading(true);
      
      if (!selectedDbConfig) {
        showError('Please select a database configuration');
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
          showError('Error saving simulation configuration');
          setLoading(false);
          return;
        }
        
        simConfigId = saveResult.config_id;
      } else if (!simConfigId || saveAsNew) {
        if (!name) {
          showError('Please enter a name for the configuration');
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
          showError('Error saving simulation configuration');
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
        showError('Error running simulation');
      }
    } catch (error) {
      console.error('Error running simulation:', error);
      showError('Error running simulation');
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
                onChange={handleYamlChange}
                onSave={null}
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
                parsedSchema={parsedYamlObject}
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
              className="run-simulation-btn"
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
      <Modal
        show={showSaveModal}
        onHide={handleCloseModal}
        centered
        enforceFocus={false}
      >
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
      <Modal
        show={showRunModal}
        onHide={handleCloseRunModal}
        centered
        enforceFocus={false}
      >
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