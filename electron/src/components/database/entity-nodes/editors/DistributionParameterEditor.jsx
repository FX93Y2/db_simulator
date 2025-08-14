import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';

const DistributionParameterEditor = ({ distributionType, distribution, onDistributionChange }) => {
  const renderParameterFields = () => {
    switch (distributionType) {
      case 'normal':
        return (
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Mean</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={distribution.mean || 0}
                  onChange={(e) => onDistributionChange('mean', parseFloat(e.target.value))}
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
                  value={distribution.stddev || 1}
                  onChange={(e) => onDistributionChange('stddev', parseFloat(e.target.value))}
                />
              </Form.Group>
            </Col>
          </Row>
        );

      case 'uniform':
        return (
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Minimum</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={distribution.min || 0}
                  onChange={(e) => onDistributionChange('min', parseFloat(e.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Maximum</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  value={distribution.max || 1}
                  onChange={(e) => onDistributionChange('max', parseFloat(e.target.value))}
                />
              </Form.Group>
            </Col>
          </Row>
        );

      case 'exponential':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Scale</Form.Label>
            <Form.Control
              type="number"
              step="0.1"
              min="0.1"
              value={distribution.scale || 1}
              onChange={(e) => onDistributionChange('scale', parseFloat(e.target.value))}
            />
          </Form.Group>
        );

      case 'poisson':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Lambda (Rate)</Form.Label>
            <Form.Control
              type="number"
              step="0.1"
              min="0.1"
              value={distribution.lambda || 1}
              onChange={(e) => onDistributionChange('lambda', parseFloat(e.target.value))}
            />
            <Form.Text className="text-muted">
              Average number of events per interval
            </Form.Text>
          </Form.Group>
        );

      case 'binomial':
        return (
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Trials (n)</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={distribution.n || 10}
                  onChange={(e) => onDistributionChange('n', parseInt(e.target.value))}
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
                  value={distribution.p || 0.5}
                  onChange={(e) => onDistributionChange('p', parseFloat(e.target.value))}
                />
              </Form.Group>
            </Col>
          </Row>
        );

      case 'gamma':
        return (
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Shape (alpha)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={distribution.alpha || 1}
                  onChange={(e) => onDistributionChange('alpha', parseFloat(e.target.value))}
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
                  value={distribution.beta || 1}
                  onChange={(e) => onDistributionChange('beta', parseFloat(e.target.value))}
                />
              </Form.Group>
            </Col>
          </Row>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {renderParameterFields()}
    </div>
  );
};

export default DistributionParameterEditor;