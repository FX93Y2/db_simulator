import React, { useState, useEffect } from 'react';
import { DistributionFormulaInput, convertDistributionToFormula, getDefaultFormula } from '../../../shared/distribution';

const DistributionGeneratorEditor = ({ generator, onFormulaChange }) => {
  // Use local state to make input properly controlled
  const [formula, setFormula] = useState('');
  
  // Initialize formula from generator when component mounts or generator changes
  useEffect(() => {
    const initialFormula = generator.formula || convertDistributionToFormula(generator.distribution) || '';
    setFormula(initialFormula);
  }, [generator.formula, generator.distribution]);

  const handleFormulaChange = (newFormula) => {
    setFormula(newFormula);
    onFormulaChange(newFormula);
  };

  return (
    <DistributionFormulaInput
      value={formula}
      onChange={handleFormulaChange}
      label="Distribution Formula"
      placeholder="e.g., DISC(0.7, 'high', 0.3, 'low') or UNIF(1, 10)"
    />
  );
};

export default DistributionGeneratorEditor;