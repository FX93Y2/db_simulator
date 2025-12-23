import React, { useState, useRef, useEffect } from 'react';
import { Form, Dropdown, Button } from 'react-bootstrap';
import { FiEdit3, FiChevronDown, FiCheck, FiX } from 'react-icons/fi';

const TypeSelector = ({
  value = 'string',
  onChange,
  size = 'sm',
  disabled = false,
  className = '',
  placeholder = 'Select type'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Comprehensive type definitions
  const typeCategories = {
    'Basic Types': {
      string: { display: 'String', template: 'string' },
      integer: { display: 'Integer', template: 'integer' },
      float: { display: 'Float', template: 'float' },
      boolean: { display: 'Boolean', template: 'boolean' },
      date: { display: 'Date', template: 'date' },
      datetime: { display: 'DateTime', template: 'datetime' },
      text: { display: 'Text', template: 'text' }
    },
    'Parameterized Types': {
      decimal: { display: 'Decimal', template: 'decimal(10,2)' },
      numeric: { display: 'Numeric', template: 'numeric(10,2)' },
      varchar: { display: 'Varchar', template: 'varchar(255)' },
      char: { display: 'Char', template: 'char(1)' }
    },
    'System Types': {
      pk: { display: 'Primary Key', template: 'pk' },
      fk: { display: 'Foreign Key', template: 'fk' },
      entity_id: { display: 'Entity ID (FK)', template: 'entity_id' },
      resource_id: { display: 'Resource ID (FK)', template: 'resource_id' },
      event_type: { display: 'Event Type', template: 'event_type' },
      resource_type: { display: 'Resource Type', template: 'resource_type' }
    }
  };

  // Get all types as flat list for quick access
  const allTypes = Object.values(typeCategories).reduce((acc, category) => ({ ...acc, ...category }), {});

  // Check if the current value is a parameterized type
  const isParameterizedValue = (typeValue) => {
    return typeValue && typeValue.includes('(') && typeValue.includes(')');
  };

  // Get base type from parameterized type (e.g., 'decimal(10,2)' -> 'decimal')
  const getBaseType = (typeValue) => {
    if (isParameterizedValue(typeValue)) {
      return typeValue.split('(')[0];
    }
    return typeValue;
  };

  // Update edit value when prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Calculate dropdown position for fixed positioning
  const calculateDropdownPosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 2,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  // Handle direct type selection from dropdown
  const handleTypeSelect = (typeKey) => {
    const typeInfo = allTypes[typeKey];
    if (!typeInfo) return;

    setDropdownOpen(false);

    // For parameterized types, start editing mode
    if (isParameterizedValue(typeInfo.template)) {
      setEditValue(typeInfo.template);
      setIsEditing(true);
      // Focus input after state updates
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    } else {
      // For simple types, apply directly
      onChange(typeInfo.template);
    }
  };

  // Handle edit button click
  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditValue(value);
    setIsEditing(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  };

  // Handle text input change
  const handleInputChange = (e) => {
    setEditValue(e.target.value);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  // Handle key events in edit mode
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Get display text for current value
  const getDisplayText = () => {
    if (!value) return placeholder;

    // Check if it matches a known template exactly
    for (const [key, typeInfo] of Object.entries(allTypes)) {
      if (typeInfo.template === value) {
        return typeInfo.display;
      }
    }

    // For custom parameterized types, show the value as-is
    if (isParameterizedValue(value)) {
      return value;
    }

    // For unknown types, show the value
    return value;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  if (disabled) {
    return (
      <Form.Control
        type="text"
        value={getDisplayText()}
        readOnly
        size={size}
        className={`form-control-readonly ${className}`}
      />
    );
  }

  // Inline editing mode with integrated design
  if (isEditing) {
    return (
      <div className={`type-selector type-selector-editing ${className}`}>
        <div className={`type-selector-input ${size === 'sm' ? 'type-selector-input-sm' : ''}`}>
          {/* Input field taking most space */}
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="type-selector-edit-field"
            placeholder="Enter type (e.g., decimal(10,2))"
          />

          {/* Save button */}
          <button
            type="button"
            className="type-selector-icon-btn type-selector-save-icon"
            onClick={handleSaveEdit}
            title="Save type (Enter)"
          >
            <FiCheck size={12} />
          </button>

          {/* Cancel button */}
          <button
            type="button"
            className="type-selector-icon-btn type-selector-cancel-icon"
            onClick={handleCancelEdit}
            title="Cancel edit (Escape)"
          >
            <FiX size={12} />
          </button>
        </div>
      </div>
    );
  }

  // Display mode with integrated design
  return (
    <div className={`type-selector ${className}`} ref={dropdownRef}>
      <div className={`type-selector-input ${size === 'sm' ? 'type-selector-input-sm' : ''}`}>
        {/* Edit icon button */}
        <button
          type="button"
          className="type-selector-icon-btn type-selector-edit-icon"
          onClick={handleEditClick}
          title="Edit type manually"
        >
          <FiEdit3 size={10} />
        </button>

        {/* Type display text */}
        <span className="type-selector-value">{getDisplayText()}</span>

        {/* Dropdown toggle icon */}
        <button
          type="button"
          className="type-selector-icon-btn type-selector-dropdown-icon"
          onClick={() => {
            if (!dropdownOpen) {
              calculateDropdownPosition();
            }
            setDropdownOpen(!dropdownOpen);
          }}
          title="Select from templates"
        >
          <FiChevronDown
            size={10}
            className={`chevron ${dropdownOpen ? 'chevron-up' : ''}`}
          />
        </button>
      </div>

      {/* Dropdown menu (positioned with fixed positioning to escape modal) */}
      {dropdownOpen && (
        <div
          className="type-selector-menu"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
        >
          {Object.entries(typeCategories).map(([categoryName, types]) => (
            <React.Fragment key={categoryName}>
              <div className="dropdown-header">{categoryName}</div>
              {Object.entries(types).map(([typeKey, typeInfo]) => (
                <button
                  key={typeKey}
                  type="button"
                  className={`dropdown-item ${getBaseType(value) === typeKey ? 'active' : ''}`}
                  onClick={() => handleTypeSelect(typeKey)}
                >
                  {typeInfo.display}
                  {isParameterizedValue(typeInfo.template) && (
                    <span className="text-muted ms-1">
                      ({typeInfo.template.split('(')[1].replace(')', '')})
                    </span>
                  )}
                </button>
              ))}
              {categoryName !== 'System Types' && <div className="dropdown-divider" />}
            </React.Fragment>
          ))}

          <div className="dropdown-divider" />
          <button
            type="button"
            className="dropdown-item text-primary"
            onClick={handleEditClick}
          >
            <FiEdit3 className="me-1" />
            Custom Type...
          </button>
        </div>
      )}
    </div>
  );
};

export default TypeSelector;
