import React from 'react';
import ReactDOM from 'react-dom';
import { Card, Badge, Button } from 'react-bootstrap';
import { FiX } from 'react-icons/fi';

// Import help content modules
import { getTerminationConditionsHelp } from './helpContent/terminationConditions';
import { getDistributionHelp } from './helpContent/distributions';
import { getFormulaHelp } from './helpContent/formulas';

const SharedHelpPanel = ({ show, onHide, helpType = 'termination' }) => {
  // Get help content based on type
  const getHelpContent = () => {
    switch (helpType) {
      case 'termination':
        return getTerminationConditionsHelp();
      case 'distribution':
        return getDistributionHelp();
      case 'formula':
        return getFormulaHelp();
      default:
        return getTerminationConditionsHelp();
    }
  };

  const getTitle = () => {
    switch (helpType) {
      case 'termination':
        return 'Termination Conditions Reference';
      case 'distribution':
        return 'Distribution Reference';
      case 'formula':
        return 'Formula Expression Reference';
      default:
        return 'Help Reference';
    }
  };

  const helpContent = getHelpContent();

  const renderHelpCard = (categoryTitle, items) => (
    <Card 
      className="mb-2" 
      style={{ 
        fontSize: '14px',
        backgroundColor: 'var(--theme-card-bg)',
        color: 'var(--theme-text-primary)'
      }}
    >
      <Card.Header 
        className="py-1" 
        style={{ 
          padding: '8px 12px',
          backgroundColor: 'var(--theme-card-bg)',
          color: 'var(--theme-text-primary)'
        }}
      >
        <span className="fw-semibold" style={{ fontSize: '12px' }}>
          {categoryTitle}
        </span>
      </Card.Header>
      <Card.Body className="py-1" style={{ padding: '8px 12px' }}>
        {items.map((item, index) => (
          <div key={index} className="help-item mb-2">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <span className="help-tag">
                  {item.syntax}
                </span>
                <div className="help-description">
                  {item.description}
                </div>
              </div>
            </div>
            <code className="help-example d-block mt-1">
              {item.example}
            </code>
          </div>
        ))}
      </Card.Body>
    </Card>
  );

  const panelContent = (
    <div 
      className={`shared-help-panel ${show ? 'show' : ''}`}
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
        border: '1px solid var(--theme-border)'
      }}
    >
      <div className="panel-header" style={{
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--theme-modal-bg)',
        borderBottom: '1px solid var(--theme-border)'
      }}>
        <h6 className="mb-0">{getTitle()}</h6>
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
        {helpContent.description && (
          <div className="mb-3">
            <small className="text-muted" style={{ fontSize: '12px' }}>
              {helpContent.description}
            </small>
          </div>
        )}
        
        {/* Render all categories */}
        {helpContent.categories && Object.entries(helpContent.categories).map(([categoryKey, category]) => (
          renderHelpCard(category.title, category.items)
        ))}
        
        {/* Render important notes if available */}
        {helpContent.notes && (
          <Card 
            className="mt-3" 
            style={{ 
              fontSize: '12px',
              backgroundColor: 'var(--theme-card-bg)',
              color: 'var(--theme-text-primary)'
            }}
          >
            <Card.Header style={{ 
              padding: '8px 12px',
              backgroundColor: 'var(--theme-card-bg)'
            }}>
              <Badge bg="warning" className="me-1" style={{ fontSize: '10px' }}>RULES</Badge>
              <span className="fw-semibold">Important Notes</span>
            </Card.Header>
            <Card.Body style={{ padding: '8px 12px' }}>
              <ul style={{ fontSize: '11px', margin: 0, paddingLeft: '16px' }}>
                {helpContent.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        )}
      </div>
    </div>
  );

  // Use portal to render panel at document body level
  return ReactDOM.createPortal(panelContent, document.body);
};

export default SharedHelpPanel;