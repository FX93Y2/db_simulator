import { useEffect, useRef } from 'react';
import { useToastContext } from '../../contexts/ToastContext';

/**
 * Custom hook for configuration loading logic
 * Consolidates duplicated initialization and loading from DbConfigEditor and SimConfigEditor
 * Modified to preserve unsaved changes when switching tabs within the same project
 */
const useConfigurationLoader = ({
  projectId,
  configId,
  isProjectTab,
  theme,
  onConfigChange,
  yamlContent,
  error,
  initializeConfig,
  loadConfig,
  hasContent
}) => {
  const { showError } = useToastContext();
  const previousConfigId = useRef(configId);

  // Initialize configuration context
  useEffect(() => {
    if (initializeConfig) {
      initializeConfig({
        projectId,
        isProjectTab,
        theme,
        onConfigChange
      });

    }
  }, [projectId, isProjectTab, theme, onConfigChange, initializeConfig]);

  // Load existing configuration only if needed
  useEffect(() => {
    const loadConfiguration = async () => {
      // Check if store already has content and configId hasn't changed
      const storeHasContent = hasContent && hasContent();
      const configIdChanged = previousConfigId.current !== configId;
      
      // Update the previous configId reference
      previousConfigId.current = configId;
      
      // Only load from backend if:
      // 1. Store is empty (no existing content), OR
      // 2. ConfigId changed (switching to different config), OR  
      // 3. This is the very first load for this project
      if (!storeHasContent || configIdChanged) {
        if (configId) {
          await loadConfig(configId);
        } else if (projectId) {
          await loadConfig(null, projectId);
        }
      } else {
      }
    };

    if (loadConfig) {
      loadConfiguration();
    }
  }, [configId, projectId, loadConfig, hasContent]);

  // Handle configuration changes for parent component
  useEffect(() => {
    
    if (onConfigChange && yamlContent) {
      onConfigChange(yamlContent);
    }
  }, [yamlContent, onConfigChange]);

  // Handle errors
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  // This hook doesn't return anything as it just sets up effects
  return {};
};

export default useConfigurationLoader;