import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { FiHelpCircle, FiBook, FiDatabase, FiSettings, FiPlay } from 'react-icons/fi';

const ConfigurationGuide = () => {
  return (
    <Container fluid className="welcome-page p-4">
      <Row className="justify-content-center">
        <Col lg={8} xl={6}>
          <div className="text-center mb-5">
            <h1 className="display-4 mb-3">Database Simulator</h1>
            <p className="lead text-muted">
              Design, configure, and simulate database workloads with discrete event simulation
            </p>
          </div>

          <Row className="g-4">
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="text-center p-4">
                  <FiDatabase className="text-primary mb-3" size={48} />
                  <h5>Database Configuration</h5>
                  <p className="text-muted">
                    Define your database schema, entities, and relationships using YAML configuration files.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="text-center p-4">
                  <FiSettings className="text-primary mb-3" size={48} />
                  <h5>Simulation Logic</h5>
                  <p className="text-muted">
                    Build event flows, resource allocation, and process simulation using visual tools.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="text-center p-4">
                  <FiPlay className="text-primary mb-3" size={48} />
                  <h5>Run Simulations</h5>
                  <p className="text-muted">
                    Execute discrete event simulations and analyze results with comprehensive reporting.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="text-center p-4">
                  <FiHelpCircle className="text-primary mb-3" size={48} />
                  <h5>Get Help</h5>
                  <p className="text-muted">
                    Access comprehensive documentation and examples by clicking the help button in the header.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <div className="text-center mt-5">
            <Card className="border-0 bg-light">
              <Card.Body className="py-4">
                <h6 className="text-primary mb-3">Quick Start</h6>
                <p className="mb-2">
                  1. Click the <FiDatabase className="mx-1" /> button in the header to access Database Explorer
                </p>
                <p className="mb-2">
                  2. Create a new project or select an existing one
                </p>
                <p className="mb-2">
                  3. Configure your database schema and simulation logic
                </p>
                <p className="mb-0">
                  4. Click <FiHelpCircle className="mx-1" /> anytime for detailed documentation
                </p>
              </Card.Body>
            </Card>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default ConfigurationGuide;