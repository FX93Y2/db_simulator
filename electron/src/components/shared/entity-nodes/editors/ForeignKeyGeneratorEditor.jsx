import React from 'react';
import { Form, Button, Card } from 'react-bootstrap';
import ChoiceValueManager from './ChoiceValueManager';
import DistributionParameterEditor from './DistributionParameterEditor';

const ForeignKeyGeneratorEditor = ({ 
  generator, 
  onGeneratorChange, 
  onDistributionChange, 
  onChoiceValueChange, 
  onAddChoiceValue, 
  onRemoveChoiceValue 
}) => {
  const distribution = generator.distribution || {};

  const toggleDistribution = () => {
    if (generator.distribution) {
      const updatedGenerator = { ...generator };
      delete updatedGenerator.distribution;
      onGeneratorChange('distribution', undefined);
    } else {
      onGeneratorChange('distribution', {
        type: 'choice',
        values: [0.2, 0.3, 0.5]
      });
    }
  };

  return (
    <div>
      <Form.Group className="mb-3">
        <Form.Label>Foreign Key Subtype</Form.Label>
        <Form.Select
          value={generator.subtype || 'one_to_many'}
          onChange={(e) => onGeneratorChange('subtype', e.target.value)}
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
                value={distribution.type || 'choice'}
                onChange={(e) => onDistributionChange('type', e.target.value)}
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
            
            {distribution.type === 'choice' && distribution.values && (
              <ChoiceValueManager
                values={distribution.values}
                weights={null}
                onValueChange={(field, values) => {
                  onDistributionChange('values', values);
                }}
                onAddValue={(newValues) => {
                  onDistributionChange('values', newValues);
                }}
                onRemoveValue={(newValues) => {
                  onDistributionChange('values', newValues);
                }}
                showWeights={false}
              />
            )}
            
            {distribution.type !== 'choice' && (
              <DistributionParameterEditor
                distributionType={distribution.type}
                distribution={distribution}
                onDistributionChange={onDistributionChange}
              />
            )}
          </Card.Body>
        </Card>
      )}
      
      <Button
        variant="outline-secondary"
        size="sm"
        className="mt-2"
        onClick={toggleDistribution}
      >
        {generator.distribution ? 'Remove Distribution' : 'Add Distribution'}
      </Button>
    </div>
  );
};

export default ForeignKeyGeneratorEditor;