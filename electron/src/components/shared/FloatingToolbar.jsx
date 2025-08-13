import React from 'react';
import { Button, Dropdown } from 'react-bootstrap';

/**
 * Extensible floating vertical toolbar for canvas editors
 * Positioned on the left side of the canvas with configurable actions
 */
const FloatingToolbar = ({ 
  items = [], 
  className = '', 
  position = 'left',
  theme = 'light' 
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  const renderToolbarItem = (item, index) => {
    const { type, icon, label, onClick, disabled, variant = 'primary', children, tooltip, dropDirection = 'down' } = item;

    // Base button props
    const buttonProps = {
      key: index,
      className: `floating-toolbar__item floating-toolbar__item--${variant}`,
      disabled: disabled,
      title: tooltip || label,
      size: 'sm'
    };

    switch (type) {
      case 'button':
        return (
          <Button {...buttonProps} onClick={onClick}>
            {icon && <span className="floating-toolbar__icon">{icon}</span>}
            {label && <span className="floating-toolbar__label">{label}</span>}
          </Button>
        );

      case 'dropdown':
        return (
          <Dropdown 
            key={index} 
            className="floating-toolbar__dropdown"
            drop={dropDirection}
          >
            <Dropdown.Toggle 
              {...buttonProps}
              id={`floating-toolbar-dropdown-${index}`}
            >
              {icon && <span className="floating-toolbar__icon">{icon}</span>}
              {label && <span className="floating-toolbar__label">{label}</span>}
            </Dropdown.Toggle>
            
            <Dropdown.Menu>
              {children && children.map((child, childIndex) => (
                <Dropdown.Item
                  key={childIndex}
                  onClick={child.onClick}
                  disabled={child.disabled}
                >
                  {child.icon && <span className="me-2">{child.icon}</span>}
                  {child.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        );

      case 'separator':
        return (
          <div key={index} className="floating-toolbar__separator" />
        );

      default:
        console.warn(`Unknown toolbar item type: ${type}`);
        return null;
    }
  };

  return (
    <div 
      className={`floating-toolbar floating-toolbar--${position} ${className}`}
      data-theme={theme}
    >
      <div className="floating-toolbar__container">
        {items.map((item, index) => renderToolbarItem(item, index))}
      </div>
    </div>
  );
};

export default FloatingToolbar;