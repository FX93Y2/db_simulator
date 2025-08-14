import React from 'react';
import { Form, Button, Row, Col, InputGroup } from 'react-bootstrap';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

const ChoiceValueManager = ({ 
  values = [], 
  weights = [], 
  onValueChange, 
  onAddValue, 
  onRemoveValue,
  showWeights = true 
}) => {
  const handleChoiceValueChange = (index, field, value) => {
    if (field === 'value') {
      const newValues = [...values];
      newValues[index] = value;
      onValueChange('values', newValues);
    } else if (field === 'weight') {
      const newWeights = [...weights];
      newWeights[index] = parseFloat(value) || 0;
      onValueChange('weights', newWeights);
    }
  };

  const addChoiceValue = () => {
    const newValues = [...values, showWeights ? 'NewOption' : 0.1];
    const newWeights = showWeights ? [...weights, 0.1] : null;
    
    onAddValue(newValues, newWeights);
  };

  const removeChoiceValue = (index) => {
    const newValues = values.filter((_, i) => i !== index);
    const newWeights = showWeights ? weights.filter((_, i) => i !== index) : null;
    
    onRemoveValue(newValues, newWeights);
  };

  return (
    <Form.Group className="mb-3">
      <Form.Label>{showWeights ? 'Values and Weights' : 'Choice Values (Probabilities)'}</Form.Label>
      <div className="choice-values-editor">
        {values.map((value, index) => (
          <Row key={index} className="mb-2 align-items-center">
            <Col md={showWeights ? 6 : 8}>
              <Form.Control
                type={showWeights ? "text" : "number"}
                step={showWeights ? undefined : "0.1"}
                min={showWeights ? undefined : "0"}
                max={showWeights ? undefined : "1"}
                value={value}
                onChange={(e) => handleChoiceValueChange(index, 'value', e.target.value)}
              />
            </Col>
            {showWeights && (
              <Col md={4}>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={weights[index] || 0}
                  onChange={(e) => handleChoiceValueChange(index, 'weight', e.target.value)}
                />
              </Col>
            )}
            <Col md={showWeights ? 2 : 4}>
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
  );
};

export default ChoiceValueManager;