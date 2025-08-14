import { useRef, useCallback } from 'react';
import { useToastContext } from '../../contexts/ToastContext';

/**
 * Custom hook for common YAML operations (import/export/file handling)
 * Consolidates duplicated code from DbConfigEditor and SimConfigEditor
 */
const useYamlOperations = ({ yamlContent, onImport, filename = 'config' }) => {
  const fileInputRef = useRef(null);
  const { showSuccess, showError, showWarning } = useToastContext();

  // Handle file import
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file input change
  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const content = await file.text();
      if (onImport) {
        const result = await onImport(content);
        if (!result.success) {
          showError(`Import failed: ${result.message}`);
        } else {
          showSuccess(result.message);
        }
      }
    } catch (error) {
      showError(`Import failed: ${error.message}`);
    } finally {
      // Reset file input
      event.target.value = '';
    }
  }, [onImport, showError, showSuccess]);

  // Handle file export
  const handleExport = useCallback(() => {
    if (!yamlContent) {
      showWarning('No content to export');
      return;
    }

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess('Configuration exported successfully');
  }, [yamlContent, filename, showSuccess, showWarning]);

  return {
    fileInputRef,
    handleImport,
    handleExport,
    handleFileChange
  };
};

export default useYamlOperations;