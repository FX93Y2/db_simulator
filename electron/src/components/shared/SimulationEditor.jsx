import React from 'react';
import { Form, Card, Row, Col, Button, Alert } from 'react-bootstrap';
import { FiClock, FiCalendar, FiHash, FiSave, FiRotateCcw } from 'react-icons/fi';
import { 
  useHasUnsavedSimulation, 
  useSimulationActions 
} from '../../stores/simulationConfigStore';

const SimulationEditor = ({ projectId }) => {
  // Store hooks  
  const hasUnsaved = useHasUnsavedSimulation(projectId);
  const {
    updateSimulationField,
    applySimulationChanges,
    resetSimulationChanges,
    getFieldValue,
    hasFieldPendingChanges
  } = useSimulationActions(projectId);

  // Handle field changes (store in pending changes only)
  const handleFieldChange = (field, value) => {
    console.log('[SimulationEditor] Field changed:', field, '=', value);
    updateSimulationField(field, value);
  };

  // Handle Save & Apply
  const handleApplyChanges = () => {
    console.log('[SimulationEditor] Applying changes...');
    const result = applySimulationChanges();
    if (result.success) {
      console.log('[SimulationEditor] Changes applied successfully');
    }
  };

  // Handle Reset/Discard
  const handleResetChanges = () => {
    console.log('[SimulationEditor] Resetting changes...');
    resetSimulationChanges();
  };



  return (
    <div className="simulation-editor">
      <div className="simulation-editor-content">
        {/* Simulation Settings Section */}
        <Card className="mb-4">
          <Card.Header className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <FiClock className="me-2" />
              <h5 className="mb-0">
                Simulation Settings
                {hasUnsaved && <span className="text-warning ms-2">*</span>}
              </h5>
            </div>
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleResetChanges}
                className="me-2"
                title={hasUnsaved ? "Reset to saved values" : "No changes to reset"}
                disabled={!hasUnsaved}
              >
                Reset
              </Button>
              <Button
                variant={hasUnsaved ? "primary" : "outline-primary"}
                size="sm"
                onClick={handleApplyChanges}
                title={hasUnsaved ? "Apply changes to YAML" : "No changes to apply"}
                disabled={!hasUnsaved}
              >
                Apply
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FiClock className="me-2" />
                    Duration (days)
                    {hasFieldPendingChanges('duration_days') && (
                      <span className="text-warning ms-1">*</span>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    value={getFieldValue('duration_days')}
                    onChange={(e) => handleFieldChange('duration_days', parseInt(e.target.value) || 1)}
                    placeholder="Enter duration in days"
                    className={hasFieldPendingChanges('duration_days') ? 'border-warning' : ''}
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
                    {hasFieldPendingChanges('start_date') && (
                      <span className="text-warning ms-1">*</span>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={getFieldValue('start_date')}
                    onChange={(e) => handleFieldChange('start_date', e.target.value)}
                    className={hasFieldPendingChanges('start_date') ? 'border-warning' : ''}
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
                    {hasFieldPendingChanges('random_seed') && (
                      <span className="text-warning ms-1">*</span>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={getFieldValue('random_seed')}
                    onChange={(e) => handleFieldChange('random_seed', parseInt(e.target.value) || 42)}
                    placeholder="Enter random seed"
                    className={hasFieldPendingChanges('random_seed') ? 'border-warning' : ''}
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