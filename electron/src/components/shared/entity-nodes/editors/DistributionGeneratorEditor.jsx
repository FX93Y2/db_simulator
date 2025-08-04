import React from 'react';
import { Form } from 'react-bootstrap';
import ChoiceValueManager from './ChoiceValueManager';
import DistributionParameterEditor from './DistributionParameterEditor';

const DistributionGeneratorEditor = ({ generator, onDistributionChange, onChoiceValueChange, onAddChoiceValue, onRemoveChoiceValue }) => {
  const distribution = generator.distribution || {};

  return (
    <div>
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
      
      {distribution.type === 'choice' && (
        <ChoiceValueManager
          values={distribution.values || []}
          weights={distribution.weights || []}
          onValueChange={onChoiceValueChange}
          onAddValue={onAddChoiceValue}
          onRemoveValue={onRemoveChoiceValue}
          showWeights={true}
        />
      )}
      
      {distribution.type !== 'choice' && (
        <DistributionParameterEditor
          distributionType={distribution.type}
          distribution={distribution}
          onDistributionChange={onDistributionChange}
        />
      )}
    </div>
  );
};

export default DistributionGeneratorEditor;