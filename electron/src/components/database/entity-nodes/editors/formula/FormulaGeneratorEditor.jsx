import React, { useState, useEffect } from 'react';
import FormulaExpressionInput from './FormulaExpressionInput';

const FormulaGeneratorEditor = ({ generator, onExpressionChange }) => {
  // Use local state to make input properly controlled
  const [expression, setExpression] = useState('');
  
  // Initialize expression from generator when component mounts or generator changes
  useEffect(() => {
    const initialExpression = generator.expression || '';
    setExpression(initialExpression);
  }, [generator.expression]);

  const handleExpressionChange = (newExpression) => {
    setExpression(newExpression);
    onExpressionChange(newExpression);
  };

  return (
    <FormulaExpressionInput
      value={expression}
      onChange={handleExpressionChange}
      label="Formula Expression"
      placeholder="e.g., MIN(SELECT created_at FROM Tickets WHERE user_id = @id) - DAYS(RANDOM(30, 365))"
    />
  );
};

export default FormulaGeneratorEditor;