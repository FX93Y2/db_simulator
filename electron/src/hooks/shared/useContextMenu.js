import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Shared hook for handling context menu functionality on canvas components
 * Provides mouse position tracking, visibility state, and keyboard shortcuts
 * Used by both ERDiagram and ModularEventFlow components
 */
const useContextMenu = ({
  selectionMode,
  selectedItems = [],
  clipboard = [],
  onCopy,
  onPaste,
  onDelete,
  onShowContextMenu,
  onHideContextMenu,
  reactFlowInstance
}) => {
  // Local state for mouse position tracking
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Track when context menu was last opened to prevent immediate closure
  const lastOpenedRef = useRef(0);

  /**
   * Handle right-click on canvas pane
   * Only shows context menu if in selection mode and has clipboard content
   */
  const onPaneContextMenu = useCallback((event) => {

    // Show context menu in selection mode if we have clipboard content or selections
    if (selectionMode && (clipboard.length > 0 || selectedItems.length > 0)) {
      event.preventDefault();
      
      
      // Use native event coordinates if available, otherwise use synthetic
      const clientX = event.nativeEvent?.clientX ?? event.clientX;
      const clientY = event.nativeEvent?.clientY ?? event.clientY;
      
      // Convert screen coordinates to flow coordinates for paste positioning
      const viewport = reactFlowInstance.getViewport();
      const flowPosition = {
        x: (clientX - viewport.x) / viewport.zoom,
        y: (clientY - viewport.y) / viewport.zoom
      };
      setMousePosition(flowPosition);
      lastOpenedRef.current = Date.now();
      onShowContextMenu(clientX, clientY);
    }
    // Otherwise, allow browser's default context menu
  }, [selectionMode, clipboard.length, selectedItems.length, onShowContextMenu, reactFlowInstance]);

  /**
   * Handle right-click on nodes/entities
   * Only shows context menu if in selection mode and item is selected
   */
  const onNodeContextMenu = useCallback((event, node) => {

    // Show context menu if in selection mode
    if (selectionMode) {
      event.preventDefault();
      event.stopPropagation();
      
      
      // Use native event coordinates if available, otherwise use synthetic
      const clientX = event.nativeEvent?.clientX ?? event.clientX;
      const clientY = event.nativeEvent?.clientY ?? event.clientY;
      
      // Convert screen coordinates to flow coordinates
      const viewport = reactFlowInstance.getViewport();
      const flowPosition = {
        x: (clientX - viewport.x) / viewport.zoom,
        y: (clientY - viewport.y) / viewport.zoom
      };
      setMousePosition(flowPosition);
      lastOpenedRef.current = Date.now();
      onShowContextMenu(clientX, clientY);
    }
    // Otherwise, allow browser's default context menu
  }, [selectionMode, selectedItems, onShowContextMenu, reactFlowInstance]);

  /**
   * Handle pane click - hide context menu and clear selections
   */
  const onPaneClick = useCallback((event) => {
    onHideContextMenu();
  }, [onHideContextMenu]);

  /**
   * Context menu action handlers
   */
  const handleContextCopy = useCallback(() => {
    onCopy();
    onHideContextMenu();
  }, [onCopy, onHideContextMenu]);

  const handleContextPaste = useCallback(() => {
    onPaste(mousePosition);
    onHideContextMenu();
  }, [onPaste, mousePosition, onHideContextMenu]);

  const handleContextDelete = useCallback(() => {
    if (selectedItems.length > 0) {
      onDelete(selectedItems);
    }
    onHideContextMenu();
  }, [selectedItems, onDelete, onHideContextMenu]);

  /**
   * Keyboard shortcuts handler
   */
  const handleKeyboard = useCallback((event) => {
    // Check if user is typing in an input field
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );

    if (isTyping) return;

    // Escape key - hide context menu
    if (event.key === 'Escape') {
      onHideContextMenu();
      event.preventDefault();
    }
    
    // Copy: Ctrl+C / Cmd+C
    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && selectedItems.length > 0) {
      onCopy();
      event.preventDefault();
    }
    
    // Paste: Ctrl+V / Cmd+V
    if ((event.ctrlKey || event.metaKey) && event.key === 'v' && clipboard.length > 0) {
      // Use a default position for keyboard paste
      onPaste({ x: 200, y: 200 });
      event.preventDefault();
    }
  }, [selectedItems.length, clipboard.length, onCopy, onPaste, onHideContextMenu]);

  /**
   * Close context menu when clicking elsewhere (but not immediately after opening)
   */
  useEffect(() => {
    const handleClick = (event) => {
      // Ignore right-clicks (they're handled by contextmenu events)
      if (event.button === 2) {
        return;
      }
      
      // Don't hide if menu was just opened (within 200ms)
      const timeSinceOpened = Date.now() - lastOpenedRef.current;
      if (timeSinceOpened < 200) {
        return;
      }
      
      // Check if click is inside context menu
      const contextMenu = event.target.closest('.context-menu');
      if (!contextMenu) {
        onHideContextMenu();
      }
    };
    
    // Add both click and mousedown listeners to catch all interactions
    document.addEventListener('click', handleClick, false);
    document.addEventListener('mousedown', handleClick, false);
    
    return () => {
      document.removeEventListener('click', handleClick, false);
      document.removeEventListener('mousedown', handleClick, false);
    };
  }, [onHideContextMenu]);

  /**
   * Keyboard event listener
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
    };
  }, [handleKeyboard]);

  return {
    mousePosition,
    onPaneContextMenu,
    onNodeContextMenu,
    onPaneClick,
    handleContextCopy,
    handleContextPaste,
    handleContextDelete
  };
};

export default useContextMenu;