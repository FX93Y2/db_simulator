import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, InputGroup } from 'react-bootstrap';
import { FiPlus, FiTrash2, FiSettings } from 'react-icons/fi';

const AttributeEditor = ({ attribute, onAttributeChange, onAttributeDelete, availableEntities = [] }) => {
  const [localAttribute, setLocalAttribute] = useState({
    name: '',
    type: 'string',
    generator: {
      type: 'faker',
      method: 'name'
    },
    ...attribute
  });

  // Helper function to check if a type should have a generator
  const shouldHaveGenerator = (type) => {
    const typesWithoutGenerators = ['pk', 'event_id', 'entity_id', 'resource_id', 'event_type'];
    return !typesWithoutGenerators.includes(type);
  };

  // Update local state when attribute prop changes
  useEffect(() => {
    setLocalAttribute({
      name: '',
      type: 'string',
      generator: {
        type: 'faker',
        method: 'name'
      },
      ...attribute
    });
  }, [attribute]);

  // Handle changes and propagate to parent
  const handleChange = (field, value) => {
    const updatedAttribute = { ...localAttribute, [field]: value };
    
    // Handle generator configuration based on data type
    if (field === 'type') {
      if (!shouldHaveGenerator(value)) {
        // Remove generator for types that shouldn't have one
        delete updatedAttribute.generator;
      } else if (value === 'fk') {
        // Foreign keys need foreign_key generator
        updatedAttribute.generator = {
          type: 'foreign_key',
          subtype: 'one_to_many'
        };
      } else if (value === 'resource_type') {
        // Resource types need distribution generator
        updatedAttribute.generator = {
          type: 'distribution',
          distribution: {
            type: 'choice',
            values: ['Option1', 'Option2'],
            weights: [0.5, 0.5]
          }
        };
      } else {
        // Other data types get faker generator by default
        updatedAttribute.generator = {
          type: 'faker',
          method: 'name'
        };
      }
    }
    
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };

  // Handle generator changes
  const handleGeneratorChange = (field, value) => {
    const updatedGenerator = { ...localAttribute.generator, [field]: value };
    
    // Reset generator fields when type changes
    if (field === 'type') {
      switch (value) {
        case 'faker':
          updatedGenerator.method = 'name';
          delete updatedGenerator.template;
          delete updatedGenerator.distribution;
          delete updatedGenerator.subtype;
          break;
        case 'template':
          updatedGenerator.template = 'Template_{id}';
          delete updatedGenerator.method;
          delete updatedGenerator.distribution;
          delete updatedGenerator.subtype;
          break;
        case 'distribution':
          updatedGenerator.distribution = {
            type: 'choice',
            values: ['Option1', 'Option2'],
            weights: [0.5, 0.5]
          };
          delete updatedGenerator.method;
          delete updatedGenerator.template;
          delete updatedGenerator.subtype;
          break;
        case 'foreign_key':
          updatedGenerator.subtype = 'one_to_many';
          delete updatedGenerator.method;
          delete updatedGenerator.template;
          break;
        default:
          break;
      }
    }
    
    const updatedAttribute = { ...localAttribute, generator: updatedGenerator };
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };

  // Handle distribution changes
  const handleDistributionChange = (field, value) => {
    const updatedDistribution = { ...localAttribute.generator.distribution, [field]: value };
    const updatedGenerator = { ...localAttribute.generator, distribution: updatedDistribution };
    const updatedAttribute = { ...localAttribute, generator: updatedGenerator };
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };

  // Handle choice distribution value/weight pairs
  const handleChoiceValueChange = (index, field, value) => {
    const distribution = localAttribute.generator.distribution;
    const newValues = [...(distribution.values || [])];
    const newWeights = [...(distribution.weights || [])];
    
    if (field === 'value') {
      newValues[index] = value;
    } else if (field === 'weight') {
      newWeights[index] = parseFloat(value) || 0;
    }
    
    // Update both values and weights in a single operation
    const updatedDistribution = {
      ...distribution,
      values: newValues,
      weights: newWeights
    };
    const updatedGenerator = { ...localAttribute.generator, distribution: updatedDistribution };
    const updatedAttribute = { ...localAttribute, generator: updatedGenerator };
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };

  // Add new choice value/weight pair
  const addChoiceValue = () => {
    const distribution = localAttribute.generator.distribution;
    const newValues = [...(distribution.values || []), 'NewOption'];
    const newWeights = [...(distribution.weights || []), 0.1];
    
    // Update both values and weights in a single operation
    const updatedDistribution = {
      ...distribution,
      values: newValues,
      weights: newWeights
    };
    const updatedGenerator = { ...localAttribute.generator, distribution: updatedDistribution };
    const updatedAttribute = { ...localAttribute, generator: updatedGenerator };
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };

  // Remove choice value/weight pair
  const removeChoiceValue = (index) => {
    const distribution = localAttribute.generator.distribution;
    const newValues = (distribution.values || []).filter((_, i) => i !== index);
    const newWeights = (distribution.weights || []).filter((_, i) => i !== index);
    
    // Update both values and weights in a single operation
    const updatedDistribution = {
      ...distribution,
      values: newValues,
      weights: newWeights
    };
    const updatedGenerator = { ...localAttribute.generator, distribution: updatedDistribution };
    const updatedAttribute = { ...localAttribute, generator: updatedGenerator };
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };

  // Render generator-specific fields
  const renderGeneratorFields = () => {
    const generator = localAttribute.generator || {};
    
    switch (generator.type) {
      case 'faker':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Faker Method</Form.Label>
            <Form.Control
              type="text"
              value={generator.method || ''}
              onChange={(e) => handleGeneratorChange('method', e.target.value)}
              placeholder="e.g., name, email, address"
            />
            <Form.Text className="text-muted">
              Faker.js method name (e.g., name, email, phone, address)
            </Form.Text>
          </Form.Group>
        );
        
      case 'template':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Template String</Form.Label>
            <Form.Control
              type="text"
              value={generator.template || ''}
              onChange={(e) => handleGeneratorChange('template', e.target.value)}
              placeholder="e.g., Department_{id}"
            />
            <Form.Text className="text-muted">
              Template string with {'{id}'} placeholder for auto-increment
            </Form.Text>
          </Form.Group>
        );
        
      case 'distribution':
        return (
          <div>
            <Form.Group className="mb-3">
              <Form.Label>Distribution Type</Form.Label>
              <Form.Select
                value={generator.distribution?.type || 'choice'}
                onChange={(e) => handleDistributionChange('type', e.target.value)}
              >
                <option value="choice">Choice</option>
                <option value="uniform">Uniform</option>
                <option value="normal">Normal</option>
                <option value="exponential">Exponential</option>
                <option value="poisson">Poisson</option>
                <option value="binomial">Binomial</option>
                <option value="gamma">Gamma</option>
              </Form.Select>
            </Form.Group>
            
            {generator.distribution?.type === 'choice' && (
              <Form.Group className="mb-3">
                <Form.Label>Values and Weights</Form.Label>
                <div className="choice-values-editor">
                  {(generator.distribution.values || []).map((value, index) => (
                    <Row key={index} className="mb-2 align-items-center">
                      <Col md={6}>
                        <Form.Control
                          type="text"
                          value={value}
                          onChange={(e) => handleChoiceValueChange(index, 'value', e.target.value)}
                          placeholder="Value"
                        />
                      </Col>
                      <Col md={4}>
                        <InputGroup>
                          <Form.Control
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={generator.distribution.weights?.[index] || 0}
                            onChange={(e) => handleChoiceValueChange(index, 'weight', e.target.value)}
                            placeholder="Weight"
                          />
                          <InputGroup.Text>%</InputGroup.Text>
                        </InputGroup>
                      </Col>
                      <Col md={2}>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeChoiceValue(index)}
                        >
                          <FiTrash2 />
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={addChoiceValue}
                  >
                    <FiPlus className="me-1" /> Add Value
                  </Button>
                </div>
              </Form.Group>
            )}
            
            {generator.distribution?.type === 'normal' && (
              <>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Mean</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        value={generator.distribution.mean || 0}
                        onChange={(e) => handleDistributionChange('mean', parseFloat(e.target.value))}
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
                        value={generator.distribution.stddev || 1}
                        onChange={(e) => handleDistributionChange('stddev', parseFloat(e.target.value))}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </>
            )}
            
            {generator.distribution?.type === 'uniform' && (
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Minimum</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      value={generator.distribution.min || 0}
                      onChange={(e) => handleDistributionChange('min', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Maximum</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      value={generator.distribution.max || 1}
                      onChange={(e) => handleDistributionChange('max', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>
            )}
            
            {generator.distribution?.type === 'exponential' && (
              <Form.Group className="mb-3">
                <Form.Label>Scale</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={generator.distribution.scale || 1}
                  onChange={(e) => handleDistributionChange('scale', parseFloat(e.target.value))}
                />
              </Form.Group>
            )}
            
            {generator.distribution?.type === 'poisson' && (
              <Form.Group className="mb-3">
                <Form.Label>Lambda (Rate)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={generator.distribution.lambda || 1}
                  onChange={(e) => handleDistributionChange('lambda', parseFloat(e.target.value))}
                />
                <Form.Text className="text-muted">
                  Average number of events per interval
                </Form.Text>
              </Form.Group>
            )}
            
            {generator.distribution?.type === 'binomial' && (
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Trials (n)</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      value={generator.distribution.n || 10}
                      onChange={(e) => handleDistributionChange('n', parseInt(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Probability (p)</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={generator.distribution.p || 0.5}
                      onChange={(e) => handleDistributionChange('p', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>
            )}
            
            {generator.distribution?.type === 'gamma' && (
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Shape (alpha)</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={generator.distribution.alpha || 1}
                      onChange={(e) => handleDistributionChange('alpha', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Scale (beta)</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={generator.distribution.beta || 1}
                      onChange={(e) => handleDistributionChange('beta', parseFloat(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>
            )}
          </div>
        );
        
      case 'foreign_key':
        return (
          <div>
            <Form.Group className="mb-3">
              <Form.Label>Foreign Key Subtype</Form.Label>
              <Form.Select
                value={generator.subtype || 'one_to_many'}
                onChange={(e) => handleGeneratorChange('subtype', e.target.value)}
              >
                <option value="one_to_many">One to Many</option>
                <option value="many_to_one">Many to One</option>
                <option value="one_to_one">One to One</option>
              </Form.Select>
            </Form.Group>
            
            {generator.distribution && (
              <Card className="distribution-optional-card">
                <Card.Header>
                  <small className="text-muted">Distribution (Optional)</small>
                </Card.Header>
                <Card.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>Distribution Type</Form.Label>
                    <Form.Select
                      value={generator.distribution.type || 'choice'}
                      onChange={(e) => handleDistributionChange('type', e.target.value)}
                    >
                      <option value="choice">Choice</option>
                      <option value="uniform">Uniform</option>
                      <option value="normal">Normal</option>
                      <option value="exponential">Exponential</option>
                      <option value="poisson">Poisson</option>
                      <option value="binomial">Binomial</option>
                      <option value="gamma">Gamma</option>
                    </Form.Select>
                  </Form.Group>
                  
                  {generator.distribution.type === 'choice' && generator.distribution.values && (
                    <Form.Group className="mb-3">
                      <Form.Label>Choice Values (Probabilities)</Form.Label>
                      <div className="choice-values-editor">
                        {generator.distribution.values.map((value, index) => (
                          <Row key={index} className="mb-2 align-items-center">
                            <Col md={8}>
                              <Form.Control
                                type="number"
                                step="0.1"
                                min="0"
                                max="1"
                                value={value}
                                onChange={(e) => {
                                  const newValues = [...generator.distribution.values];
                                  newValues[index] = parseFloat(e.target.value) || 0;
                                  handleDistributionChange('values', newValues);
                                }}
                                placeholder="Probability"
                              />
                            </Col>
                            <Col md={4}>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => {
                                  const newValues = generator.distribution.values.filter((_, i) => i !== index);
                                  handleDistributionChange('values', newValues);
                                }}
                              >
                                <FiTrash2 />
                              </Button>
                            </Col>
                          </Row>
                        ))}
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            const newValues = [...(generator.distribution.values || []), 0.1];
                            handleDistributionChange('values', newValues);
                          }}
                        >
                          <FiPlus className="me-1" /> Add Value
                        </Button>
                      </div>
                    </Form.Group>
                  )}
                  
                  {generator.distribution.type === 'uniform' && (
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Minimum</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            value={generator.distribution.min || 0}
                            onChange={(e) => handleDistributionChange('min', parseFloat(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Maximum</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            value={generator.distribution.max || 1}
                            onChange={(e) => handleDistributionChange('max', parseFloat(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  )}
                  
                  {generator.distribution.type === 'normal' && (
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Mean</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            value={generator.distribution.mean || 0}
                            onChange={(e) => handleDistributionChange('mean', parseFloat(e.target.value))}
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
                            value={generator.distribution.stddev || 1}
                            onChange={(e) => handleDistributionChange('stddev', parseFloat(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  )}
                  
                  {generator.distribution.type === 'exponential' && (
                    <Form.Group className="mb-3">
                      <Form.Label>Scale</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={generator.distribution.scale || 1}
                        onChange={(e) => handleDistributionChange('scale', parseFloat(e.target.value))}
                      />
                    </Form.Group>
                  )}
                  
                  {generator.distribution.type === 'poisson' && (
                    <Form.Group className="mb-3">
                      <Form.Label>Lambda (Rate)</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={generator.distribution.lambda || 1}
                        onChange={(e) => handleDistributionChange('lambda', parseFloat(e.target.value))}
                      />
                      <Form.Text className="text-muted">
                        Average number of events per interval
                      </Form.Text>
                    </Form.Group>
                  )}
                  
                  {generator.distribution.type === 'binomial' && (
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Trials (n)</Form.Label>
                          <Form.Control
                            type="number"
                            min="1"
                            value={generator.distribution.n || 10}
                            onChange={(e) => handleDistributionChange('n', parseInt(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Probability (p)</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={generator.distribution.p || 0.5}
                            onChange={(e) => handleDistributionChange('p', parseFloat(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  )}
                  
                  {generator.distribution.type === 'gamma' && (
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Shape (alpha)</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={generator.distribution.alpha || 1}
                            onChange={(e) => handleDistributionChange('alpha', parseFloat(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Scale (beta)</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={generator.distribution.beta || 1}
                            onChange={(e) => handleDistributionChange('beta', parseFloat(e.target.value))}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  )}
                </Card.Body>
              </Card>
            )}
            
            <Button
              variant="outline-secondary"
              size="sm"
              className="mt-2"
              onClick={() => {
                if (generator.distribution) {
                  const updatedGenerator = { ...generator };
                  delete updatedGenerator.distribution;
                  handleGeneratorChange('distribution', undefined);
                } else {
                  handleGeneratorChange('distribution', {
                    type: 'choice',
                    values: [0.2, 0.3, 0.5]
                  });
                }
              }}
            >
              {generator.distribution ? 'Remove Distribution' : 'Add Distribution'}
            </Button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className="mb-3 attribute-editor-card">
      <Card.Header className="attribute-header">
        <span className="attribute-name">
          {localAttribute.name || 'New Attribute'}
        </span>
        <Button
          variant="outline-danger"
          size="sm"
          onClick={onAttributeDelete}
        >
          <FiTrash2 />
        </Button>
      </Card.Header>
      <Card.Body>
        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Attribute Name</Form.Label>
              <Form.Control
                type="text"
                value={localAttribute.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter attribute name"
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Data Type</Form.Label>
              <Form.Select
                value={localAttribute.type}
                onChange={(e) => handleChange('type', e.target.value)}
              >
                <option value="string">String</option>
                <option value="integer">Integer</option>
                <option value="float">Float</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
                <option value="datetime">DateTime</option>
                <option value="pk">Primary Key</option>
                <option value="fk">Foreign Key</option>
                <option value="event_id">Event ID (FK)</option>
                <option value="entity_id">Entity ID (FK)</option>
                <option value="resource_id">Resource ID (FK)</option>
                <option value="event_type">Event Type</option>
                <option value="resource_type">Resource Type</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        
        {/* Generator Configuration */}
        {shouldHaveGenerator(localAttribute.type) && (
          <div className="generator-section">
            <h6 className="section-title">Data Generator Configuration</h6>
            
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Generator Type</Form.Label>
                  <Form.Select
                    value={localAttribute.generator?.type || 'faker'}
                    onChange={(e) => handleGeneratorChange('type', e.target.value)}
                    disabled={localAttribute.type === 'fk' || localAttribute.type === 'resource_type'}
                  >
                    <option value="faker">Faker</option>
                    <option value="template">Template</option>
                    <option value="distribution">Distribution</option>
                    <option value="foreign_key">Foreign Key</option>
                  </Form.Select>
                  {(localAttribute.type === 'fk' || localAttribute.type === 'resource_type') && (
                    <Form.Text className="text-muted">
                      Generator type is automatically set for this data type.
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <div className="generator-fields">
                  {renderGeneratorFields()}
                </div>
              </Col>
            </Row>
          </div>
        )}
        
        {/* Reference field for foreign keys */}
        {(localAttribute.type === 'fk' || localAttribute.type === 'event_id' ||
          localAttribute.type === 'entity_id' || localAttribute.type === 'resource_id') && (
          <div className="reference-section">
            <h6 className="section-title">Reference Configuration</h6>
            <Form.Group>
              <Form.Label>Reference</Form.Label>
              <Form.Control
                type="text"
                value={localAttribute.ref || ''}
                onChange={(e) => handleChange('ref', e.target.value)}
                placeholder="e.g., Department.id"
              />
              <Form.Text className="text-muted">
                Reference to another entity's attribute (EntityName.attributeName)
              </Form.Text>
            </Form.Group>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default AttributeEditor;