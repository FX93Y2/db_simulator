import React from 'react';
import { ReactComponent as CircleSVG } from '../../assets/svg/circle.svg';
import { ReactComponent as RectangleSVG } from '../../assets/svg/rectangle.svg';
import { ReactComponent as DiamondSVG } from '../../assets/svg/diamond.svg';
import { ReactComponent as PentagonSVG } from '../../assets/svg/pentagon.svg';

/**
 * Module selection sidebar that slides down from the toolbar
 * Displays discrete event simulation modules with their actual SVG shapes
 */
const ModuleSidebar = ({ 
  isVisible, 
  onModuleAdd, 
  theme = 'light',
  disabled = false 
}) => {
  const modules = [
    {
      type: 'create',
      label: 'Create',
      description: 'Generate entities',
      icon: CircleSVG,
      iconType: 'plus'
    },
    {
      type: 'event',
      label: 'Process',
      description: 'Event processing',
      icon: RectangleSVG,
      iconType: 'shape'
    },
    {
      type: 'decide',
      label: 'Decide',
      description: 'Decision point',
      icon: DiamondSVG,
      iconType: 'shape'
    },
    {
      type: 'assign',
      label: 'Assign',
      description: 'Set attributes',
      icon: PentagonSVG,
      iconType: 'shape'
    },
    {
      type: 'release',
      label: 'Release',
      description: 'Dispose entities',
      icon: CircleSVG,
      iconType: 'minus'
    }
  ];

  const handleModuleClick = (moduleType) => {
    if (!disabled && onModuleAdd) {
      onModuleAdd(moduleType);
    }
  };

  const renderModuleButton = (module) => {
    const IconComponent = module.icon;
    
    return (
      <button
        key={module.type}
        className={`module-sidebar__button ${disabled ? 'disabled' : ''}`}
        onClick={() => handleModuleClick(module.type)}
        disabled={disabled}
        title={`${module.label} - ${module.description}`}
      >
        <div className="module-sidebar__icon">
          <IconComponent className="module-sidebar__svg" />
          {module.iconType === 'plus' && (
            <div className="module-sidebar__overlay">
              <span className="module-sidebar__symbol">+</span>
            </div>
          )}
          {module.iconType === 'minus' && (
            <div className="module-sidebar__overlay">
              <span className="module-sidebar__symbol">−</span>
            </div>
          )}
        </div>
        <div className="module-sidebar__label">
          {module.label}
        </div>
      </button>
    );
  };

  return (
    <div className={`module-sidebar ${isVisible ? 'module-sidebar--visible' : ''} module-sidebar--${theme}`}>
      <div className="module-sidebar__content">
        <div className="module-sidebar__section">
          <h3 className="module-sidebar__section-title">Discrete Event</h3>
          <div className="module-sidebar__grid">
            {modules.map(renderModuleButton)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleSidebar;