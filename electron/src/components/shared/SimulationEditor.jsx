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
    event_simulation: {
      entity_arrival: {
        interarrival_time: {
          distribution: {
            type: 'exponential',
            scale: 2
          }
        },
        max_entities: 'n/a'
      }
    }
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
              ...(parsed.event_simulation || {}),
              entity_arrival: {
                ...prevData.event_simulation.entity_arrival,
                ...(parsed.event_simulation?.entity_arrival || {})
              }
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

  // Handle changes to entity arrival settings
  const handleEntityArrivalChange = (field, value) => {
    let updatedData;
    
    if (field === 'distribution_type') {
      updatedData = {
        ...simulationData,
        event_simulation: {
          ...simulationData.event_simulation,
          entity_arrival: {
            ...simulationData.event_simulation.entity_arrival,
            interarrival_time: {
              distribution: {
                type: value,
                scale: simulationData.event_simulation.entity_arrival.interarrival_time?.distribution?.scale || 2
              }
            }
          }
        }
      };
    } else if (field === 'scale') {
      updatedData = {
        ...simulationData,
        event_simulation: {
          ...simulationData.event_simulation,
          entity_arrival: {
            ...simulationData.event_simulation.entity_arrival,
            interarrival_time: {
              distribution: {
                ...simulationData.event_simulation.entity_arrival.interarrival_time.distribution,
                scale: parseFloat(value) || 0
              }
            }
          }
        }
      };
    } else if (field === 'max_entities') {
      updatedData = {
        ...simulationData,
        event_simulation: {
          ...simulationData.event_simulation,
          entity_arrival: {
            ...simulationData.event_simulation.entity_arrival,
            max_entities: value === '' ? 'n/a' : (isNaN(value) ? value : parseInt(value))
          }
        }
      };
    }
    
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

        {/* Event Simulation Section */}
        <Card>
          <Card.Header className="d-flex align-items-center">
            <FiUsers className="me-2" />
            <h5 className="mb-0">Event Simulation</h5>
          </Card.Header>
          <Card.Body>
            {/* Entity Arrival Subsection */}
            <div className="entity-arrival-section">
              <h6 className="mb-3 text-primary">
                <FiUsers className="me-2" />
                Entity Arrival
              </h6>
              
              <Card className="interarrival-time-card">
                <Card.Body>
                  <h6 className="mb-3">Interarrival Time</h6>
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Distribution Type</Form.Label>
                        <Form.Select
                          value={simulationData.event_simulation.entity_arrival.interarrival_time?.distribution?.type || 'exponential'}
                          onChange={(e) => handleEntityArrivalChange('distribution_type', e.target.value)}
                        >
                          <option value="exponential">Exponential</option>
                          <option value="normal">Normal</option>
                          <option value="uniform">Uniform</option>
                          <option value="constant">Constant</option>
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Distribution for time between entity arrivals
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Scale</Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={simulationData.event_simulation.entity_arrival.interarrival_time?.distribution?.scale || 2}
                            onChange={(e) => handleEntityArrivalChange('scale', e.target.value)}
                            placeholder="Enter scale value"
                          />
                          <InputGroup.Text>days</InputGroup.Text>
                        </InputGroup>
                        <Form.Text className="text-muted">
                          Average time between arrivals
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Max Entities</Form.Label>
                        <Form.Control
                          type="text"
                          value={simulationData.event_simulation.entity_arrival.max_entities}
                          onChange={(e) => handleEntityArrivalChange('max_entities', e.target.value)}
                          placeholder="Enter max entities or 'n/a'"
                        />
                        <Form.Text className="text-muted">
                          Maximum entities to generate (use 'n/a' for unlimited)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default SimulationEditor;