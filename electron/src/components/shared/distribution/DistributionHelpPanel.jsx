import React from 'react';
import ReactDOM from 'react-dom';
import { Card, Badge, Button } from 'react-bootstrap';
import { FiX } from 'react-icons/fi';

const DistributionHelpPanel = ({ show, onHide }) => {
  const distributions = {
    continuous: [
      {
        name: 'UNIF',
        syntax: 'UNIF(min, max)',
        description: 'Uniform distribution between min and max',
        example: 'UNIF(1, 10)'
      },
      {
        name: 'NORM',
        syntax: 'NORM(mean, stddev)',
        description: 'Normal (Gaussian) distribution',
        example: 'NORM(5, 1.5)'
      },
      {
        name: 'EXPO',
        syntax: 'EXPO(scale)',
        description: 'Exponential distribution',
        example: 'EXPO(2)'
      },
      {
        name: 'TRIA',
        syntax: 'TRIA(min, mode, max)',
        description: 'Triangular distribution',
        example: 'TRIA(1, 5, 10)'
      },
      {
        name: 'BETA',
        syntax: 'BETA(min, max, shape1, shape2)',
        description: 'Beta distribution scaled to range [min, max]',
        example: 'BETA(0, 1, 2, 3)'
      },
      {
        name: 'GAMA',
        syntax: 'GAMA(alpha, beta)',
        description: 'Gamma distribution',
        example: 'GAMA(2, 1.5)'
      },
      {
        name: 'ERLA',
        syntax: 'ERLA(mean, k)',
        description: 'Erlang distribution',
        example: 'ERLA(5, 3)'
      },
      {
        name: 'LOGN',
        syntax: 'LOGN(mean, sigma)',
        description: 'Lognormal distribution',
        example: 'LOGN(1, 0.5)'
      },
      {
        name: 'WEIB',
        syntax: 'WEIB(alpha, beta)',
        description: 'Weibull distribution',
        example: 'WEIB(1.5, 2)'
      }
    ],
    discrete: [
      {
        name: 'DISC',
        syntax: 'DISC(p1, v1, p2, v2, ...)',
        description: 'Discrete distribution with probability-value pairs',
        example: 'DISC(0.7, "simple", 0.3, "complex")'
      },
      {
        name: 'POIS',
        syntax: 'POIS(lambda)',
        description: 'Poisson distribution',
        example: 'POIS(3.5)'
      }
    ],
    special: [
      {
        name: 'RAND',
        syntax: 'RAND()',
        description: 'Uniform random number between 0 and 1',
        example: 'RAND()'
      },
      {
        name: 'FIXED',
        syntax: 'FIXED(value)',
        description: 'Constant value',
        example: 'FIXED(42)'
      }
    ]
  };

  const renderDistributionCard = (category, distributions) => (
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
        <span className="fw-semibold" style={{ fontSize: '12px' }}>{category}</span>
      </Card.Header>
      <Card.Body className="py-1" style={{ padding: '8px 12px' }}>
        {distributions.map((dist, index) => (
          <div key={index} className="distribution-item mb-1">
            <div className="d-flex justify-content-between align-items-center">
              <code className="text-primary fw-bold" style={{ fontSize: '12px' }}>
                {dist.syntax}
              </code>
              <code className="text-success ms-1" style={{ fontSize: '11px' }}>
                {dist.example}
              </code>
            </div>
          </div>
        ))}
      </Card.Body>
    </Card>
  );


  const panelContent = (
    <div 
      className={`distribution-help-panel ${show ? 'show' : ''}`}
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
        backgroundColor: 'var(--theme-modal-bg)'
      }}>
        <h6 className="mb-0">Distribution Reference</h6>
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
        {renderDistributionCard('Continuous', distributions.continuous)}
        {renderDistributionCard('Discrete', distributions.discrete)}
        {renderDistributionCard('Special', distributions.special)}
      </div>
    </div>
  );

  // Use portal to render panel at document body level
  return ReactDOM.createPortal(panelContent, document.body);
};

export default DistributionHelpPanel;