import React from 'react';
import { Form, Button, Card } from 'react-bootstrap';
import { DistributionFormulaInput, convertDistributionToFormula } from '../../../shared/distribution';

const ForeignKeyGeneratorEditor = ({
  generator,
  onGeneratorChange
}) => {
  // Convert old distribution format to formula if needed
  const getCurrentFormula = () => {
    if (generator.formula) {
      return generator.formula;
    }
    return convertDistributionToFormula(generator.distribution) || '';
  };

  const handleFormulaChange = (newFormula) => {
    onGeneratorChange('formula', newFormula);
  };

  const toggleDistribution = () => {
    if (generator.distribution || generator.formula) {
      // Remove distribution/formula
      if (generator.distribution) {
        onGeneratorChange('distribution', undefined);
      }
      if (generator.formula) {
        onGeneratorChange('formula', undefined);
      }
    } else {
      // Add formula field
      onGeneratorChange('formula', 'DISC(0.5, "value1", 0.5, "value2")');
    }
  };

  return (
    <div>
      <Form.Group className="mb-3">
        <Form.Label>Foreign Key Subtype</Form.Label>
        <Form.Select
          value={(generator.subtype === 'one_to_many' ? 'many_to_one' : generator.subtype) || 'many_to_one'}
          onChange={(e) => onGeneratorChange('subtype', e.target.value)}
        >
          <option value="many_to_one">Many to One</option>
          <option value="one_to_one">One to One</option>
        </Form.Select>
      </Form.Group>

      {(generator.distribution || generator.formula !== undefined) && (
        <Card className="distribution-optional-card">
          <Card.Header>
            <small className="text-muted">Distribution (Optional)</small>
          </Card.Header>
          <Card.Body>
            <DistributionFormulaInput
              value={getCurrentFormula()}
              onChange={handleFormulaChange}
              label="Foreign Key Distribution"
              placeholder="e.g., DISC(0.7, 'high', 0.3, 'low') or UNIF(1, 10)"
            />
          </Card.Body>
        </Card>
      )}

      <Button
        variant="outline-secondary"
        size="sm"
        className="mt-2"
        onClick={toggleDistribution}
      >
        {(generator.distribution || generator.formula) ? 'Remove Distribution' : 'Add Distribution'}
      </Button>
    </div>
  );
};

export default ForeignKeyGeneratorEditor;