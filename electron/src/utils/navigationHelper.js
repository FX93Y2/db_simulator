/**
 * Safe navigation helper that checks for unsaved changes before navigating
 */
export const safeNavigate = (navigate, targetPath) => {
  // Check if there are unsaved changes
  if (window.__unsavedChangesState?.hasUnsavedChanges) {
    // Show the unsaved changes modal
    if (window.__unsavedChangesState.showModal) {
      window.__unsavedChangesState.showModal(targetPath);
    }
    return false; // Navigation blocked
  } else {
    // No unsaved changes, navigate normally
    navigate(targetPath);
    return true; // Navigation allowed
  }
};

/**
 * Create a safe navigation function bound to a specific navigate function
 */
export const createSafeNavigate = (navigate) => {
  return (targetPath) => safeNavigate(navigate, targetPath);
};