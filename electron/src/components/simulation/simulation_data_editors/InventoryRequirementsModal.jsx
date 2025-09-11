import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import DistributionFormulaInput from '../../shared/distribution/DistributionFormulaInput';
import useInventoryTables from '../../../hooks/shared/useInventoryTables';
import useBridgeTables from '../../../hooks/shared/useBridgeTables';

const InventoryRequirementsModal = ({ 
  show, 
  onHide, 
  entityName,
  dbConfigContent,
  onSave,
  initialData = null,
  theme = 'light'
}) => {
  const [formData, setFormData] = useState({
    inventory_table: '',
    bridge_table: '',
    selection_strategy: 'random',
    quantity: 'DISC(0.6, 1, 0.3, 2, 0.1, 3)',
    unit_quantity: 'DISC(0.8, 1, 0.15, 2, 0.05, 10)'
  });

  // Get available tables from database config
  const inventoryTables = useInventoryTables(dbConfigContent);
  const bridgeTables = useBridgeTables(dbConfigContent);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (show) {
      if (initialData) {
        setFormData({
          inventory_table: initialData.inventory_table || '',
          bridge_table: initialData.bridge_table || '',
          selection_strategy: initialData.selection_strategy || 'random',
          quantity: initialData.quantity || 'DISC(0.6, 1, 0.3, 2, 0.1, 3)',
          unit_quantity: initialData.unit_quantity || 'DISC(0.8, 1, 0.15, 2, 0.05, 10)'
        });
      } else {
        // Reset to defaults for new configuration
        setFormData({
          inventory_table: '',
          bridge_table: '',
          selection_strategy: 'random',
          quantity: 'DISC(0.6, 1, 0.3, 2, 0.1, 3)',
          unit_quantity: 'DISC(0.8, 1, 0.15, 2, 0.05, 10)'
        });
      }
    }
  }, [show, initialData]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(entityName, formData);
    }
    onHide();
  };

  const handleCancel = () => {
    onHide();
  };

  // Validate required fields
  const isValid = formData.inventory_table && formData.bridge_table && formData.quantity && formData.unit_quantity;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="md"
      centered
      enforceFocus={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Inventory Requirements - {entityName}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <Form>
          <Row>
            <Col md={6}>
              {/* Inventory Table Selection */}
              <Form.Group className="mb-3">
                <Form.Label>
                  Inventory Table
                  <span className="text-danger ms-1">*</span>
                </Form.Label>
                {inventoryTables.length > 0 ? (
                  <Form.Select
                    value={formData.inventory_table}
                    onChange={(e) => handleFieldChange('inventory_table', e.target.value)}
                    required
                  >
                    <option value="">Select inventory table...</option>
                    {inventoryTables.map((table) => (
                      <option key={table} value={table}>{table}</option>
                    ))}
                  </Form.Select>
                ) : (
                  <Form.Control
                    type="text"
                    value={formData.inventory_table}
                    onChange={(e) => handleFieldChange('inventory_table', e.target.value)}
                    placeholder="Enter inventory table name"
                    required
                  />
                )}
                {inventoryTables.length === 0 && (
                  <Form.Text className="text-muted">
                    No inventory tables found in database config. You can enter a table name manually.
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            
            <Col md={6}>
              {/* Bridge Table Selection */}
              <Form.Group className="mb-3">
                <Form.Label>
                  Bridge Table
                  <span className="text-danger ms-1">*</span>
                </Form.Label>
                {bridgeTables.length > 0 ? (
                  <Form.Select
                    value={formData.bridge_table}
                    onChange={(e) => handleFieldChange('bridge_table', e.target.value)}
                    required
                  >
                    <option value="">Select bridge table...</option>
                    {bridgeTables.map((table) => (
                      <option key={table} value={table}>{table}</option>
                    ))}
                  </Form.Select>
                ) : (
                  <Form.Control
                    type="text"
                    value={formData.bridge_table}
                    onChange={(e) => handleFieldChange('bridge_table', e.target.value)}
                    placeholder="Enter bridge table name"
                    required
                  />
                )}
                {bridgeTables.length === 0 && (
                  <Form.Text className="text-muted">
                    No bridge tables found in database config. You can enter a table name manually.
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              {/* Selection Strategy */}
              <Form.Group className="mb-3">
                <Form.Label>Selection Strategy</Form.Label>
                <Form.Select
                  value={formData.selection_strategy}
                  onChange={(e) => handleFieldChange('selection_strategy', e.target.value)}
                >
                  <option value="random">Random</option>
                  {/* Future strategies can be added here */}
                </Form.Select>
                <Form.Text className="text-muted">
                  Strategy for selecting inventory items.
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              {/* Quantity Distribution */}
              <DistributionFormulaInput
                label="Quantity"
                value={formData.quantity}
                onChange={(value) => handleFieldChange('quantity', value)}
                placeholder="e.g., DISC(0.6, 1, 0.3, 2, 0.1, 3)"
                helpText="Number of different inventory items to select per entity"
                required
              />
            </Col>
            
            <Col md={6}>
              {/* Unit Quantity Distribution */}
              <DistributionFormulaInput
                label="Unit Quantity"
                value={formData.unit_quantity}
                onChange={(value) => handleFieldChange('unit_quantity', value)}
                placeholder="e.g., DISC(0.8, 1, 0.15, 2, 0.05, 10)"
                helpText="Quantity per selected inventory item"
                required
              />
            </Col>
          </Row>

        </Form>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={!isValid}
        >
          Save Configuration
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InventoryRequirementsModal;