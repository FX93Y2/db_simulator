import { useEffect, useRef } from 'react';

/**
 * Simple navigation guard that sets up global state for unsaved changes
 * Works with HashRouter by storing the unsaved state globally
 */
export const useNavigationBlocker = (hasUnsavedChanges, onNavigationBlocked) => {
  const blockedNavigationRef = useRef(null);

  useEffect(() => {
    // Store the unsaved changes state and callback globally
    window.__unsavedChangesState = {
      hasUnsavedChanges,
      onNavigationBlocked,
      showModal: (targetPath) => {
        blockedNavigationRef.current = targetPath;
        if (onNavigationBlocked) {
          onNavigationBlocked({
            state: 'blocked',
            targetPath,
            proceed: () => {
              window.__unsavedChangesState.hasUnsavedChanges = false;
              window.location.hash = `#${targetPath}`;
              blockedNavigationRef.current = null;
            },
            reset: () => {
              blockedNavigationRef.current = null;
            }
          });
        }
      }
    };

    return () => {
      window.__unsavedChangesState = null;
    };
  }, [hasUnsavedChanges, onNavigationBlocked]);

  return {
    state: blockedNavigationRef.current ? 'blocked' : 'idle',
    proceed: () => {
      if (blockedNavigationRef.current) {
        window.__unsavedChangesState.hasUnsavedChanges = false;
        window.location.hash = `#${blockedNavigationRef.current}`;
        blockedNavigationRef.current = null;
      }
    },
    reset: () => {
      blockedNavigationRef.current = null;
    }
  };
};