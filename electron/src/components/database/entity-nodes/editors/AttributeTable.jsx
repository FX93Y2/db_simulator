import React, { useState } from 'react';
import { Form, Button, Modal, Row, Col } from 'react-bootstrap';
import { FiTrash2, FiSettings } from 'react-icons/fi';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import FakerGeneratorEditor from './FakerGeneratorEditor';
import TemplateGeneratorEditor from './TemplateGeneratorEditor';
import DistributionGeneratorEditor from './DistributionGeneratorEditor';
import ForeignKeyGeneratorEditor from './ForeignKeyGeneratorEditor';

const AttributeTable = ({ 
  attributes = [], 
  onAttributesChange, 
  onAddAttribute, 
  onDeleteAttribute,
  entityType = '', 
  theme = 'light',
  onGeneratorModalChange
}) => {
  const [editingIndex, setEditingIndex] = useState(-1);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState(-1);

  // Helper function to check if an attribute is protected (cannot be deleted)
  const isProtectedAttribute = (attribute) => {
    return entityType === 'bridging' && (attribute.name === 'start_date' || attribute.name === 'end_date') ||
           attribute.type === 'event_type' ||
           entityType === 'resource' && attribute.type === 'resource_type';
  };

  // Helper function to check if an attribute is fully protected (cannot be edited at all)
  const isFullyProtectedAttribute = (attribute) => {
    return entityType === 'bridging' && (attribute.name === 'start_date' || attribute.name === 'end_date') ||
           attribute.type === 'event_type';
  };

  // Helper function to get generator display text
  const getGeneratorDisplayText = (attribute) => {
    if (!attribute.generator) return 'No Generator';
    
    switch (attribute.generator.type) {
      case 'faker':
        return `Faker: ${attribute.generator.method || 'name'}`;
      case 'template':
        return `Template: ${attribute.generator.template || '{id}'}`;
      case 'distribution':
        return `Distribution: ${attribute.generator.distribution?.type || 'choice'}`;
      case 'foreign_key':
        return `FK: ${attribute.generator.subtype || 'one_to_many'}`;
      default:
        return 'Custom';
    }
  };

  // Handle drag and drop reordering
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const reorderedAttributes = Array.from(attributes);
    const [reorderedItem] = reorderedAttributes.splice(sourceIndex, 1);
    reorderedAttributes.splice(destinationIndex, 0, reorderedItem);

    onAttributesChange(reorderedAttributes);
  };

  // Handle attribute field changes
  const handleAttributeChange = (index, field, value) => {
    const updatedAttributes = [...attributes];
    const updatedAttribute = { ...updatedAttributes[index], [field]: value };
    
    // Handle generator configuration based on data type
    if (field === 'type') {
      if (!shouldHaveGenerator(value)) {
        delete updatedAttribute.generator;
      } else if (value === 'fk') {
        updatedAttribute.generator = {
          type: 'foreign_key',
          subtype: 'one_to_many'
        };
      } else if (value === 'resource_type') {
        updatedAttribute.generator = {
          type: 'distribution',
          distribution: {
            type: 'choice',
            values: ['Option1', 'Option2'],
            weights: [0.5, 0.5]
          }
        };
      } else {
        updatedAttribute.generator = {
          type: 'faker',
          method: 'name'
        };
      }
    }
    
    updatedAttributes[index] = updatedAttribute;
    onAttributesChange(updatedAttributes);
  };

  // Helper function to check if a type should have a generator
  const shouldHaveGenerator = (type) => {
    const typesWithoutGenerators = ['pk', 'event_id', 'entity_id', 'resource_id', 'event_type', 'date', 'datetime'];
    return !typesWithoutGenerators.includes(type);
  };

  // Open generator configuration modal
  const openGeneratorModal = (index) => {
    setSelectedAttributeIndex(index);
    setShowGeneratorModal(true);
    onGeneratorModalChange?.(true);
  };

  // Close generator configuration modal
  const closeGeneratorModal = () => {
    setShowGeneratorModal(false);
    onGeneratorModalChange?.(false);
  };

  // Handle generator configuration changes
  const handleGeneratorChange = (field, value) => {
    if (selectedAttributeIndex < 0) return;
    
    // Deep clone the attributes array to avoid read-only property errors
    const updatedAttributes = attributes.map(attr => ({
      ...attr,
      generator: attr.generator ? { ...attr.generator } : undefined
    }));
    
    const updatedGenerator = { ...updatedAttributes[selectedAttributeIndex].generator, [field]: value };
    
    // Reset generator fields when type changes
    if (field === 'type') {
      switch (value) {
        case 'faker':
          updatedGenerator.method = 'name';
          delete updatedGenerator.template;
          delete updatedGenerator.distribution;
          delete updatedGenerator.subtype;
          break;
        case 'template':
          updatedGenerator.template = 'Template_{id}';
          delete updatedGenerator.method;
          delete updatedGenerator.distribution;
          delete updatedGenerator.subtype;
          break;
        case 'distribution':
          updatedGenerator.distribution = {
            type: 'choice',
            values: ['Option1', 'Option2'],
            weights: [0.5, 0.5]
          };
          delete updatedGenerator.method;
          delete updatedGenerator.template;
          delete updatedGenerator.subtype;
          break;
        case 'foreign_key':
          updatedGenerator.subtype = 'one_to_many';
          delete updatedGenerator.method;
          delete updatedGenerator.template;
          break;
      }
    }
    
    updatedAttributes[selectedAttributeIndex].generator = updatedGenerator;
    onAttributesChange(updatedAttributes);
  };

  // Handle distribution changes
  const handleDistributionChange = (field, value) => {
    if (selectedAttributeIndex < 0) return;
    
    // Deep clone the attributes array to avoid read-only property errors
    const updatedAttributes = attributes.map(attr => ({
      ...attr,
      generator: attr.generator ? { 
        ...attr.generator,
        distribution: attr.generator.distribution ? { ...attr.generator.distribution } : undefined
      } : undefined
    }));
    
    const updatedDistribution = { ...updatedAttributes[selectedAttributeIndex].generator.distribution, [field]: value };
    const updatedGenerator = { ...updatedAttributes[selectedAttributeIndex].generator, distribution: updatedDistribution };
    updatedAttributes[selectedAttributeIndex].generator = updatedGenerator;
    onAttributesChange(updatedAttributes);
  };

  // Handle choice distribution value/weight pairs
  const handleChoiceValueChange = (field, values) => {
    if (selectedAttributeIndex < 0) return;
    
    // Deep clone the attributes array to avoid read-only property errors
    const updatedAttributes = attributes.map(attr => ({
      ...attr,
      generator: attr.generator ? { 
        ...attr.generator,
        distribution: attr.generator.distribution ? { ...attr.generator.distribution } : undefined
      } : undefined
    }));
    
    const distribution = updatedAttributes[selectedAttributeIndex].generator.distribution;
    const updatedDistribution = { ...distribution, [field]: values };
    updatedAttributes[selectedAttributeIndex].generator = { 
      ...updatedAttributes[selectedAttributeIndex].generator, 
      distribution: updatedDistribution 
    };
    onAttributesChange(updatedAttributes);
  };

  // Add new choice value/weight pair
  const addChoiceValue = (newValues, newWeights) => {
    if (selectedAttributeIndex < 0) return;
    
    // Deep clone the attributes array to avoid read-only property errors
    const updatedAttributes = attributes.map(attr => ({
      ...attr,
      generator: attr.generator ? { 
        ...attr.generator,
        distribution: attr.generator.distribution ? { ...attr.generator.distribution } : undefined
      } : undefined
    }));
    
    const distribution = updatedAttributes[selectedAttributeIndex].generator.distribution;
    const updatedDistribution = {
      ...distribution,
      values: newValues,
      weights: newWeights
    };
    updatedAttributes[selectedAttributeIndex].generator = { 
      ...updatedAttributes[selectedAttributeIndex].generator, 
      distribution: updatedDistribution 
    };
    onAttributesChange(updatedAttributes);
  };

  // Remove choice value/weight pair
  const removeChoiceValue = (newValues, newWeights) => {
    if (selectedAttributeIndex < 0) return;
    
    // Deep clone the attributes array to avoid read-only property errors
    const updatedAttributes = attributes.map(attr => ({
      ...attr,
      generator: attr.generator ? { 
        ...attr.generator,
        distribution: attr.generator.distribution ? { ...attr.generator.distribution } : undefined
      } : undefined
    }));
    
    const distribution = updatedAttributes[selectedAttributeIndex].generator.distribution;
    const updatedDistribution = {
      ...distribution,
      values: newValues,
      weights: newWeights
    };
    updatedAttributes[selectedAttributeIndex].generator = { 
      ...updatedAttributes[selectedAttributeIndex].generator, 
      distribution: updatedDistribution 
    };
    onAttributesChange(updatedAttributes);
  };

  // Render generator configuration fields in modal
  const renderGeneratorFields = () => {
    if (selectedAttributeIndex < 0) return null;
    
    const generator = attributes[selectedAttributeIndex].generator || {};
    
    switch (generator.type) {
      case 'faker':
        return (
          <FakerGeneratorEditor
            generator={generator}
            onGeneratorChange={handleGeneratorChange}
          />
        );
        
      case 'template':
        return (
          <TemplateGeneratorEditor
            generator={generator}
            onGeneratorChange={handleGeneratorChange}
          />
        );
        
      case 'distribution':
        return (
          <DistributionGeneratorEditor
            generator={generator}
            onDistributionChange={handleDistributionChange}
            onChoiceValueChange={handleChoiceValueChange}
            onAddChoiceValue={addChoiceValue}
            onRemoveChoiceValue={removeChoiceValue}
          />
        );
        
      case 'foreign_key':
        return (
          <ForeignKeyGeneratorEditor
            generator={generator}
            onGeneratorChange={handleGeneratorChange}
            onDistributionChange={handleDistributionChange}
            onChoiceValueChange={handleChoiceValueChange}
            onAddChoiceValue={addChoiceValue}
            onRemoveChoiceValue={removeChoiceValue}
          />
        );
        
      default:
        return null;
    }
  };

  const selectedAttribute = selectedAttributeIndex >= 0 ? attributes[selectedAttributeIndex] : null;

  return (
    <>
      <div className="data-table-container">
        <div className="data-grid-container data-grid-5-col">
          {/* Header Row */}
          <div className="data-grid-header">
            <div className="grid-header-cell"></div>
            <div className="grid-header-cell">Field Name</div>
            <div className="grid-header-cell">Type</div>
            <div className="grid-header-cell">Options</div>
            <div className="grid-header-cell"></div>
          </div>
          
          {/* Data Rows */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="attribute-grid-body" type="ATTRIBUTE">
              {(provided) => (
                <div className="data-grid-body" {...provided.droppableProps} ref={provided.innerRef}>
                  {attributes.map((attribute, index) => (
                    <Draggable
                      key={`${attribute.name}-${index}`}
                      draggableId={`attribute-${index}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`data-grid-row ${
                            snapshot.isDragging ? 'dragging' : ''
                          } ${
                            isProtectedAttribute(attribute) ? 'protected-attribute' : ''
                          }`}
                        >
                          <div className="grid-cell">
                            <div
                              className="drag-handle-table"
                              {...provided.dragHandleProps}
                              title="Drag to reorder"
                            >
                            </div>
                          </div>
                          <div className="grid-cell">
                            {editingIndex === index ? (
                              <Form.Control
                                type="text"
                                value={attribute.name}
                                onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                                onBlur={() => setEditingIndex(-1)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') setEditingIndex(-1);
                                }}
                                autoFocus
                                size="sm"
                              />
                            ) : (
                              <span
                                className={`attribute-name-cell ${isFullyProtectedAttribute(attribute) ? 'protected' : 'editable'}`}
                                onClick={() => !isFullyProtectedAttribute(attribute) && setEditingIndex(index)}
                              >
                                {attribute.name}
                              </span>
                            )}
                          </div>
                          <div className="grid-cell">
                            {isFullyProtectedAttribute(attribute) ? (
                              <span className="text-muted">
                                {attribute.type === 'event_type' ? 'Event Type' : 'DateTime'}
                              </span>
                            ) : (
                              <Form.Select
                                size="sm"
                                value={attribute.type}
                                onChange={(e) => handleAttributeChange(index, 'type', e.target.value)}
                              >
                                <option value="string">String</option>
                                <option value="integer">Integer</option>
                                <option value="float">Float</option>
                                <option value="boolean">Boolean</option>
                                <option value="pk">Primary Key</option>
                                <option value="fk">Foreign Key</option>
                                <option value="event_id">Event ID (FK)</option>
                                <option value="entity_id">Entity ID (FK)</option>
                                <option value="resource_id">Resource ID (FK)</option>
                                <option value="event_type">Event Type</option>
                                <option value="resource_type">Resource Type</option>
                              </Form.Select>
                            )}
                          </div>
                          <div className="grid-cell">
                            <div className="options-cell">
                              {shouldHaveGenerator(attribute.type) && attribute.generator && (
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  className="me-1"
                                  onClick={() => openGeneratorModal(index)}
                                  title="Configure data generator"
                                >
                                  <FiSettings className="me-1" />
                                  {getGeneratorDisplayText(attribute)}
                                </Button>
                              )}
                              {(attribute.type === 'fk' || attribute.type === 'event_id' ||
                                attribute.type === 'entity_id' || attribute.type === 'resource_id') && (
                                <Form.Control
                                  type="text"
                                  size="sm"
                                  value={attribute.ref || ''}
                                  onChange={(e) => handleAttributeChange(index, 'ref', e.target.value)}
                                  placeholder="Table.column"
                                  title="Reference to another entity's attribute"
                                  style={{ display: 'inline-block', width: 'auto', minWidth: '120px' }}
                                />
                              )}
                              {isProtectedAttribute(attribute) && (
                                <small className="text-muted">Auto-generated</small>
                              )}
                            </div>
                          </div>
                          <div className="grid-cell">
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => onDeleteAttribute(index)}
                              disabled={isProtectedAttribute(attribute)}
                              title={
                                isProtectedAttribute(attribute)
                                  ? "Protected columns cannot be deleted"
                                  : "Delete attribute"
                              }
                            >
                              <FiTrash2 />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <div className="mt-3">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={onAddAttribute}
            className="add-attribute-btn"
          >
            + Add Attribute
          </Button>
        </div>
      </div>

      {/* Generator Configuration Modal */}
      <Modal
        show={showGeneratorModal}
        onHide={closeGeneratorModal}
        centered
        className="generator-config-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Configure Data Generator: {selectedAttribute?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAttribute && shouldHaveGenerator(selectedAttribute.type) && (
            <Form>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Generator Type</Form.Label>
                    <Form.Select
                      value={selectedAttribute.generator?.type || 'faker'}
                      onChange={(e) => handleGeneratorChange('type', e.target.value)}
                      disabled={selectedAttribute.type === 'fk' || selectedAttribute.type === 'resource_type'}
                    >
                      <option value="faker">Faker</option>
                      <option value="template">Template</option>
                      <option value="distribution">Distribution</option>
                      <option value="foreign_key">Foreign Key</option>
                    </Form.Select>
                    {(selectedAttribute.type === 'fk' || selectedAttribute.type === 'resource_type') && (
                      <Form.Text className="text-muted">
                        Generator type is automatically set for this data type.
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <div className="generator-fields">
                    {renderGeneratorFields()}
                  </div>
                </Col>
              </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={closeGeneratorModal}>
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AttributeTable;