import { useEffect } from 'react';

/**
 * Enhanced text selection prevention hook
 * Prevents text selection through both CSS and JavaScript events
 * 
 * @param {React.RefObject} containerRef - Reference to the container element
 * @param {boolean} preventSelection - Whether to prevent text selection
 */
const useTextSelectionPrevention = (containerRef, preventSelection = true) => {
  useEffect(() => {
    if (!preventSelection || !containerRef.current) return;

    const container = containerRef.current;

    // Prevent text selection through selectstart event
    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    // Prevent text selection through mousedown event
    const handleMouseDown = (e) => {
      // Only prevent for selection rectangle drags, not node interactions
      if (e.target.classList.contains('react-flow__pane') || 
          e.target.classList.contains('react-flow__viewport') ||
          e.target.classList.contains('react-flow__transformationpane')) {
        e.preventDefault();
      }
    };

    // Prevent drag start for any element that might cause text selection
    const handleDragStart = (e) => {
      // Allow drag for nodes and handles, prevent for everything else
      if (!e.target.classList.contains('react-flow__node') && 
          !e.target.classList.contains('react-flow__handle') &&
          !e.target.closest('.react-flow__node')) {
        e.preventDefault();
        return false;
      }
    };

    // Prevent context menu during selection drags
    const handleContextMenu = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // Add event listeners
    container.addEventListener('selectstart', handleSelectStart, { passive: false });
    container.addEventListener('mousedown', handleMouseDown, { passive: false });
    container.addEventListener('dragstart', handleDragStart, { passive: false });
    container.addEventListener('contextmenu', handleContextMenu, { passive: false });

    // Cleanup function
    return () => {
      if (container) {
        container.removeEventListener('selectstart', handleSelectStart);
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('dragstart', handleDragStart);
        container.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [containerRef, preventSelection]);
};

export default useTextSelectionPrevention;