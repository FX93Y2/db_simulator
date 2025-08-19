import React, { useEffect, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ReactComponent as CircleSVG } from '../../assets/svg/circle.svg';
import { ReactComponent as RectangleSVG } from '../../assets/svg/rectangle.svg';
import { ReactComponent as DiamondSVG } from '../../assets/svg/diamond.svg';
import { ReactComponent as PentagonSVG } from '../../assets/svg/pentagon.svg';
import { useDragState } from '../../contexts/DndContext';


/**
 * Draggable module button component using @dnd-kit
 */
const DraggableModuleButton = React.memo(({ module, disabled, onModuleAdd }) => {
  const IconComponent = module.icon;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: module.type,
    data: {
      type: module.type,
      label: module.label
    },
    disabled
  });

  console.log(`🔧 DraggableModuleButton ${module.type}:`, {
    isDragging,
    disabled,
    attributes,
    listeners: Object.keys(listeners || {})
  });
  
  const handleClick = () => {
    if (!disabled && onModuleAdd) {
      onModuleAdd(module.type);
    }
  };
  
  return (
    <button
      ref={setNodeRef}
      className={`module-sidebar__button ${disabled ? 'disabled' : ''} ${isDragging ? 'module-sidebar__button--dragging' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      title={`${module.label} - ${module.description}`}
      {...listeners}
      {...attributes}
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
  const { registerDragHandlers } = useDragState();

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

  const handleDragStart = useCallback((event) => {
    console.log('🎯 ModuleSidebar dragStart:', {
      activeId: event.active.id,
      data: event.active.data.current,
      activatorEvent: event.activatorEvent
    });
  }, []);

  const handleDragMove = useCallback((event) => {
    console.log('🔄 ModuleSidebar dragMove:', {
      activeId: event.active.id,
      delta: event.delta,
      over: event.over?.id
    });
  }, []);

  const handleDragEnd = useCallback((event) => {
    console.log('🏁 ModuleSidebar dragEnd:', {
      activeId: event.active?.id,
      overId: event.over?.id,
      delta: event.delta,
      activatorEvent: event.activatorEvent
    });
    
    // Try to integrate with ReactFlow's drop handling
    if (event.over || event.delta) {
      const dragData = event.active.data.current;
      console.log('📦 Attempting drop with data:', dragData);
      
      // Debug layout information
      const reactFlowPane = document.querySelector('.react-flow__pane');
      const projectSidebar = document.querySelector('.project-sidebar');
      const yamlEditor = document.querySelector('.yaml-editor, .monaco-editor');
      
      console.log('🔍 Layout debug:', {
        reactFlowPane: reactFlowPane ? {
          offsetLeft: reactFlowPane.offsetLeft,
          offsetTop: reactFlowPane.offsetTop,
          rect: reactFlowPane.getBoundingClientRect()
        } : null,
        projectSidebar: projectSidebar ? {
          width: projectSidebar.offsetWidth,
          rect: projectSidebar.getBoundingClientRect()
        } : null,
        yamlEditor: yamlEditor ? {
          width: yamlEditor.offsetWidth,
          rect: yamlEditor.getBoundingClientRect()
        } : null,
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        }
      });
      
      // Calculate drop position accounting for ReactFlow's actual position
      const rawDropX = (event.activatorEvent?.clientX || 0) + (event.delta?.x || 0);
      const rawDropY = (event.activatorEvent?.clientY || 0) + (event.delta?.y || 0);
      
      // Since ReactFlow expects screen coordinates but our preview is offset by sidebars,
      // we need to adjust the raw coordinates to compensate for the layout shift
      const dropX = rawDropX;
      const dropY = rawDropY;
      
      // Keep layout debug info for reference
      const yamlEditorOffset = yamlEditor ? yamlEditor.getBoundingClientRect().width : 0;
      const projectSidebarOffset = projectSidebar ? projectSidebar.getBoundingClientRect().width : 0;
      const reactFlowRect = reactFlowPane.getBoundingClientRect();
      
      console.log('📍 Drop position calculation:', { 
        activatorX: event.activatorEvent?.clientX,
        activatorY: event.activatorEvent?.clientY,
        deltaX: event.delta?.x,
        deltaY: event.delta?.y,
        rawDropX,
        rawDropY,
        yamlEditorOffset,
        projectSidebarOffset,
        reactFlowRect: {
          left: reactFlowRect.left,
          top: reactFlowRect.top,
          width: reactFlowRect.width,
          height: reactFlowRect.height
        },
        finalDropX: dropX, 
        finalDropY: dropY,
        note: 'Using snapCenterToCursor modifier with global DndContext'
      });
      
      console.log('🎯 ReactFlow pane found:', !!reactFlowPane);
      
      // Check if dropping over sidebar (cancel operation)
      const sidebar = document.querySelector('.module-sidebar');
      if (sidebar) {
        const sidebarRect = sidebar.getBoundingClientRect();
        if (dropX >= sidebarRect.left && dropX <= sidebarRect.right &&
            dropY >= sidebarRect.top && dropY <= sidebarRect.bottom) {
          console.log('🚫 Drag cancelled - dropped over sidebar');
          return; // Cancel the drop
        }
      }
      
      if (reactFlowPane) {
        // Create a synthetic drop event
        const syntheticEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: dropX,
          clientY: dropY,
        });
        
        // Mock dataTransfer for ReactFlow compatibility
        Object.defineProperty(syntheticEvent, 'dataTransfer', {
          value: {
            getData: (format) => {
              console.log('🔍 DataTransfer.getData called with format:', format);
              if (format === 'application/reactflow') {
                return JSON.stringify(dragData);
              }
              return '';
            },
            setData: () => {},
            clearData: () => {},
            files: [],
            items: [],
            types: ['application/reactflow']
          },
          writable: false
        });
        
        console.log('🚀 Dispatching synthetic drop event to ReactFlow');
        reactFlowPane.dispatchEvent(syntheticEvent);
      }
    }
  }, []);

  // Register drag handlers with global context
  useEffect(() => {
    registerDragHandlers({
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd
    });
  }, [registerDragHandlers, handleDragStart, handleDragMove, handleDragEnd]);

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