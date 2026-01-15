import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { FiHelpCircle, FiFile, FiDatabase, FiSettings, FiPlay } from 'react-icons/fi';
import AppIcon from '../shared/AppIcon';

const ConfigurationGuide = () => {
  return (
    <Container fluid className="welcome-page p-4">
      <Row className="justify-content-center">
        <Col lg={8} xl={6}>
          <div className="text-center mb-5">
            <AppIcon className="mb-4" width={140} height={133} />
            <h1 className="display-4 mb-3">Database Simulator</h1>

          </div>



          <div className="text-center mt-5">
            <div className="py-4">
              <h6 className="text-primary mb-3">Quick Start</h6>
              <p className="mb-2">
                1. Click the <FiFile className="mx-1 text-primary" /> button in the header to access Database Explorer
              </p>
              <p className="mb-0">
                2. Click <FiHelpCircle className="mx-1 text-primary" /> anytime for detailed documentation
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default ConfigurationGuide;