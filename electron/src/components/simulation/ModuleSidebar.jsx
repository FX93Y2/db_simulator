import React, { useRef, useEffect } from 'react';
import { ReactComponent as CircleSVG } from '../../assets/svg/circle.svg';
import { ReactComponent as RectangleSVG } from '../../assets/svg/rectangle.svg';
import { ReactComponent as DiamondSVG } from '../../assets/svg/diamond.svg';
import { ReactComponent as PentagonSVG } from '../../assets/svg/pentagon.svg';

/**
 * Get node dimensions based on module type (matching FlowNodeComponents)
 */
const getNodeDimensions = (moduleType) => {
  switch (moduleType) {
    case 'create':
    case 'release':
      return { width: 80, height: 80 }; // matches canvas node size
    case 'event':
      return { width: 130, height: 90 }; // matches canvas node size  
    case 'decide':
      return { width: 110, height: 80 }; // matches SVG viewBox and canvas
    case 'assign':
      return { width: 120, height: 80 }; // matches canvas node size
    default:
      return { width: 80, height: 80 };
  }
};

/**
 * Create SVG drag preview matching canvas node appearance using exact imported SVG paths
 */
const createSVGDragPreview = (module, theme, canvasZoom) => {
  const { width, height } = getNodeDimensions(module.type);
  const scaledWidth = width * canvasZoom;
  const scaledHeight = height * canvasZoom;
  
  // Theme colors matching canvas nodes
  const fillColor = theme === 'dark' ? '#2d3748' : '#ffffff';
  const strokeColor = theme === 'dark' ? '#ffffff' : '#000000';
  
  const container = document.createElement('div');
  container.className = 'drag-preview-node';
  container.style.position = 'absolute';
  container.style.top = '-2000px';
  container.style.left = '-2000px';
  container.style.width = `${scaledWidth}px`;
  container.style.height = `${scaledHeight}px`;
  container.style.opacity = '0.8';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  
  let svgContent = '';
  
  switch (module.type) {
    case 'create':
      // Exact ellipse from circle.svg
      svgContent = `
        <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="-0.5 -0.5 81 81">
          <ellipse cx="40" cy="40" rx="40" ry="40" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>
          <text x="40" y="45" text-anchor="middle" dominant-baseline="middle" fill="${strokeColor}" font-size="24" font-weight="bold">+</text>
        </svg>
      `;
      break;
    case 'release':
      // Exact ellipse from circle.svg  
      svgContent = `
        <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="-0.5 -0.5 81 81">
          <ellipse cx="40" cy="40" rx="40" ry="40" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>
          <text x="40" y="45" text-anchor="middle" dominant-baseline="middle" fill="${strokeColor}" font-size="24" font-weight="bold">−</text>
        </svg>
      `;
      break;
    case 'event':
      // Exact rounded rectangle with drop shadow from rectangle.svg
      svgContent = `
        <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="-0.5 -0.5 131 92">
          <g style="filter: drop-shadow(2px 3px 2px rgba(0, 0, 0, 0.25));">
            <rect x="4" y="4" width="120" height="80" rx="8" ry="8" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>
          </g>
        </svg>
      `;
      break;
    case 'decide':
      // Exact curved diamond path from diamond.svg
      svgContent = `
        <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="-0.5 -0.5 111 81">
          <path d="M 27.5 20 L 46.91 5.88 Q 55 0 63.09 5.88 L 101.91 34.12 Q 110 40 101.91 45.88 L 63.09 74.12 Q 55 80 46.91 74.12 L 8.09 45.88 Q 0 40 8.09 34.12 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>
        </svg>
      `;
      break;
    case 'assign':
      // Exact pentagon shape with rotation from pentagon.svg
      svgContent = `
        <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="-0.5 -0.5 121 81">
          <path d="M 20 20 L 20 -10 Q 20 -20 30 -20 L 90 -20 Q 100 -20 100 -10 L 100 50 Q 100 60 92.93 67.07 L 67.07 92.93 Q 60 100 52.93 92.93 L 27.07 67.07 Q 20 60 20 50 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1" transform="rotate(270,60,40)"/>
        </svg>
      `;
      break;
    default:
      svgContent = `
        <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="-0.5 -0.5 81 81">
          <rect x="4" y="4" width="72" height="72" rx="4" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>
        </svg>
      `;
  }
  
  container.innerHTML = svgContent;
  return container;
};

/**
 * Draggable module button component
 */
const DraggableModuleButton = React.memo(({ module, disabled, onModuleAdd, theme, canvasZoom }) => {
  const buttonRef = useRef(null);
  const IconComponent = module.icon;
  
  useEffect(() => {
    const button = buttonRef.current;
    if (!button || disabled) return;
    
    const handleDragStart = (e) => {
      e.stopPropagation();
      
      // Set drag data
      const dragData = {
        type: module.type,
        label: module.label
      };
      e.dataTransfer.setData('application/reactflow', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
      
      // Create proper SVG drag preview matching canvas nodes
      const dragPreview = createSVGDragPreview(module, theme, canvasZoom);
      document.body.appendChild(dragPreview);
      
      const { width, height } = getNodeDimensions(module.type);
      const scaledWidth = width * canvasZoom;
      const scaledHeight = height * canvasZoom;
      
      e.dataTransfer.setDragImage(dragPreview, scaledWidth / 2, scaledHeight / 2);
      
      // Clean up after drag starts
      setTimeout(() => {
        if (document.body.contains(dragPreview)) {
          document.body.removeChild(dragPreview);
        }
      }, 100);
    };
    
    const handleDragEnd = () => {
      // Drag completed
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
  disabled = false,
  canvasZoom = 1
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
                theme={theme}
                canvasZoom={canvasZoom}
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
    prevProps.canvasZoom === nextProps.canvasZoom &&
    prevProps.onModuleAdd === nextProps.onModuleAdd
  );
});