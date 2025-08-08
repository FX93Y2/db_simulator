import React, { useState, useEffect } from 'react';
import { Form, Card, Row, Col, InputGroup } from 'react-bootstrap';
import { FiClock, FiCalendar, FiHash, FiUsers } from 'react-icons/fi';
import yaml from 'yaml';

const SimulationEditor = ({ yamlContent, onSimulationChange, theme }) => {
  const [simulationData, setSimulationData] = useState({
    simulation: {
      duration_days: 30,
      start_date: '2024-01-01',
      random_seed: 42
    },
    event_simulation: {}
  });

  // Parse YAML content when it changes
  useEffect(() => {
    if (yamlContent) {
      try {
        const parsed = yaml.parse(yamlContent);
        if (parsed) {
          setSimulationData(prevData => ({
            simulation: {
              ...prevData.simulation,
              ...(parsed.simulation || {})
            },
            event_simulation: {
              ...prevData.event_simulation,
              ...(parsed.event_simulation || {})
            }
          }));
        }
      } catch (error) {
        console.error('Error parsing YAML in SimulationEditor:', error);
      }
    }
  }, [yamlContent]);

  // Handle changes to simulation settings
  const handleSimulationChange = (field, value) => {
    const updatedData = {
      ...simulationData,
      simulation: {
        ...simulationData.simulation,
        [field]: value
      }
    };
    setSimulationData(updatedData);
    onSimulationChange(updatedData);
  };



  return (
    <div className="simulation-editor">
      <div className="simulation-editor-content">
        {/* Simulation Settings Section */}
        <Card className="mb-4">
          <Card.Header className="d-flex align-items-center">
            <FiClock className="me-2" />
            <h5 className="mb-0">Simulation Settings</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FiClock className="me-2" />
                    Duration (days)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    value={simulationData.simulation.duration_days}
                    onChange={(e) => handleSimulationChange('duration_days', parseInt(e.target.value) || 1)}
                    placeholder="Enter duration in days"
                  />
                  <Form.Text className="text-muted">
                    How long the simulation should run
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FiCalendar className="me-2" />
                    Start Date
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={simulationData.simulation.start_date}
                    onChange={(e) => handleSimulationChange('start_date', e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    Simulation start date
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FiHash className="me-2" />
                    Random Seed
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={simulationData.simulation.random_seed}
                    onChange={(e) => handleSimulationChange('random_seed', parseInt(e.target.value) || 42)}
                    placeholder="Enter random seed"
                  />
                  <Form.Text className="text-muted">
                    Seed for reproducible results
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default SimulationEditor;