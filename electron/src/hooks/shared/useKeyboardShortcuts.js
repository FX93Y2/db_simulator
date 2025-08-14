import { useEffect } from 'react';

/**
 * Custom hook for common keyboard shortcuts (undo/redo)
 * Consolidates duplicated keyboard handling from DbConfigEditor and SimConfigEditor
 */
const useKeyboardShortcuts = ({ undo, redo, canUndo, canRedo }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle shortcuts when focused on the component
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'z':
            if (event.shiftKey) {
              // Ctrl+Shift+Z for redo
              event.preventDefault();
              if (canRedo && canRedo()) {
                redo();
              }
            } else {
              // Ctrl+Z for undo
              event.preventDefault();
              if (canUndo && canUndo()) {
                undo();
              }
            }
            break;
          case 'y':
            // Ctrl+Y for redo (alternative)
            event.preventDefault();
            if (canRedo && canRedo()) {
              redo();
            }
            break;
          default:
            // No action needed for other keys
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, canUndo, canRedo]);

  // This hook doesn't return anything as it just sets up event listeners
  return {};
};

export default useKeyboardShortcuts;