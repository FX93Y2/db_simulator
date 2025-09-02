import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import AttributeTable from './AttributeTable';
import ConfirmationModal from '../../../shared/ConfirmationModal';

const EntityEditor = ({ show, onHide, entity, onEntityUpdate, onEntityDelete, theme }) => {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [rows, setRows] = useState('n/a');
  const [attributes, setAttributes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastEntityName, setLastEntityName] = useState(null);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  // Initialize form when entity changes
  useEffect(() => {
    // Only reset form data when entity actually changes (new entity opened), not during auto-updates
    if (entity && (!lastEntityName || entity.name !== lastEntityName)) {
      setLastEntityName(entity.name);
      setName(entity.name || '');
      setEntityType(entity.type || '');
      setRows(entity.rows || 'n/a');
      setAttributes(entity.attributes || []);
      setValidationErrors([]);
    } else if (!entity && lastEntityName !== null) {
      // Reset form for new entity only if coming from an existing entity
      setLastEntityName(null);
      setName('');
      setEntityType('');
      setRows('n/a');
      setAttributes([{
        name: 'id',
        type: 'pk'
      }]);
      setValidationErrors([]);
    }
  }, [entity, lastEntityName]);

  // Reset form data only when modal opens, not during editing
  useEffect(() => {
    if (show && entity && (!lastEntityName || entity.name !== lastEntityName)) {
      // Only reset when opening modal with a different entity
      setName(entity.name || '');
      setEntityType(entity.type || '');
      setRows(entity.rows || 'n/a');
      setAttributes(entity.attributes || []);
      setValidationErrors([]);
    } else if (show && !entity) {
      // Reset for new entity when modal opens
      setName('');
      setEntityType('');
      setRows('n/a');
      setAttributes([{
        name: 'id',
        type: 'pk'
      }]);
      setValidationErrors([]);
    }
  }, [show, entity, lastEntityName]);

  // Validate entity data
  const validateEntity = () => {
    const errors = [];
    
    if (!name.trim()) {
      errors.push('Entity name is required');
    }
    
    if (attributes.length === 0) {
      errors.push('At least one attribute is required');
    }
    
    // Check for duplicate attribute names
    const attributeNames = attributes.map(attr => attr.name.toLowerCase());
    const duplicates = attributeNames.filter((name, index) => attributeNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate attribute names: ${duplicates.join(', ')}`);
    }
    
    // Check for empty attribute names
    const emptyNames = attributes.filter(attr => !attr.name.trim());
    if (emptyNames.length > 0) {
      errors.push('All attributes must have names');
    }
    
    // Validate primary key
    const primaryKeys = attributes.filter(attr => attr.type === 'pk');
    if (primaryKeys.length === 0) {
      errors.push('Entity must have a primary key');
    } else if (primaryKeys.length > 1) {
      errors.push('Entity can only have one primary key');
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Handle attribute changes
  const handleAttributeChange = (index, updatedAttribute) => {
    const newAttributes = [...attributes];
    newAttributes[index] = updatedAttribute;
    setAttributes(newAttributes);
  };

  // Add new attribute
  const handleAddAttribute = () => {
    const newAttribute = {
      name: `attribute_${attributes.length + 1}`,
      type: 'string',
      generator: {
        type: 'faker',
        method: 'name'
      }
    };
    setAttributes([...attributes, newAttribute]);
  };

  // Delete attribute
  const handleDeleteAttribute = (index) => {
    const attributeToDelete = attributes[index];
    
    // Prevent deletion of protected auto-generated columns
    if ((entityType === 'bridging' && 
         (attributeToDelete.name === 'start_date' || attributeToDelete.name === 'end_date')) ||
        (entityType === 'entity' && attributeToDelete.name === 'created_at')) {
      return; // Do nothing for protected columns
    }
    
    // Prevent deletion of resource_type in resource entities
    if (entityType === 'resource' && attributeToDelete.type === 'resource_type') {
      return; // Do nothing for protected columns
    }
    
    const newAttributes = attributes.filter((_, i) => i !== index);
    setAttributes(newAttributes);
  };

  // Handle attributes changes from the table
  const handleAttributesChange = (newAttributes) => {
    setAttributes(newAttributes);
  };


  // Helper functions to handle form changes and mark as user editing
  const handleNameChange = (newName) => {
    setName(newName);
  };

  const handleEntityTypeChange = (newType) => {
    setEntityType(newType);
    
    // Auto-set rows for dynamic table types
    if (newType === 'bridging' || newType === 'entity' || newType === 'event') {
      setRows('n/a');
    }
    
    let updatedAttributes = [...attributes];

    // Handle bridging table date columns
    if (newType === 'bridging') {
      if (!updatedAttributes.some(attr => attr.name === 'start_date')) {
        updatedAttributes.push({ name: 'start_date', type: 'datetime' });
      }
      if (!updatedAttributes.some(attr => attr.name === 'end_date')) {
        updatedAttributes.push({ name: 'end_date', type: 'datetime' });
      }
    } else if (entityType === 'bridging') {
      updatedAttributes = updatedAttributes.filter(
        attr => !(attr.name === 'start_date' || attr.name === 'end_date')
      );
    }

    // Handle entity table created_at column
    if (newType === 'entity') {
      if (!updatedAttributes.some(attr => attr.name === 'created_at')) {
        updatedAttributes.push({ name: 'created_at', type: 'datetime' });
      }
    } else if (entityType === 'entity') {
      updatedAttributes = updatedAttributes.filter(
        attr => attr.name !== 'created_at'
      );
    }

    // Handle event table event_type column
    if (newType === 'event') {
      if (!updatedAttributes.some(attr => attr.type === 'event_type')) {
        updatedAttributes.push({ name: 'event_type', type: 'event_type' });
      }
    } else if (entityType === 'event') {
      updatedAttributes = updatedAttributes.filter(attr => attr.type !== 'event_type');
    }

    // Handle resource table resource_type column
    if (newType === 'resource') {
      if (!updatedAttributes.some(attr => attr.type === 'resource_type')) {
        updatedAttributes.push({ 
          name: 'resource_type', 
          type: 'resource_type',
          generator: {
            type: 'distribution',
            distribution: {
              type: 'choice',
              values: ['Type1', 'Type2', 'Type3'],
              weights: [0.4, 0.3, 0.3]
            }
          }
        });
      }
    } else if (entityType === 'resource') {
      updatedAttributes = updatedAttributes.filter(attr => attr.type !== 'resource_type');
    }

    setAttributes(updatedAttributes);
  };

  const handleRowsChange = (newRows) => {
    setRows(newRows);
  };

  // Handle entity deletion
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setIsLoading(true);
    try {
      onEntityDelete(entity);
      setIsLoading(false);
      onHide();
    } catch (error) {
      setIsLoading(false);
    }
  };

  // Force immediate save without debounce
  const forceSave = () => {
    if (!name.trim() || attributes.length === 0) {
      return false; // Don't save if basic validation fails
    }

    if (validateEntity()) {
      const updatedEntity = {
        name: name.trim(),
        type: entityType || undefined,
        rows: entityType === 'resource' || entityType === 'inventory' ? (typeof rows === 'number' ? rows : parseInt(rows) || 100) : 
              (rows === 'n/a' || rows === '' ? rows : (typeof rows === 'number' ? rows : parseInt(rows) || rows)),
        attributes: attributes.map(attr => {
          const cleanedAttr = {
            name: attr.name.trim(),
            type: attr.type
          };
          
          // Add generator for non-primary key attributes
          if (attr.type !== 'pk' && attr.generator) {
            cleanedAttr.generator = { ...attr.generator };
          }
          
          // Add reference for foreign key types
          if ((attr.type === 'fk' || attr.type === 'event_id' || 
               attr.type === 'entity_id' || attr.type === 'resource_id' || attr.type === 'inventory_id') && attr.ref) {
            cleanedAttr.ref = attr.ref;
          }
          
          return cleanedAttr;
        })
      };
      
      onEntityUpdate(updatedEntity);
      return true;
    }
    return false;
  };

  // Handle save and close
  const handleSaveAndClose = () => {
    if (forceSave()) {
      onHide();
    }
    // If save fails due to validation, modal stays open with errors visible
  };



  return (
    <>
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      className={`entity-editor-modal ${showGeneratorModal ? 'generator-modal-open' : ''}`}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {entity ? `Edit Entity: ${entity.name}` : 'Create New Entity'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {validationErrors.length > 0 && (
          <Alert variant="danger">
            <ul className="mb-0">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
        
        <Form>
          {/* Entity Basic Information */}
          <div className="entity-basic-info mb-4">
            
            <div className="row">
              <div className="col-md-8">
                <div className="row">
                  <div className="col-md-6">
                    <Form.Group className="mb-3">
                      <Form.Label>Entity Name *</Form.Label>
                      <Form.Control
                        type="text"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Enter entity name"
                        isInvalid={validationErrors.some(error => error.includes('Entity name'))}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-6">
                    <Form.Group className="mb-3">
                      <Form.Label>Entity Type</Form.Label>
                      <Form.Select
                        value={entityType}
                        onChange={(e) => handleEntityTypeChange(e.target.value)}
                      >
                        <option value="">Default</option>
                        <option value="entity">Entity</option>
                        <option value="event">Event</option>
                        <option value="resource">Resource</option>
                        <option value="inventory">Inventory</option>
                        <option value="bridge">Bridge</option>
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Specify the role in simulations
                      </Form.Text>
                    </Form.Group>
                  </div>
                </div>
              </div>
              
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Number of Rows</Form.Label>
                  {entityType === 'resource' || entityType === 'inventory' ? (
                    <Form.Control
                      type="number"
                      min="1"
                      value={rows}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleRowsChange(value === '' ? '' : parseInt(value) || 100);
                      }}
                      placeholder="Number of rows"
                    />
                  ) : entityType === 'bridge' || entityType === 'entity' || entityType === 'event' ? (
                    <Form.Select
                      value={rows}
                      onChange={(e) => handleRowsChange(e.target.value)}
                      disabled
                    >
                      <option value="n/a">n/a (Dynamic)</option>
                    </Form.Select>
                  ) : (
                    <Form.Control
                      type="text"
                      value={rows}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow 'n/a' or numbers for default tables
                        if (value === 'n/a' || value === '') {
                          handleRowsChange(value === '' ? 'n/a' : value);
                        } else if (!isNaN(parseInt(value))) {
                          handleRowsChange(parseInt(value));
                        }
                      }}
                      placeholder="Enter number of rows or 'n/a' for dynamic"
                    />
                  )}
                  <Form.Text className="text-muted">
                    {entityType === 'resource' 
                      ? 'Enter desired number of resources'
                      : entityType === 'bridging'
                      ? 'Bridging table rows will be dynamic'
                      : entityType === 'entity' || entityType === 'event'
                      ? 'Entity/Event table rows will be dynamic'
                      : 'Define number of rows here'
                    }
                  </Form.Text>
                </Form.Group>
              </div>
            </div>
          </div>

          {/* Attributes Section */}
          <div className="entity-attributes-section">
            <div className="d-flex justify-content-between align-items-center mb-3">
            </div>
            
            {attributes.length === 0 ? (
              <Alert variant="info">
                No attributes defined. Click "Add Attribute" below to create the first attribute.
              </Alert>
            ) : null}
            
            <AttributeTable
              attributes={attributes}
              onAttributesChange={handleAttributesChange}
              onAddAttribute={handleAddAttribute}
              onDeleteAttribute={handleDeleteAttribute}
              entityType={entityType}
              theme={theme}
              onGeneratorModalChange={setShowGeneratorModal}
            />
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        {entity && (
          <Button 
            variant="outline-danger" 
            onClick={handleDelete} 
            disabled={isLoading}
            className="me-auto"
          >
            <FiTrash2 className="me-2" /> Delete Entity
          </Button>
        )}
        <Button variant="primary" onClick={handleSaveAndClose} disabled={isLoading}>
          Save & Close
        </Button>
      </Modal.Footer>
    </Modal>

    <ConfirmationModal
      show={showDeleteConfirm}
      onHide={() => setShowDeleteConfirm(false)}
      onConfirm={confirmDelete}
      title="Delete Entity"
      message={`Are you sure you want to delete the entity "${name}"? This action cannot be undone.`}
      confirmText="Delete Entity"
      cancelText="Cancel"
      variant="danger"
      theme={theme}
    />

  </>
  );
};
export default EntityEditor;