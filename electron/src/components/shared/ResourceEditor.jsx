import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Row, Col } from 'react-bootstrap';
import { FiEdit2 } from 'react-icons/fi';
import yaml from 'yaml';
import useResourceDefinitions from '../../hooks/shared/useResourceDefinitions';
import { ResourceDataTable } from './DataTable';

const ResourceEditor = ({ yamlContent, onResourceChange, theme, dbConfigContent }) => {
  const [parsedData, setParsedData] = useState(null);
  const [previousResourceDefinitions, setPreviousResourceDefinitions] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [editingResourceType, setEditingResourceType] = useState('');
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

  // Handle resource definition changes for rename detection
  useEffect(() => {
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

  // Get current capacity for a resource type
  const getCurrentCapacity = (resourceName, resourceType) => {
    if (!parsedData?.simulation?.resources) return 1;
    
    const resource = parsedData.simulation.resources.find(r => r.resource_table === resourceName);
    if (!resource?.capacities) return 1;
    
    return resource.capacities[resourceType] || 1;
  };

  // Handle capacity edit
  const handleEditCapacity = (resourceName, resourceType) => {
    const currentCapacity = getCurrentCapacity(resourceName, resourceType);
    setEditingResource(resourceName);
    setEditingResourceType(resourceType);
    setEditingCapacity(currentCapacity);
    setShowEditModal(true);
  };

  // Handle capacity update
  const handleCapacityUpdate = (newCapacity) => {
    if (!parsedData) return;

    const updatedData = { ...parsedData };
    
    // Ensure simulation.resources exists
    if (!updatedData.simulation) {
      updatedData.simulation = {};
    }
    if (!updatedData.simulation.resources) {
      updatedData.simulation.resources = [];
    }

    // Find or create resource entry
    let resourceEntry = updatedData.simulation.resources.find(r => r.resource_table === editingResource);
    if (!resourceEntry) {
      resourceEntry = {
        resource_table: editingResource,
        capacities: {}
      };
      updatedData.simulation.resources.push(resourceEntry);
    }

    // Ensure capacities object exists
    if (!resourceEntry.capacities) {
      resourceEntry.capacities = {};
    }

    // Update capacity
    resourceEntry.capacities[editingResourceType] = newCapacity;

    // Convert back to YAML and notify parent
    const newYamlContent = yaml.stringify(updatedData);
    if (onResourceChange) {
      onResourceChange(newYamlContent);
    }

    setShowEditModal(false);
  };

  // Format capacity display
  const formatCapacity = (capacity) => {
    if (typeof capacity === 'number') {
      return capacity.toString();
    }
    if (capacity?.distribution) {
      const dist = capacity.distribution;
      if (dist.type === 'normal') {
        return `Normal(μ=${dist.mean}, σ=${dist.stddev})`;
      } else if (dist.type === 'choice') {
        return `Choice(${dist.values.length} values)`;
      }
    }
    return capacity?.toString() || '1';
  };

  // Create sections for ResourceDataTable
  const createResourceSections = () => {
    return Object.keys(resourceDefinitions).map(resourceName => {
      const definition = resourceDefinitions[resourceName];
      const data = definition.resourceTypes.map(resourceType => ({
        id: `${resourceName}-${resourceType}`,
        resourceName,
        resourceType,
        capacity: getCurrentCapacity(resourceName, resourceType)
      }));
      
      return {
        title: resourceName,
        data
      };
    });
  };

  // Detect resource renames (keeping existing logic)
  const detectResourceRenames = (oldDefs, newDefs) => {
    const renames = [];
    const oldNames = Object.keys(oldDefs);
    const newNames = Object.keys(newDefs);
    
    oldNames.forEach(oldName => {
      if (!newNames.includes(oldName)) {
        const possibleNewName = newNames.find(newName => 
          !oldNames.includes(newName) &&
          JSON.stringify(oldDefs[oldName]) === JSON.stringify(newDefs[newName])
        );
        
        if (possibleNewName) {
          renames.push({ oldName, newName: possibleNewName });
        }
      }
    });
    
    return renames;
  };

  // Detect resource type renames (keeping existing logic)
  const detectResourceTypeRenames = (oldDefs, newDefs) => {
    const renames = [];
    
    Object.keys(oldDefs).forEach(resourceName => {
      if (newDefs[resourceName]) {
        const oldTypes = oldDefs[resourceName].resourceTypes;
        const newTypes = newDefs[resourceName].resourceTypes;
        
        oldTypes.forEach(oldType => {
          if (!newTypes.includes(oldType)) {
            const possibleNewType = newTypes.find(newType => !oldTypes.includes(newType));
            if (possibleNewType) {
              renames.push({ resourceName, oldType, newType: possibleNewType });
            }
          }
        });
      }
    });
    
    return renames;
  };

  // Handle resource renames (keeping existing logic)
  const handleResourceRenames = (renames) => {
    if (!parsedData) return;

    let hasChanges = false;
    const updatedData = { ...parsedData };

    renames.forEach(({ oldName, newName }) => {
      if (updatedData.simulation?.resources) {
        const resourceIndex = updatedData.simulation.resources.findIndex(r => r.resource_table === oldName);
        if (resourceIndex >= 0) {
          updatedData.simulation.resources[resourceIndex].resource_table = newName;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      const newYamlContent = yaml.stringify(updatedData);
      if (onResourceChange) {
        onResourceChange(newYamlContent);
      }
    }
  };

  // Handle resource type renames (keeping existing logic) 
  const handleResourceTypeRenames = (renames) => {
    if (!parsedData) return;

    let hasChanges = false;
    const updatedData = { ...parsedData };

    renames.forEach(({ resourceName, oldType, newType }) => {
      if (updatedData.simulation?.resources) {
        const resource = updatedData.simulation.resources.find(r => r.resource_table === resourceName);
        if (resource?.capacities && resource.capacities[oldType]) {
          resource.capacities[newType] = resource.capacities[oldType];
          delete resource.capacities[oldType];
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      const newYamlContent = yaml.stringify(updatedData);
      if (onResourceChange) {
        onResourceChange(newYamlContent);
      }
    }
  };

  const resourceSections = createResourceSections();

  // Define columns for the table
  const columns = [
    { key: 'resourceType', title: 'Resource Type', className: 'resource-type-col' },
    { key: 'capacity', title: 'Capacity', className: 'capacity-col' },
    { key: 'actions', title: 'Actions', className: 'actions-col' }
  ];

  // Render cell content
  const renderCell = (item, column) => {
    switch (column.key) {
      case 'resourceType':
        return <code className="cell-content code-text">{item.resourceType}</code>;
      case 'capacity':
        return (
          <span className="cell-content mono-text">
            {formatCapacity(item.capacity)}
          </span>
        );
      case 'actions':
        return (
          <div className="cell-actions">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => handleEditCapacity(item.resourceName, item.resourceType)}
              title="Edit Capacity"
            >
              <FiEdit2 />
            </Button>
          </div>
        );
      default:
        return item[column.key];
    }
  };

  if (Object.keys(resourceDefinitions).length === 0) {
    return (
      <div className="text-center py-4">
        <span className="cell-content muted-text">No resources found in database configuration</span>
      </div>
    );
  }

  return (
    <>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <ResourceDataTable
          sections={resourceSections}
          defaultColumns={columns}
          defaultGridColumns="200px 150px 80px"
          renderCell={renderCell}
          className="data-grid-3-col"
        />
      </div>

      <CapacityEditModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        resourceName={editingResource}
        resourceType={editingResourceType}
        capacity={editingCapacity}
        onUpdate={handleCapacityUpdate}
        theme={theme}
      />
    </>
  );
};

// Simplified modal component for editing capacity
const CapacityEditModal = ({ show, onHide, resourceName, resourceType, capacity, onUpdate, theme }) => {
  const [capacityType, setCapacityType] = useState('fixed');
  const [fixedValue, setFixedValue] = useState(1);
  const [normalMean, setNormalMean] = useState(1);
  const [normalStddev, setNormalStddev] = useState(0.5);
  const [normalMin, setNormalMin] = useState(1);
  const [normalMax, setNormalMax] = useState(5);
  const [choiceValues, setChoiceValues] = useState([{ value: 1, weight: 1 }]);

  useEffect(() => {
    if (show && capacity !== null) {
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
            value: value,
            weight: weights[index] || 1
          }));
          setChoiceValues(pairs);
        }
      } else {
        setCapacityType('fixed');
        setFixedValue(1);
      }
    }
  }, [show, capacity]);

  const handleSave = () => {
    let newCapacity;
    
    if (capacityType === 'fixed') {
      newCapacity = fixedValue;
    } else if (capacityType === 'normal') {
      newCapacity = {
        distribution: {
          type: 'normal',
          mean: normalMean,
          stddev: normalStddev,
          min: normalMin,
          max: normalMax
        }
      };
    } else if (capacityType === 'choice') {
      newCapacity = {
        distribution: {
          type: 'choice',
          values: choiceValues.map(cv => cv.value),
          weights: choiceValues.map(cv => cv.weight)
        }
      };
    }
    
    onUpdate(newCapacity);
  };

  const addChoiceValue = () => {
    setChoiceValues([...choiceValues, { value: 1, weight: 1 }]);
  };

  const removeChoiceValue = (index) => {
    if (choiceValues.length > 1) {
      setChoiceValues(choiceValues.filter((_, i) => i !== index));
    }
  };

  const updateChoiceValue = (index, field, value) => {
    const updated = [...choiceValues];
    updated[index][field] = value;
    setChoiceValues(updated);
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>Edit Capacity</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <strong>{resourceName}</strong> → <code className="text-primary">{resourceType}</code>
        </div>
        
        <Form.Group className="mb-3">
          <Form.Label>Capacity Type</Form.Label>
          <Form.Select 
            value={capacityType} 
            onChange={(e) => setCapacityType(e.target.value)}
          >
            <option value="fixed">Fixed Value</option>
            <option value="normal">Normal Distribution</option>
            <option value="choice">Choice Distribution</option>
          </Form.Select>
        </Form.Group>

        {capacityType === 'fixed' && (
          <Form.Group className="mb-3">
            <Form.Label>Fixed Value</Form.Label>
            <Form.Control
              type="number"
              min="1"
              value={fixedValue}
              onChange={(e) => setFixedValue(parseInt(e.target.value) || 1)}
            />
          </Form.Group>
        )}

        {capacityType === 'normal' && (
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Mean (μ)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0"
                  value={normalMean}
                  onChange={(e) => setNormalMean(parseFloat(e.target.value) || 1)}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Std Dev (σ)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={normalStddev}
                  onChange={(e) => setNormalStddev(parseFloat(e.target.value) || 0.1)}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Min Value</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={normalMin}
                  onChange={(e) => setNormalMin(parseInt(e.target.value) || 1)}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Max Value</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={normalMax}
                  onChange={(e) => setNormalMax(parseInt(e.target.value) || 1)}
                />
              </Form.Group>
            </Col>
          </Row>
        )}

        {capacityType === 'choice' && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Choice Values</Form.Label>
              <Button size="sm" onClick={addChoiceValue}>Add Value</Button>
            </div>
            {choiceValues.map((choice, index) => (
              <Row key={index} className="mb-2">
                <Col md={5}>
                  <Form.Control
                    type="number"
                    placeholder="Value"
                    value={choice.value}
                    onChange={(e) => updateChoiceValue(index, 'value', parseInt(e.target.value) || 1)}
                  />
                </Col>
                <Col md={5}>
                  <Form.Control
                    type="number"
                    placeholder="Weight"
                    step="0.1"
                    min="0.1"
                    value={choice.weight}
                    onChange={(e) => updateChoiceValue(index, 'weight', parseFloat(e.target.value) || 1)}
                  />
                </Col>
                <Col md={2}>
                  <Button 
                    size="sm" 
                    variant="outline-danger"
                    onClick={() => removeChoiceValue(index)}
                    disabled={choiceValues.length === 1}
                  >
                    ×
                  </Button>
                </Col>
              </Row>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ResourceEditor;