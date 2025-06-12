import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Row, Col, Badge, ListGroup } from 'react-bootstrap';
import { FiPlus, FiEdit2, FiTrash2, FiSettings } from 'react-icons/fi';
import yaml from 'yaml';

const ResourceEditor = ({ yamlContent, onResourceChange, theme }) => {
  const [parsedData, setParsedData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedResourceType, setSelectedResourceType] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(null);

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

  const resourceCapacities = parsedData?.event_simulation?.resource_capacities || {};

  const handleEditCapacity = (category, resourceType, capacity) => {
    setSelectedCategory(category);
    setSelectedResourceType(resourceType);
    setEditingCapacity(capacity);
    setShowEditModal(true);
  };

  const handleSaveCapacity = (newCapacity) => {
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

    // Convert back to YAML and update
    const updatedYaml = yaml.stringify(updatedData);
    onResourceChange(updatedData);
    
    setShowEditModal(false);
    setSelectedCategory(null);
    setSelectedResourceType(null);
    setEditingCapacity(null);
  };

  const handleAddResourceType = (category) => {
    setSelectedCategory(category);
    setSelectedResourceType('New Resource Type');
    setEditingCapacity(1); // Default fixed capacity
    setShowEditModal(true);
  };

  const handleDeleteResourceType = (category, resourceType) => {
    if (!parsedData) return;

    const updatedData = JSON.parse(JSON.stringify(parsedData));
    const capacityRules = updatedData.event_simulation?.resource_capacities?.[category]?.capacity_rules;
    
    if (capacityRules) {
      const filteredRules = capacityRules.filter(rule => rule.resource_type !== resourceType);
      updatedData.event_simulation.resource_capacities[category].capacity_rules = filteredRules;
      
      const updatedYaml = yaml.stringify(updatedData);
      onResourceChange(updatedData);
    }
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

  const renderResourceCategories = () => {
    const categories = Object.keys(resourceCapacities);
    
    if (categories.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-muted">No resource capacities configured</p>
          <Button variant="outline-primary" size="sm">
            <FiPlus className="me-2" />
            Add Resource Category
          </Button>
        </div>
      );
    }

    return categories.map(category => (
      <Card key={category} className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0">
            <FiSettings className="me-2" />
            {category}
          </h6>
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => handleAddResourceType(category)}
          >
            <FiPlus className="me-1" />
            Add Resource Type
          </Button>
        </Card.Header>
        <Card.Body>
          {renderResourceTypes(category)}
        </Card.Body>
      </Card>
    ));
  };

  const renderResourceTypes = (category) => {
    const capacityRules = resourceCapacities[category]?.capacity_rules || [];
    
    if (capacityRules.length === 0) {
      return (
        <p className="text-muted mb-0">No resource types configured</p>
      );
    }

    return (
      <ListGroup variant="flush">
        {capacityRules.map((rule, index) => (
          <ListGroup.Item 
            key={index}
            className="d-flex justify-content-between align-items-center px-0"
          >
            <div>
              <strong>{rule.resource_type}</strong>
              <div className="mt-1">
                {renderCapacityBadge(rule.capacity)}
              </div>
            </div>
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="me-2"
                onClick={() => handleEditCapacity(category, rule.resource_type, rule.capacity)}
              >
                <FiEdit2 />
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => handleDeleteResourceType(category, rule.resource_type)}
              >
                <FiTrash2 />
              </Button>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    );
  };

  return (
    <div className="resource-editor">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Resource Capacities</h5>
      </div>
      
      {renderResourceCategories()}

      <CapacityEditModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        resourceType={selectedResourceType}
        capacity={editingCapacity}
        onSave={handleSaveCapacity}
      />
    </div>
  );
};

// Modal component for editing capacity
const CapacityEditModal = ({ show, onHide, resourceType, capacity, onSave }) => {
  const [editedResourceType, setEditedResourceType] = useState('');
  const [capacityType, setCapacityType] = useState('fixed');
  const [fixedValue, setFixedValue] = useState(1);
  const [normalMean, setNormalMean] = useState(1);
  const [normalStddev, setNormalStddev] = useState(0.5);
  const [normalMin, setNormalMin] = useState(1);
  const [normalMax, setNormalMax] = useState(5);
  const [choiceValues, setChoiceValues] = useState([{ value: 1, weight: 1 }]);

  useEffect(() => {
    if (show && resourceType && capacity !== null) {
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
  }, [show, resourceType, capacity]);

  const handleSave = () => {
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
    
    onSave({
      resource_type: editedResourceType,
      capacity: capacityValue
    });
  };

  const addChoicePair = () => {
    setChoiceValues([...choiceValues, { value: 1, weight: 1 }]);
  };

  const removeChoicePair = (index) => {
    if (choiceValues.length > 1) {
      setChoiceValues(choiceValues.filter((_, i) => i !== index));
    }
  };

  const updateChoicePair = (index, field, value) => {
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
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Capacity Type</Form.Label>
            <Form.Select
              value={capacityType}
              onChange={(e) => setCapacityType(e.target.value)}
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
                onChange={(e) => setFixedValue(parseInt(e.target.value) || 1)}
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
                    onChange={(e) => setNormalMean(parseFloat(e.target.value) || 0)}
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
                    onChange={(e) => setNormalStddev(parseFloat(e.target.value) || 0)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Minimum</Form.Label>
                  <Form.Control
                    type="number"
                    value={normalMin}
                    onChange={(e) => setNormalMin(parseInt(e.target.value) || 0)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Maximum</Form.Label>
                  <Form.Control
                    type="number"
                    value={normalMax}
                    onChange={(e) => setNormalMax(parseInt(e.target.value) || 0)}
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