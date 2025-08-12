import { useCallback, useRef, useEffect } from 'react';

/**
 * CSS Grid Resize Hook - High Performance with CSS Custom Properties
 * Uses CSS custom properties for VS Code-like performance
 */
export const useResizableGrid = ({
  minWidthPercent = 15,
  maxWidthPercent = 60,
  defaultWidthPercent = 20,
  cssVariable = '--yaml-panel-width',
  storageKey = 'editor-yaml-panel-width'
} = {}) => {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(defaultWidthPercent);

  // Load saved width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem(storageKey);
    if (savedWidth) {
      const width = parseFloat(savedWidth);
      if (width >= minWidthPercent && width <= maxWidthPercent) {
        updatePanelWidth(width);
      }
    } else {
      // Set default width
      updatePanelWidth(defaultWidthPercent);
    }
  }, [minWidthPercent, maxWidthPercent, defaultWidthPercent, storageKey]);

  // Update CSS custom property (high performance)
  const updatePanelWidth = useCallback((widthPercent) => {
    const clampedWidth = Math.max(minWidthPercent, Math.min(maxWidthPercent, widthPercent));
    
    // Update CSS custom property - browser handles layout natively
    document.documentElement.style.setProperty(cssVariable, `${clampedWidth}%`);
    
    // Save to localStorage
    localStorage.setItem(storageKey, clampedWidth.toString());
    
    return clampedWidth;
  }, [minWidthPercent, maxWidthPercent, cssVariable, storageKey]);

  // Get container width for calculations
  const getContainerWidth = useCallback(() => {
    // Try multiple selectors to find the right container
    const selectors = [
      '.app-grid-container',      // For sidebar resize
      '.editor-grid-container',   // For editor panels
      '.project-tab-content .tab-pane.active .editor-grid-container', // For project tab editors
      '.tab-pane.active .editor-grid-container'
    ];
    
    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container) {
        return container.getBoundingClientRect().width;
      }
    }
    
    // Fallback to window width
    return window.innerWidth * 0.8; // Assume container is ~80% of window
  }, []);

  // Handle drag start
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    
    // Get current width from CSS custom property
    const currentWidth = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVariable)
      .replace('%', '') || defaultWidthPercent;
    
    startWidthRef.current = parseFloat(currentWidth);
    
    // Add dragging class for visual feedback
    const handle = e.target.closest('.grid-resize-handle') || 
                  e.target.closest('.grid-sidebar-handle');
    if (handle) {
      handle.classList.add('dragging');
    }

    // Add global event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { once: true });
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [cssVariable, defaultWidthPercent]);

  // Handle drag move (optimized with requestAnimationFrame)
  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    
    e.preventDefault();
    
    // Use requestAnimationFrame for smooth 60fps updates
    requestAnimationFrame(() => {
      const containerWidth = getContainerWidth();
      if (!containerWidth) return;

      const deltaX = e.clientX - startXRef.current;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidthPercent = startWidthRef.current + deltaPercent;
      
      // Update width via CSS custom property
      updatePanelWidth(newWidthPercent);
    });
  }, [getContainerWidth, updatePanelWidth]);

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    
    // Remove dragging class
    const handle = document.querySelector('.grid-resize-handle.dragging, .grid-sidebar-handle.dragging');
    if (handle) {
      handle.classList.remove('dragging');
    }
    
    // Clean up global styles and listeners
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    handleMouseDown,
    isDragging: isDraggingRef.current,
    updatePanelWidth
  };
};

export default useResizableGrid;