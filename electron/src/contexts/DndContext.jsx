import React, { createContext, useContext, useState, useCallback } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { ReactComponent as CircleSVG } from '../assets/svg/circle.svg';
import { ReactComponent as RectangleSVG } from '../assets/svg/rectangle.svg';
import { ReactComponent as DiamondSVG } from '../assets/svg/diamond.svg';
import { ReactComponent as PentagonSVG } from '../assets/svg/pentagon.svg';

const DragStateContext = createContext();

const ModuleDragPreview = ({ module, theme }) => {
  const IconComponent = module.icon;
  
  return (
    <div 
      style={{
        pointerEvents: 'none',
        width: '60px',
        height: '60px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <IconComponent 
        style={{
          width: '60px',
          height: '60px',
          fill: '#252526',
          stroke: 'none',
          filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))',
          opacity: 0.9
        }}
      />
      {module.iconType === 'plus' && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          color: '#ffffff',
          fontSize: '24px',
          fontWeight: 'bold',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'none'
        }}>
          +
        </div>
      )}
      {module.iconType === 'minus' && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          color: '#ffffff',
          fontSize: '24px',
          fontWeight: 'bold',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'none'
        }}>
          −
        </div>
      )}
    </div>
  );
};

export const DndProvider = ({ children, theme = 'light' }) => {
  const [activeId, setActiveId] = useState(null);
  const [dragHandlers, setDragHandlers] = useState({});

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

  const registerDragHandlers = useCallback((handlers) => {
    setDragHandlers(handlers);
  }, []);

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
    
    if (dragHandlers.onDragStart) {
      dragHandlers.onDragStart(event);
    }
  }, [dragHandlers]);

  const handleDragMove = useCallback((event) => {
    if (dragHandlers.onDragMove) {
      dragHandlers.onDragMove(event);
    }
  }, [dragHandlers]);

  const handleDragEnd = useCallback((event) => {
    setActiveId(null);
    
    if (dragHandlers.onDragEnd) {
      dragHandlers.onDragEnd(event);
    }
  }, [dragHandlers]);

  const activeModule = activeId ? modules.find(m => m.type === activeId) : null;

  const contextValue = {
    activeId,
    activeModule,
    registerDragHandlers
  };

  return (
    <DragStateContext.Provider value={contextValue}>
      <DndContext 
        onDragStart={handleDragStart} 
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        {children}
        
        <DragOverlay 
          modifiers={[snapCenterToCursor]}
          dropAnimation={null}
          style={{
            cursor: 'grabbing'
          }}
        >
          {activeModule ? (
            <ModuleDragPreview module={activeModule} theme={theme} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </DragStateContext.Provider>
  );
};

export const useDragState = () => {
  const context = useContext(DragStateContext);
  if (!context) {
    throw new Error('useDragState must be used within a DndProvider');
  }
  return context;
};