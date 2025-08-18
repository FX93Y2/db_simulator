import React, { useRef, useEffect } from 'react';
import { ReactComponent as CircleSVG } from '../../assets/svg/circle.svg';
import { ReactComponent as RectangleSVG } from '../../assets/svg/rectangle.svg';
import { ReactComponent as DiamondSVG } from '../../assets/svg/diamond.svg';
import { ReactComponent as PentagonSVG } from '../../assets/svg/pentagon.svg';

/**
 * Draggable module button component
 */
const DraggableModuleButton = React.memo(({ module, disabled, onModuleAdd }) => {
  const buttonRef = useRef(null);
  const IconComponent = module.icon;
  
  useEffect(() => {
    const button = buttonRef.current;
    if (!button || disabled) return;
    
    const handleDragStart = (e) => {
      console.log('🎯 Native dragStart for:', module.type);
      e.stopPropagation();
      
      // Set drag data
      const dragData = {
        type: module.type,
        label: module.label
      };
      e.dataTransfer.setData('application/reactflow', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
      
      // Create a simple drag preview
      const dragImage = button.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.opacity = '0.5';
      dragImage.style.transform = 'scale(1.2)';
      document.body.appendChild(dragImage);
      
      e.dataTransfer.setDragImage(dragImage, 40, 40);
      
      // Clean up after drag starts
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      }, 100);
    };
    
    const handleDragEnd = () => {
      console.log('🏁 Native dragEnd for:', module.type);
    };
    
    button.setAttribute('draggable', 'true');
    button.addEventListener('dragstart', handleDragStart);
    button.addEventListener('dragend', handleDragEnd);
    
    return () => {
      button.removeEventListener('dragstart', handleDragStart);
      button.removeEventListener('dragend', handleDragEnd);
    };
  }, [module.type, module.label, disabled]);
  
  const handleClick = () => {
    console.log('🖱️ Module clicked:', module.type);
    if (!disabled && onModuleAdd) {
      onModuleAdd(module.type);
    }
  };
  
  return (
    <button
      ref={buttonRef}
      className={`module-sidebar__button ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
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
});

DraggableModuleButton.displayName = 'DraggableModuleButton';

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
  console.log('🔧 ModuleSidebar: Component rendered', {
    isVisible,
    theme,
    disabled
  });
  
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

  return (
    <div className={`module-sidebar ${isVisible ? 'module-sidebar--visible' : ''} module-sidebar--${theme}`}>
      <div className="module-sidebar__content">
        <div className="module-sidebar__section">
          <h3 className="module-sidebar__section-title">Discrete Event</h3>
          <div className="module-sidebar__grid">
            {modules.map((module) => (
              <DraggableModuleButton
                key={module.type}
                module={module}
                disabled={disabled}
                onModuleAdd={onModuleAdd}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Use React.memo to prevent re-renders during drag
export default React.memo(ModuleSidebar, (prevProps, nextProps) => {
  // Only re-render if these props actually change
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.theme === nextProps.theme &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.onModuleAdd === nextProps.onModuleAdd
  );
});