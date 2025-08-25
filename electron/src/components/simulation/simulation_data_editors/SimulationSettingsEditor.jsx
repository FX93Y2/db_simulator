import React, { useState } from 'react';
import { Form, Card, Row, Col, Button, Alert } from 'react-bootstrap';
import { FiClock, FiCalendar, FiHash, FiSave, FiRotateCcw, FiHelpCircle } from 'react-icons/fi';
import { 
  useHasUnsavedSimulation, 
  useSimulationActions 
} from '../../../stores/simulationConfigStore';
import { SharedHelpPanel } from '../../shared/help';

const SimulationSettingsEditor = ({ projectId }) => {
  // Store hooks  
  const hasUnsaved = useHasUnsavedSimulation(projectId);
  const {
    updateSimulationField,
    applySimulationChanges,
    resetSimulationChanges,
    getFieldValue,
    hasFieldPendingChanges
  } = useSimulationActions(projectId);

  // Help panel state
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  // Handle field changes (store in pending changes only)
  const handleFieldChange = (field, value) => {
    console.log('[SimulationSettingsEditor] Field changed:', field, '=', value);
    updateSimulationField(field, value);
  };

  // Handle Save & Apply
  const handleApplyChanges = () => {
    console.log('[SimulationSettingsEditor] Applying changes...');
    const result = applySimulationChanges();
    if (result.success) {
      console.log('[SimulationSettingsEditor] Changes applied successfully');
    }
  };

  // Handle Reset/Discard
  const handleResetChanges = () => {
    console.log('[SimulationSettingsEditor] Resetting changes...');
    resetSimulationChanges();
  };



  return (
    <>
      <div className="simulation-editor">
        <div className="simulation-editor-content">
          {/* Remove card wrapper to match Figma design - just the content */}
          <div className="simulation-setup-content">
            {/* Three-column layout for base settings */}
            <Row className="mb-4">
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Base Time Unit
                    {hasFieldPendingChanges('base_time_unit') && (
                      <span className="text-warning ms-1">*</span>
                    )}
                  </Form.Label>
                  <Form.Select
                    value={getFieldValue('base_time_unit')}
                    onChange={(e) => handleFieldChange('base_time_unit', e.target.value)}
                    className={hasFieldPendingChanges('base_time_unit') ? 'border-warning' : ''}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
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
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
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
                </Form.Group>
              </Col>
            </Row>
            
            {/* Full-width termination condition with integrated help button */}
            <Row>
              <Col md={12}>
                <Form.Group className="mb-4">
                  <Form.Label>
                    Termination Condition
                    {hasFieldPendingChanges('terminating_conditions') && (
                      <span className="text-warning ms-1">*</span>
                    )}
                  </Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type="text"
                      value={getFieldValue('terminating_conditions')}
                      onChange={(e) => handleFieldChange('terminating_conditions', e.target.value)}
                      placeholder="e.g., TIME(720) OR ENTITIES(Order, 1000)"
                      className={`pe-5 ${hasFieldPendingChanges('terminating_conditions') ? 'border-warning' : ''}`}
                      style={{ paddingRight: '40px' }}
                    />
                    {/* Integrated help button */}
                    <Button
                      variant=""
                      size="sm"
                      onClick={() => setShowHelpPanel(!showHelpPanel)}
                      className={`position-absolute top-50 translate-middle-y border-0 help-toggle-btn ${showHelpPanel ? 'active' : ''}`}
                      style={{
                        right: '8px',
                        zIndex: 5,
                        padding: '4px',
                        borderRadius: 'inherit'
                      }}
                      title={showHelpPanel ? "Hide termination conditions help" : "Show termination conditions help"}
                    >
                      <FiHelpCircle size={18} />
                    </Button>
                  </div>
                </Form.Group>
              </Col>
            </Row>
            
            {/* Action buttons */}
            <Row>
              <Col md={12} className="d-flex justify-content-end">
                <Button
                  variant="outline-secondary"
                  className="me-2"
                  onClick={handleResetChanges}
                  disabled={!hasUnsaved}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApplyChanges}
                >
                  Apply
                </Button>
              </Col>
            </Row>
          </div>
        </div>
      </div>
      
      {/* Help Panel */}
      <SharedHelpPanel 
        show={showHelpPanel}
        onHide={() => setShowHelpPanel(false)}
        helpType="termination"
      />
    </>
  );
};

export default SimulationSettingsEditor;