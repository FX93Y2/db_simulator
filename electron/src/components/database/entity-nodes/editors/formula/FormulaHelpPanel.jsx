import React from 'react';
import ReactDOM from 'react-dom';
import { Card, Badge, Button } from 'react-bootstrap';
import { FiX } from 'react-icons/fi';

const FormulaHelpPanel = ({ show, onHide }) => {
  const formulaCategories = {
    queries: [
      {
        name: 'MIN',
        syntax: 'MIN(SELECT column FROM table WHERE condition)',
        description: 'Get minimum value from query',
        example: 'MIN(SELECT created_at FROM Tickets WHERE user_id = @id)'
      },
      {
        name: 'MAX',
        syntax: 'MAX(SELECT column FROM table WHERE condition)',
        description: 'Get maximum value from query',
        example: 'MAX(SELECT updated_at FROM Orders WHERE customer_id = @id)'
      },
      {
        name: 'AVG',
        syntax: 'AVG(SELECT column FROM table WHERE condition)',
        description: 'Calculate average value',
        example: 'AVG(SELECT price FROM Products WHERE category_id = @id)'
      },
      {
        name: 'COUNT',
        syntax: 'COUNT(SELECT * FROM table WHERE condition)',
        description: 'Count matching records',
        example: 'COUNT(SELECT * FROM Reviews WHERE product_id = @id)'
      },
      {
        name: 'SUM',
        syntax: 'SUM(SELECT column FROM table WHERE condition)',
        description: 'Sum values from query',
        example: 'SUM(SELECT amount FROM Payments WHERE user_id = @id)'
      }
    ],
    dates: [
      {
        name: 'DAYS',
        syntax: 'expression ± DAYS(n)',
        description: 'Add or subtract days from date',
        example: 'created_at - DAYS(30)'
      },
      {
        name: 'HOURS',
        syntax: 'expression ± HOURS(n)',
        description: 'Add or subtract hours',
        example: 'timestamp + HOURS(2)'
      },
      {
        name: 'MINUTES',
        syntax: 'expression ± MINUTES(n)',
        description: 'Add or subtract minutes',
        example: 'start_time - MINUTES(15)'
      }
    ],
    variables: [
      {
        name: 'RANDOM',
        syntax: 'RANDOM(min, max)',
        description: 'Random integer between min and max',
        example: 'DAYS(RANDOM(30, 365))'
      },
      {
        name: '@variable',
        syntax: '@column_name',
        description: 'Reference any column from current row',
        example: '@id, @user_id, @category_name'
      }
    ],
    patterns: [
      {
        name: 'Temporal Consistency',
        syntax: 'MIN(...) - DAYS(RANDOM(...))',
        description: 'User registered before first activity',
        example: 'MIN(SELECT created_at FROM Activities WHERE user_id = @id) - DAYS(RANDOM(30, 365))'
      },
      {
        name: 'Aggregated Metrics',
        syntax: 'SUM/COUNT/AVG(...)',
        description: 'Calculate summary statistics',
        example: 'SUM(SELECT amount FROM Purchases WHERE customer_id = @id)'
      },
      {
        name: 'Business Logic',
        syntax: 'expression * multiplier',
        description: 'Apply calculations and markups',
        example: 'AVG(SELECT price FROM Products WHERE category_id = @id) * 1.2'
      },
      {
        name: 'Conditional Count',
        syntax: 'COUNT(...WHERE condition)',
        description: 'Count records meeting criteria',
        example: 'COUNT(SELECT * FROM Tickets WHERE user_id = @id AND priority = \'high\')'
      }
    ]
  };

  const renderFormulaCard = (category, formulas) => (
    <Card 
      className="mb-2" 
      style={{ 
        fontSize: '14px',
        backgroundColor: 'var(--theme-card-bg)',
        borderColor: 'var(--theme-border-color)',
        color: 'var(--theme-text-primary)'
      }}
    >
      <Card.Header 
        className="py-1" 
        style={{ 
          padding: '8px 12px',
          backgroundColor: 'var(--theme-card-bg)',
          borderBottomColor: 'var(--theme-border-color)',
          color: 'var(--theme-text-primary)'
        }}
      >
        <span className="fw-semibold" style={{ fontSize: '12px' }}>
          {getCategoryDisplayName(category)}
        </span>
      </Card.Header>
      <Card.Body className="py-1" style={{ padding: '8px 12px' }}>
        {formulas.map((formula, index) => (
          <div key={index} className="formula-item mb-2">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <code className="text-primary fw-bold" style={{ fontSize: '12px' }}>
                  {formula.syntax}
                </code>
                <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  {formula.description}
                </div>
              </div>
            </div>
            <code className="text-success d-block mt-1" style={{ 
              fontSize: '10px', 
              wordBreak: 'break-all',
              lineHeight: '1.2'
            }}>
              {formula.example}
            </code>
          </div>
        ))}
      </Card.Body>
    </Card>
  );

  const getCategoryDisplayName = (category) => {
    const names = {
      queries: 'SQL Aggregate Functions',
      dates: 'Date/Time Functions',
      variables: 'Variables & Random',
      patterns: 'Common Patterns'
    };
    return names[category] || category;
  };

  const panelContent = (
    <div 
      className={`formula-help-panel ${show ? 'show' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        right: show ? 0 : '-400px',
        width: '400px',
        height: '100vh',
        backgroundColor: 'var(--theme-modal-bg)',
        color: 'var(--theme-text-primary)',
        boxShadow: show ? '-2px 0 10px rgba(0,0,0,0.2)' : 'none',
        transition: 'right 0.3s ease-in-out',
        zIndex: 1060,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--theme-border-color)'
      }}
    >
      <div className="panel-header" style={{
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--theme-modal-bg)',
        borderBottom: '1px solid var(--theme-border-color)'
      }}>
        <h6 className="mb-0">Formula Expression Reference</h6>
        <Button 
          variant="outline-secondary" 
          size="sm" 
          onClick={onHide}
          style={{ padding: '4px 8px' }}
        >
          <FiX />
        </Button>
      </div>
      
      <div className="panel-body" style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }}>
        <div className="mb-3">
          <small className="text-muted" style={{ fontSize: '12px' }}>
            Formula expressions execute after simulation completion when all referenced data exists.
            Use @column_name to reference current row values.
          </small>
        </div>
        
        {renderFormulaCard('queries', formulaCategories.queries)}
        {renderFormulaCard('dates', formulaCategories.dates)}
        {renderFormulaCard('variables', formulaCategories.variables)}
        {renderFormulaCard('patterns', formulaCategories.patterns)}
        
        <Card 
          className="mt-3" 
          style={{ 
            fontSize: '12px',
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border-color)',
            color: 'var(--theme-text-primary)'
          }}
        >
          <Card.Header style={{ 
            padding: '8px 12px',
            backgroundColor: 'var(--theme-card-bg)',
            borderBottomColor: 'var(--theme-border-color)'
          }}>
            <Badge bg="warning" className="me-1" style={{ fontSize: '10px' }}>RULES</Badge>
            <span className="fw-semibold">Important Notes</span>
          </Card.Header>
          <Card.Body style={{ padding: '8px 12px' }}>
            <ul style={{ fontSize: '11px', margin: 0, paddingLeft: '16px' }}>
              <li>Formulas execute after simulation completion</li>
              <li>Must return a single scalar value (not multiple rows)</li>
              <li>NULL results are preserved (no defaults applied)</li>
              <li>Only reference columns from current row using @column_name</li>
              <li>No recursive formulas (can't reference own column)</li>
            </ul>
          </Card.Body>
        </Card>
      </div>
    </div>
  );

  // Use portal to render panel at document body level
  return ReactDOM.createPortal(panelContent, document.body);
};

export default FormulaHelpPanel;