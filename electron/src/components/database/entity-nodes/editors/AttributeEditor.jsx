import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col } from 'react-bootstrap';
import { FiTrash2, FiMove } from 'react-icons/fi';
import FakerGeneratorEditor from './FakerGeneratorEditor';
import TemplateGeneratorEditor from './TemplateGeneratorEditor';
import DistributionGeneratorEditor from './DistributionGeneratorEditor';
import ForeignKeyGeneratorEditor from './ForeignKeyGeneratorEditor';
import FormulaGeneratorEditor from './FormulaGeneratorEditor';

const AttributeEditor = ({ 
  attribute, 
  onAttributeChange, 
  onAttributeDelete, 
  availableEntities = [], 
  entityType = '', 
  theme = 'light',
  dragHandleProps = null,
  isDragging = false 
}) => {
  const [localAttribute, setLocalAttribute] = useState({
    name: '',
    type: 'string',
    generator: {
      type: 'faker',
      method: 'name'
    },
    ...attribute
  });

  // Helper function to check if a type should have a generator
  const shouldHaveGenerator = (type) => {
    // Only exclude system-managed fields that are auto-generated
    const typesWithoutGenerators = ['pk', 'event_id', 'entity_id', 'resource_id', 'inventory_id', 'event_type'];
    return !typesWithoutGenerators.includes(type);
  };

  // Helper function to check if an attribute is a protected auto-generated date column
  const isProtectedDateColumn = (attributeName) => {
    return (entityType === 'bridging' && (attributeName === 'start_date' || attributeName === 'end_date')) ||
           (entityType === 'entity' && attributeName === 'created_at');
  };

  const isEventTypeColumn = localAttribute.type === 'event_type';


  // Update local state when attribute prop changes
  useEffect(() => {
    setLocalAttribute({
      name: '',
      type: 'string',
      generator: {
        type: 'faker',
        method: 'name'
      },
      ...attribute
    });
  }, [attribute]);

  // Handle changes and propagate to parent
  const handleChange = (field, value) => {
    const updatedAttribute = { ...localAttribute, [field]: value };
    
    // Handle generator configuration based on data type
    if (field === 'type') {
      if (!shouldHaveGenerator(value)) {
        // Remove generator for types that shouldn't have one
        delete updatedAttribute.generator;
      } else if (value === 'fk') {
        // Foreign keys need foreign_key generator
        updatedAttribute.generator = {
          type: 'foreign_key',
          subtype: 'one_to_many'
        };
      } else if (value === 'resource_type') {
        // Resource types need distribution generator
        updatedAttribute.generator = {
          type: 'distribution',
          formula: 'DISC(0.5, "Type1", 0.5, "Type2")'
        };
      } else {
        // Other data types get faker generator by default
        updatedAttribute.generator = {
          type: 'faker',
          method: 'name'
        };
      }
    }
    
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };

  // Handle generator changes
  const handleGeneratorChange = (field, value) => {
    const updatedGenerator = { ...localAttribute.generator, [field]: value };
    
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
          // Preserve existing formula or set default
          updatedGenerator.formula = updatedGenerator.formula;
          delete updatedGenerator.method;
          delete updatedGenerator.template;
          delete updatedGenerator.subtype;
          delete updatedGenerator.distribution; // Remove old format if exists
          break;
        case 'foreign_key':
          updatedGenerator.subtype = 'one_to_many';
          delete updatedGenerator.method;
          delete updatedGenerator.template;
          break;
        case 'formula':
          updatedGenerator.expression = updatedGenerator.expression || 'MIN(SELECT created_at FROM RelatedTable WHERE foreign_id = @id)';
          delete updatedGenerator.method;
          delete updatedGenerator.template;
          delete updatedGenerator.formula;
          delete updatedGenerator.subtype;
          break;
        default:
          break;
      }
    }
    
    const updatedAttribute = { ...localAttribute, generator: updatedGenerator };
    setLocalAttribute(updatedAttribute);
    onAttributeChange(updatedAttribute);
  };


  // Render generator-specific fields
  const renderGeneratorFields = () => {
    const generator = localAttribute.generator || {};
    
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
            onFormulaChange={(formula) => handleGeneratorChange('formula', formula)}
          />
        );
        
      case 'foreign_key':
        return (
          <ForeignKeyGeneratorEditor
            generator={generator}
            onGeneratorChange={handleGeneratorChange}
          />
        );
        
      case 'formula':
        return (
          <FormulaGeneratorEditor
            generator={generator}
            onExpressionChange={(expression) => handleGeneratorChange('expression', expression)}
          />
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className={`mb-3 attribute-editor-card ${isDragging ? 'dragging' : ''}`}>
      <Card.Header className="attribute-header">
        <div className="attribute-header-left">
          <div 
            className="drag-handle"
            {...dragHandleProps}
            title="Drag to reorder attribute"
          >
            <FiMove />
          </div>
          <span className="attribute-name">
            {localAttribute.name || 'New Attribute'}
          </span>
        </div>
        <Button
          variant="outline-danger"
          size="sm"
          onClick={onAttributeDelete}
          disabled={isProtectedDateColumn(localAttribute.name) || isEventTypeColumn}
          title={
            isProtectedDateColumn(localAttribute.name)
              ? "Auto-generated columns cannot be deleted"
              : isEventTypeColumn
              ? "This column is automatically managed for Event entities"
              : "Delete attribute"
          }
        >
          <FiTrash2 />
        </Button>
      </Card.Header>
      <Card.Body>
        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Attribute Name</Form.Label>
              <Form.Control
                type="text"
                value={localAttribute.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter attribute name"
                readOnly={isProtectedDateColumn(localAttribute.name)}
                className={isProtectedDateColumn(localAttribute.name) ? 'form-control-readonly' : ''}
              />
              {isProtectedDateColumn(localAttribute.name) && (
                <Form.Text className="text-muted">
                </Form.Text>
              )}
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Data Type</Form.Label>
              {isProtectedDateColumn(localAttribute.name) || isEventTypeColumn ? (
                <Form.Control
                  type="text"
                  value={isEventTypeColumn ? 'Event Type' : 'DateTime'}
                  readOnly
                  className="form-control-readonly"
                />
              ) : (
                <Form.Select
                  value={localAttribute.type}
                  onChange={(e) => handleChange('type', e.target.value)}
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
              {isProtectedDateColumn(localAttribute.name) && (
                <Form.Text className="text-muted">
                </Form.Text>
              )}
            </Form.Group>
          </Col>
        </Row>
        
        {/* Generator Configuration */}
        {shouldHaveGenerator(localAttribute.type) && (
          <div className="generator-section">
            <h6 className="section-title">Data Generator Configuration</h6>
            
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Generator Type</Form.Label>
                  <Form.Select
                    value={localAttribute.generator?.type || 'faker'}
                    onChange={(e) => handleGeneratorChange('type', e.target.value)}
                    disabled={localAttribute.type === 'fk' || localAttribute.type === 'resource_type'}
                  >
                    <option value="faker">Faker</option>
                    <option value="template">Template</option>
                    <option value="distribution">Distribution</option>
                    {localAttribute.type === 'fk' && (
                      <option value="foreign_key">Foreign Key</option>
                    )}
                    <option value="formula">Formula</option>
                  </Form.Select>
                  {(localAttribute.type === 'fk' || localAttribute.type === 'resource_type') && (
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
          </div>
        )}
        
        {/* Reference field for foreign keys */}
        {(localAttribute.type === 'fk' || localAttribute.type === 'event_id' ||
          localAttribute.type === 'entity_id' || localAttribute.type === 'resource_id' || localAttribute.type === 'inventory_id') && (
          <div className="reference-section">
            <h6 className="section-title">Reference Configuration</h6>
            <Form.Group>
              <Form.Label>Reference</Form.Label>
              <Form.Control
                type="text"
                value={localAttribute.ref || ''}
                onChange={(e) => handleChange('ref', e.target.value)}
              />
              <Form.Text className="text-muted">
                Reference to another entity's attribute (EntityName.attributeName)
              </Form.Text>
            </Form.Group>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default AttributeEditor;