import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Row, Col, Badge, ListGroup, Alert } from 'react-bootstrap';
import { FiPlus, FiEdit2, FiTrash2, FiSettings } from 'react-icons/fi';
import yaml from 'yaml';
import useResourceDefinitions from '../../hooks/useResourceDefinitions';

const ResourceEditor = ({ yamlContent, onResourceChange, theme, dbConfigContent }) => {
  const [parsedData, setParsedData] = useState(null);
  const [previousResourceDefinitions, setPreviousResourceDefinitions] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedResourceType, setSelectedResourceType] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(null);
  
  // Use the custom hook to get resource definitions from database config
  const resourceDefinitions = useResourceDefinitions(dbConfigContent);

  // Parse YAML content when it changes
  useEffect(() => {
    try {
      if (yamlContent) {
        const parsed = yaml.parse(yamlContent);
        setParsedData(parsed);
      }
    } catch (error) {
      console.error('Error parsing YAML for resource editor:', error);
      setParsedData(null);
    }
  }, [yamlContent]);

  // Database configuration parsing is now handled by the useResourceDefinitions hook

  // Handle resource definition changes for rename detection
  useEffect(() => {
    // Detect resource renames and resource type renames, then update simulation configuration
    if (Object.keys(previousResourceDefinitions).length > 0 && parsedData && Object.keys(resourceDefinitions).length > 0) {
      const renamedResources = detectResourceRenames(previousResourceDefinitions, resourceDefinitions);
      const renamedResourceTypes = detectResourceTypeRenames(previousResourceDefinitions, resourceDefinitions);
      
      if (renamedResources.length > 0) {
        handleResourceRenames(renamedResources);
      }
      
      if (renamedResourceTypes.length > 0) {
        handleResourceTypeRenames(renamedResourceTypes);
      }
    }
    
    setPreviousResourceDefinitions(resourceDefinitions);
  }, [resourceDefinitions, previousResourceDefinitions, parsedData]);

  // Function to detect resource renames by comparing old and new resource definitions
  const detectResourceRenames = (oldDefinitions, newDefinitions) => {
    const renames = [];
    const oldNames = Object.keys(oldDefinitions);
    const newNames = Object.keys(newDefinitions);
    
    // Find resources that were removed from old definitions
    const removedNames = oldNames.filter(name => !newNames.includes(name));
    // Find resources that were added to new definitions
    const addedNames = newNames.filter(name => !oldNames.includes(name));
    
    // Match removed and added resources based on their resource types
    removedNames.forEach(oldName => {
      const oldResourceTypes = oldDefinitions[oldName].resourceTypes.sort();
      
      // Find a matching new resource with the same resource types
      const matchingNewName = addedNames.find(newName => {
        const newResourceTypes = newDefinitions[newName].resourceTypes.sort();
        return JSON.stringify(oldResourceTypes) === JSON.stringify(newResourceTypes);
      });
      
      if (matchingNewName) {
        renames.push({
          oldName,
          newName: matchingNewName
        });
        // Remove from added names to avoid duplicate matches
        const index = addedNames.indexOf(matchingNewName);
        if (index > -1) {
          addedNames.splice(index, 1);
        }
      }
    });
    
    return renames;
  };

  // Function to handle resource renames in the simulation configuration
  const handleResourceRenames = (renamedResources) => {
    if (!parsedData) return;

    const updatedData = JSON.parse(JSON.stringify(parsedData));
    
    // Ensure the structure exists
    if (!updatedData.event_simulation) {
      updatedData.event_simulation = {};
    }
    if (!updatedData.event_simulation.resource_capacities) {
      updatedData.event_simulation.resource_capacities = {};
    }

    const resourceCapacities = updatedData.event_simulation.resource_capacities;
    
    renamedResources.forEach(({ oldName, newName }) => {
      // If the old resource exists in the simulation configuration
      if (resourceCapacities[oldName]) {
        // Move the entire configuration from old name to new name
        resourceCapacities[newName] = resourceCapacities[oldName];
        // Remove the old entry
        delete resourceCapacities[oldName];
        
        console.log(`ResourceEditor: Renamed resource capacity configuration from "${oldName}" to "${newName}"`);
      }
      
      // Also update resource_table references in event sequence
      if (updatedData.event_simulation.event_sequence?.event_types) {
        updatedData.event_simulation.event_sequence.event_types.forEach(eventType => {
          if (eventType.resource_requirements) {
            eventType.resource_requirements.forEach(requirement => {
              if (requirement.resource_table === oldName) {
                requirement.resource_table = newName;
                console.log(`ResourceEditor: Updated resource_table reference from "${oldName}" to "${newName}" in event "${eventType.name}"`);
              }
            });
          }
        });
      }
    });

    // Update the simulation configuration
    onResourceChange(updatedData);
  };

  // Function to detect resource type renames within the same resource entity
  const detectResourceTypeRenames = (oldDefinitions, newDefinitions) => {
    const renames = [];
    
    // Check each resource entity that exists in both old and new definitions
    Object.keys(oldDefinitions).forEach(resourceName => {
      if (newDefinitions[resourceName]) {
        const oldResourceTypes = oldDefinitions[resourceName].resourceTypes;
        const newResourceTypes = newDefinitions[resourceName].resourceTypes;
        
        // Find resource types that were removed from old definitions
        const removedTypes = oldResourceTypes.filter(type => !newResourceTypes.includes(type));
        // Find resource types that were added to new definitions
        const addedTypes = newResourceTypes.filter(type => !oldResourceTypes.includes(type));
        
        // If we have the same number of removed and added types, assume they are renames
        if (removedTypes.length === addedTypes.length && removedTypes.length > 0) {
          // For simplicity, match them by position (first removed -> first added, etc.)
          // This works well for single renames, which is the most common case
          for (let i = 0; i < removedTypes.length; i++) {
            renames.push({
              resourceName,
              oldType: removedTypes[i],
              newType: addedTypes[i]
            });
          }
        }
      }
    });
    
    return renames;
  };

  // Function to handle resource type renames in the simulation configuration
  const handleResourceTypeRenames = (renamedResourceTypes) => {
    if (!parsedData) return;

    const updatedData = JSON.parse(JSON.stringify(parsedData));
    
    // Ensure the structure exists
    if (!updatedData.event_simulation) {
      updatedData.event_simulation = {};
    }
    if (!updatedData.event_simulation.resource_capacities) {
      updatedData.event_simulation.resource_capacities = {};
    }

    const resourceCapacities = updatedData.event_simulation.resource_capacities;
    
    renamedResourceTypes.forEach(({ resourceName, oldType, newType }) => {
      // Update capacity rules for the resource type
      if (resourceCapacities[resourceName]?.capacity_rules) {
        const capacityRules = resourceCapacities[resourceName].capacity_rules;
        const ruleIndex = capacityRules.findIndex(rule => rule.resource_type === oldType);
        
        if (ruleIndex >= 0) {
          capacityRules[ruleIndex].resource_type = newType;
          console.log(`ResourceEditor: Renamed resource type from "${oldType}" to "${newType}" in resource "${resourceName}"`);
        }
      }
      
      // Also update resource type references in event sequence
      if (updatedData.event_simulation.event_sequence?.event_types) {
        updatedData.event_simulation.event_sequence.event_types.forEach(eventType => {
          if (eventType.resource_requirements) {
            eventType.resource_requirements.forEach(requirement => {
              if (requirement.resource_table === resourceName && requirement.value === oldType) {
                requirement.value = newType;
                console.log(`ResourceEditor: Updated resource type reference from "${oldType}" to "${newType}" in event "${eventType.name}"`);
              }
            });
          }
        });
      }
    });

    // Update the simulation configuration
    onResourceChange(updatedData);
  };

  const resourceCapacities = parsedData?.event_simulation?.resource_capacities || {};

  // Handle immediate capacity changes with two-way binding
  const handleCapacityChange = (resourceName, resourceType, newCapacity) => {
    if (!parsedData) return;

    const updatedData = JSON.parse(JSON.stringify(parsedData));
    
    // Ensure the structure exists
    if (!updatedData.event_simulation) {
      updatedData.event_simulation = {};
    }
    if (!updatedData.event_simulation.resource_capacities) {
      updatedData.event_simulation.resource_capacities = {};
    }
    if (!updatedData.event_simulation.resource_capacities[resourceName]) {
      updatedData.event_simulation.resource_capacities[resourceName] = {
        capacity_rules: []
      };
    }

    const capacityRules = updatedData.event_simulation.resource_capacities[resourceName].capacity_rules;
    const ruleIndex = capacityRules.findIndex(rule => rule.resource_type === resourceType);
    
    if (ruleIndex >= 0) {
      capacityRules[ruleIndex].capacity = newCapacity;
    } else {
      // Add new rule if it doesn't exist
      capacityRules.push({
        resource_type: resourceType,
        capacity: newCapacity
      });
    }

    // Immediately update the simulation configuration
    onResourceChange(updatedData);
  };

  // Get current capacity value for a resource type
  const getCurrentCapacity = (resourceName, resourceType) => {
    const capacityRules = resourceCapacities[resourceName]?.capacity_rules || [];
    const rule = capacityRules.find(rule => rule.resource_type === resourceType);
    return rule?.capacity || 1; // Default to 1 if not found
  };

  const handleEditCapacity = (category, resourceType, capacity) => {
    setSelectedCategory(category);
    setSelectedResourceType(resourceType);
    setEditingCapacity(capacity);
    setShowEditModal(true);
  };

  // Auto-update capacity with real-time changes
  const handleCapacityUpdate = (newCapacity) => {
    if (!parsedData || !selectedCategory || !selectedResourceType) return;

    // Create a deep copy of the parsed data
    const updatedData = JSON.parse(JSON.stringify(parsedData));
    
    // Ensure the structure exists
    if (!updatedData.event_simulation) {
      updatedData.event_simulation = {};
    }
    if (!updatedData.event_simulation.resource_capacities) {
      updatedData.event_simulation.resource_capacities = {};
    }
    if (!updatedData.event_simulation.resource_capacities[selectedCategory]) {
      updatedData.event_simulation.resource_capacities[selectedCategory] = {
        capacity_rules: []
      };
    }

    // Find and update the capacity rule
    const capacityRules = updatedData.event_simulation.resource_capacities[selectedCategory].capacity_rules;
    const ruleIndex = capacityRules.findIndex(rule => rule.resource_type === selectedResourceType);
    
    if (ruleIndex >= 0) {
      capacityRules[ruleIndex].capacity = newCapacity.capacity;
      capacityRules[ruleIndex].resource_type = newCapacity.resource_type;
    } else {
      // Add new rule if it doesn't exist
      capacityRules.push({
        resource_type: newCapacity.resource_type,
        capacity: newCapacity.capacity
      });
    }

    // Convert back to YAML and update immediately
    onResourceChange(updatedData);
  };

  const renderCapacityBadge = (capacity) => {
    if (typeof capacity === 'number') {
      return <Badge bg="primary">Fixed: {capacity}</Badge>;
    } else if (capacity?.distribution) {
      const dist = capacity.distribution;
      if (dist.type === 'normal') {
        return <Badge bg="info">Normal: μ={dist.mean}, σ={dist.stddev}</Badge>;
      } else if (dist.type === 'choice') {
        return <Badge bg="warning">Choice: {dist.values?.length || 0} options</Badge>;
      }
    }
    return <Badge bg="secondary">Unknown</Badge>;
  };

  // Render input fields for each resource type with immediate two-way binding
  const renderResourceTypeInputs = (resourceName, definition) => {
    return (
      <div className="resource-type-inputs">
        {definition.resourceTypes.map(resourceType => {
          const currentCapacity = getCurrentCapacity(resourceName, resourceType);
          const isDistribution = typeof currentCapacity === 'object' && currentCapacity.distribution;
          
          return (
            <div key={resourceType} className="mb-3 p-3 border rounded">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0 fw-bold">{resourceType}</h6>
                <div className="d-flex align-items-center gap-2">
                  {renderCapacityBadge(currentCapacity)}
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => handleEditCapacity(resourceName, resourceType, currentCapacity)}
                    title="Edit advanced capacity settings"
                  >
                    <FiEdit2 />
                  </Button>
                </div>
              </div>
              
              {/* Simple capacity input for fixed values */}
              {!isDistribution && (
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-semibold">Capacity</Form.Label>
                      <Form.Control
                        type="number"
                        min="1"
                        value={currentCapacity}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value) || 1;
                          handleCapacityChange(resourceName, resourceType, newValue);
                        }}
                        placeholder="Enter capacity"
                        size="sm"
                      />
                      <Form.Text className="text-muted small">
                        Fixed capacity for {resourceType}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              )}
              
              {/* Compact distribution summary for complex values */}
              {isDistribution && (
                <div className="alert alert-info py-2 px-3 mb-0 small">
                  <strong>Distribution Configuration:</strong> This resource type uses a {currentCapacity.distribution.type} distribution.
                  Click the edit button above to modify the distribution parameters.
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderResourceCategories = () => {
    const resourceNames = Object.keys(resourceDefinitions);
    
    if (resourceNames.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-muted">No resource entities found in database configuration</p>
          {!dbConfigContent && (
            <p className="text-muted small">
              Database configuration not available. Please ensure a database configuration is loaded.
            </p>
          )}
        </div>
      );
    }

    return resourceNames.map(resourceName => {
      const definition = resourceDefinitions[resourceName];
      return (
        <Card key={resourceName} className="mb-3">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <div>
              <h6 className="mb-0">
                <FiSettings className="me-2" />
                {resourceName}
              </h6>
              <small className="text-muted">
                Resource types: {definition.resourceTypes.join(', ')}
              </small>
            </div>
          </Card.Header>
          <Card.Body>
            {renderResourceTypeInputs(resourceName, definition)}
          </Card.Body>
        </Card>
      );
    });
  };

  return (
    <div className="resource-editor">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-0">Resource Capacities</h5>
          {Object.keys(resourceDefinitions).length > 0 && (
            <small className="text-muted">
              Available resources in database configuration
            </small>
          )}
        </div>
      </div>
      
      {!dbConfigContent && (
        <Alert variant="warning" className="mb-3">
          <strong>Database configuration not available.</strong> 
          Resource types cannot be auto-detected. Please ensure a database configuration is loaded.
        </Alert>
      )}
      
      {renderResourceCategories()}

      <CapacityEditModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        resourceType={selectedResourceType}
        capacity={editingCapacity}
        onUpdate={handleCapacityUpdate}
      />
    </div>
  );
};

// Modal component for editing capacity
const CapacityEditModal = ({ show, onHide, resourceType, capacity, onUpdate }) => {
  const [editedResourceType, setEditedResourceType] = useState('');
  const [capacityType, setCapacityType] = useState('fixed');
  const [fixedValue, setFixedValue] = useState(1);
  const [normalMean, setNormalMean] = useState(1);
  const [normalStddev, setNormalStddev] = useState(0.5);
  const [normalMin, setNormalMin] = useState(1);
  const [normalMax, setNormalMax] = useState(5);
  const [choiceValues, setChoiceValues] = useState([{ value: 1, weight: 1 }]);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [lastResourceType, setLastResourceType] = useState(null);

  useEffect(() => {
    // Only reset form data when resourceType actually changes (new modal opened), not during auto-updates
    if (show && resourceType && capacity !== null && (!lastResourceType || resourceType !== lastResourceType)) {
      setLastResourceType(resourceType);
      setIsUserEditing(false);
      setEditedResourceType(resourceType);
      
      if (typeof capacity === 'number') {
        setCapacityType('fixed');
        setFixedValue(capacity);
      } else if (capacity?.distribution) {
        const dist = capacity.distribution;
        if (dist.type === 'normal') {
          setCapacityType('normal');
          setNormalMean(dist.mean || 1);
          setNormalStddev(dist.stddev || 0.5);
          setNormalMin(dist.min || 1);
          setNormalMax(dist.max || 5);
        } else if (dist.type === 'choice') {
          setCapacityType('choice');
          const values = dist.values || [1];
          const weights = dist.weights || [1];
          const pairs = values.map((value, index) => ({
            value,
            weight: weights[index] || 1
          }));
          setChoiceValues(pairs);
        }
      }
    }
  }, [show, resourceType, capacity, lastResourceType]);

  // Auto-update capacity with debouncing
  useEffect(() => {
    if (!show || !editedResourceType || !isUserEditing) return;
    
    const timeoutId = setTimeout(() => {
      let capacityValue;
      
      if (capacityType === 'fixed') {
        capacityValue = fixedValue;
      } else if (capacityType === 'normal') {
        capacityValue = {
          distribution: {
            type: 'normal',
            mean: normalMean,
            stddev: normalStddev,
            min: normalMin,
            max: normalMax
          }
        };
      } else if (capacityType === 'choice') {
        capacityValue = {
          distribution: {
            type: 'choice',
            values: choiceValues.map(pair => pair.value),
            weights: choiceValues.map(pair => pair.weight)
          }
        };
      }
      
      onUpdate({
        resource_type: editedResourceType,
        capacity: capacityValue
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [capacityType, fixedValue, normalMean, normalStddev, normalMin, normalMax, choiceValues, editedResourceType, onUpdate, show, isUserEditing]);

  // Helper functions to handle form changes and mark as user editing
  const handleCapacityTypeChange = (newType) => {
    setIsUserEditing(true);
    setCapacityType(newType);
  };

  const handleFixedValueChange = (newValue) => {
    setIsUserEditing(true);
    setFixedValue(newValue);
  };

  const handleNormalMeanChange = (newMean) => {
    setIsUserEditing(true);
    setNormalMean(newMean);
  };

  const handleNormalStddevChange = (newStddev) => {
    setIsUserEditing(true);
    setNormalStddev(newStddev);
  };

  const handleNormalMinChange = (newMin) => {
    setIsUserEditing(true);
    setNormalMin(newMin);
  };

  const handleNormalMaxChange = (newMax) => {
    setIsUserEditing(true);
    setNormalMax(newMax);
  };

  const addChoicePair = () => {
    setIsUserEditing(true);
    setChoiceValues([...choiceValues, { value: 1, weight: 1 }]);
  };

  const removeChoicePair = (index) => {
    if (choiceValues.length > 1) {
      setIsUserEditing(true);
      setChoiceValues(choiceValues.filter((_, i) => i !== index));
    }
  };

  const updateChoicePair = (index, field, value) => {
    setIsUserEditing(true);
    const updated = [...choiceValues];
    updated[index][field] = parseFloat(value) || 0;
    setChoiceValues(updated);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Edit Resource Capacity</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Resource Type</Form.Label>
            <Form.Control
              type="text"
              value={editedResourceType}
              onChange={(e) => setEditedResourceType(e.target.value)}
              disabled
            />
            <Form.Text className="text-muted">
              Resource type is defined by the database configuration and cannot be changed.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Capacity Type</Form.Label>
            <Form.Select
              value={capacityType}
              onChange={(e) => handleCapacityTypeChange(e.target.value)}
            >
              <option value="fixed">Fixed Capacity</option>
              <option value="normal">Normal Distribution</option>
              <option value="choice">Choice Distribution</option>
            </Form.Select>
          </Form.Group>

          {capacityType === 'fixed' && (
            <Form.Group className="mb-3">
              <Form.Label>Capacity</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={fixedValue}
                onChange={(e) => handleFixedValueChange(parseInt(e.target.value) || 1)}
              />
            </Form.Group>
          )}

          {capacityType === 'normal' && (
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mean</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.1"
                    value={normalMean}
                    onChange={(e) => handleNormalMeanChange(parseFloat(e.target.value) || 0)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Standard Deviation</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.1"
                    min="0"
                    value={normalStddev}
                    onChange={(e) => handleNormalStddevChange(parseFloat(e.target.value) || 0)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Minimum</Form.Label>
                  <Form.Control
                    type="number"
                    value={normalMin}
                    onChange={(e) => handleNormalMinChange(parseInt(e.target.value) || 0)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Maximum</Form.Label>
                  <Form.Control
                    type="number"
                    value={normalMax}
                    onChange={(e) => handleNormalMaxChange(parseInt(e.target.value) || 0)}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}

          {capacityType === 'choice' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Form.Label>Value/Weight Pairs</Form.Label>
                <Button variant="outline-primary" size="sm" onClick={addChoicePair}>
                  <FiPlus className="me-1" />
                  Add Pair
                </Button>
              </div>
              {choiceValues.map((pair, index) => (
                <Row key={index} className="mb-2">
                  <Col md={5}>
                    <Form.Control
                      type="number"
                      placeholder="Value"
                      value={pair.value}
                      onChange={(e) => updateChoicePair(index, 'value', e.target.value)}
                    />
                  </Col>
                  <Col md={5}>
                    <Form.Control
                      type="number"
                      step="0.1"
                      placeholder="Weight"
                      value={pair.weight}
                      onChange={(e) => updateChoicePair(index, 'weight', e.target.value)}
                    />
                  </Col>
                  <Col md={2}>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeChoicePair(index)}
                      disabled={choiceValues.length === 1}
                    >
                      <FiTrash2 />
                    </Button>
                  </Col>
                </Row>
              ))}
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ResourceEditor;