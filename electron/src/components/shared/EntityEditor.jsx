import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { FiTrash2, FiEdit, FiPlus } from 'react-icons/fi';
import AttributeEditor from './AttributeEditor';
import ConfirmationModal from './ConfirmationModal';

const EntityEditor = ({ show, onHide, entity, onEntityUpdate, onEntityDelete, theme }) => {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [rows, setRows] = useState(100);
  const [attributes, setAttributes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [lastEntityName, setLastEntityName] = useState(null);

  // Initialize form when entity changes
  useEffect(() => {
    // Only reset form data when entity actually changes (new entity opened), not during auto-updates
    if (entity && (!lastEntityName || entity.name !== lastEntityName)) {
      setLastEntityName(entity.name);
      setIsUserEditing(false);
      setName(entity.name || '');
      setEntityType(entity.type || '');
      setRows(entity.rows || 100);
      setAttributes(entity.attributes || []);
      setValidationErrors([]);
    } else if (!entity && lastEntityName !== null) {
      // Reset form for new entity only if coming from an existing entity
      setLastEntityName(null);
      setIsUserEditing(false);
      setName('');
      setEntityType('');
      setRows(100);
      setAttributes([{
        name: 'id',
        type: 'pk'
      }]);
      setValidationErrors([]);
    }
  }, [entity, lastEntityName]);

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
    setIsUserEditing(true);
    const newAttributes = [...attributes];
    newAttributes[index] = updatedAttribute;
    setAttributes(newAttributes);
  };

  // Add new attribute
  const handleAddAttribute = () => {
    setIsUserEditing(true);
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
    setIsUserEditing(true);
    const newAttributes = attributes.filter((_, i) => i !== index);
    setAttributes(newAttributes);
  };

  // Auto-update entity with debouncing
  useEffect(() => {
    if (!name.trim() || attributes.length === 0 || !isUserEditing) {
      return; // Don't update if basic validation fails or user is not actively editing
    }

    const timeoutId = setTimeout(() => {
      if (validateEntity()) {
        const updatedEntity = {
          name: name.trim(),
          type: entityType || undefined,
          rows: entityType === 'resource' ? (typeof rows === 'number' ? rows : parseInt(rows) || 100) : rows,
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
                 attr.type === 'entity_id' || attr.type === 'resource_id') && attr.ref) {
              cleanedAttr.ref = attr.ref;
            }
            
            return cleanedAttr;
          })
        };
        
        onEntityUpdate(updatedEntity);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [name, entityType, rows, attributes, onEntityUpdate, isUserEditing]);

  // Helper functions to handle form changes and mark as user editing
  const handleNameChange = (newName) => {
    setIsUserEditing(true);
    setName(newName);
  };

  const handleEntityTypeChange = (newType) => {
    setIsUserEditing(true);
    setEntityType(newType);
  };

  const handleRowsChange = (newRows) => {
    setIsUserEditing(true);
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
      console.error('Error deleting entity:', error);
      setIsLoading(false);
    }
  };

  return (
    <>
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      className="entity-editor-modal"
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
            <h5 className="mb-3">Entity Information</h5>
            
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
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Specify the role of this entity in simulations
                      </Form.Text>
                    </Form.Group>
                  </div>
                </div>
              </div>
              
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Number of Rows</Form.Label>
                  {entityType === 'entity' || entityType === 'event' ? (
                    <Form.Select
                      value={rows}
                      onChange={(e) => handleRowsChange(e.target.value)}
                    >
                      <option value="n/a">n/a (Dynamic)</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </Form.Select>
                  ) : (
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
                  )}
                  <Form.Text className="text-muted">
                    {entityType === 'resource' 
                      ? 'Resource tables must have a fixed number of rows'
                      : 'Entity/Event tables can be dynamic (n/a) or fixed'
                    }
                  </Form.Text>
                </Form.Group>
              </div>
            </div>
          </div>

          {/* Attributes Section */}
          <div className="entity-attributes-section">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Attributes</h5>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleAddAttribute}
              >
                <FiPlus className="me-1" /> Add Attribute
              </Button>
            </div>
            
            {attributes.length === 0 ? (
              <Alert variant="info">
                No attributes defined. Click "Add Attribute" to create the first attribute.
              </Alert>
            ) : (
              <div className="attributes-list">
                {attributes.map((attribute, index) => (
                  <AttributeEditor
                    key={index}
                    attribute={attribute}
                    onAttributeChange={(updatedAttribute) => handleAttributeChange(index, updatedAttribute)}
                    onAttributeDelete={() => handleDeleteAttribute(index)}
                  />
                ))}
              </div>
            )}
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
        <Button variant="secondary" onClick={onHide} disabled={isLoading}>
          Close
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