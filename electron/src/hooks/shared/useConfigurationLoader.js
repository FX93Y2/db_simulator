import { useEffect } from 'react';
import { useToastContext } from '../../contexts/ToastContext';

/**
 * Custom hook for configuration loading logic
 * Consolidates duplicated initialization and loading from DbConfigEditor and SimConfigEditor
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
  loadConfig
}) => {
  const { showError } = useToastContext();

  // Initialize configuration context
  useEffect(() => {
    if (initializeConfig) {
      initializeConfig({
        projectId,
        isProjectTab,
        theme,
        onConfigChange
      });

      console.log('🔧 Configuration context initialized');
    }
  }, [projectId, isProjectTab, theme, onConfigChange, initializeConfig]);

  // Load existing configuration
  useEffect(() => {
    const loadConfiguration = async () => {
      if (configId) {
        console.log('📂 Loading standalone config:', configId);
        await loadConfig(configId);
      } else if (projectId) {
        console.log('📂 Loading project config:', projectId);
        await loadConfig(null, projectId);
      }
    };

    if (loadConfig) {
      loadConfiguration();
    }
  }, [configId, projectId, loadConfig]);

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