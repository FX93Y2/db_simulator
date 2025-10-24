import { useCallback } from 'react';
import JSZip from 'jszip';
import { toast } from 'react-bootstrap';

/**
 * Custom hook for exporting both database and simulation configs as a single ZIP file
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.projectName - Name of the project (used for file naming)
 * @param {string} params.dbYamlContent - Database configuration YAML content
 * @param {string} params.simYamlContent - Simulation configuration YAML content
 * @returns {Object} - Object containing handleExportAll function
 */
const useExportAllConfigs = ({ projectName = 'project', dbYamlContent, simYamlContent }) => {
  /**
   * Export both configurations as a ZIP file
   * Creates a flat-structure ZIP with both YAML files
   */
  const handleExportAll = useCallback(async () => {
    try {
      // Validate that we have at least one config
      const hasDbConfig = dbYamlContent && dbYamlContent.trim().length > 0;
      const hasSimConfig = simYamlContent && simYamlContent.trim().length > 0;

      if (!hasDbConfig && !hasSimConfig) {
        toast.error('No configurations available to export');
        return;
      }

      // Warn if one config is missing
      if (!hasDbConfig) {
        const proceed = window.confirm(
          'Database configuration is empty. Do you want to export only the simulation configuration?'
        );
        if (!proceed) return;
      }

      if (!hasSimConfig) {
        const proceed = window.confirm(
          'Simulation configuration is empty. Do you want to export only the database configuration?'
        );
        if (!proceed) return;
      }

      // Create ZIP file
      const zip = new JSZip();

      // Sanitize project name for use in filenames (remove special characters)
      const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Add files to ZIP (flat structure, no folders)
      if (hasDbConfig) {
        zip.file(`${sanitizedProjectName}_db.yaml`, dbYamlContent);
      }

      if (hasSimConfig) {
        zip.file(`${sanitizedProjectName}_sim.yaml`, simYamlContent);
      }

      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9 // Maximum compression
        }
      });

      // Create download link and trigger download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizedProjectName}_configs.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      URL.revokeObjectURL(url);

      // Show success message
      const filesExported = [];
      if (hasDbConfig) filesExported.push('database config');
      if (hasSimConfig) filesExported.push('simulation config');

      toast.success(
        `Successfully exported ${filesExported.join(' and ')} as ${sanitizedProjectName}_configs.zip`
      );

    } catch (error) {
      console.error('Error exporting configs as ZIP:', error);
      toast.error(`Failed to export configs: ${error.message}`);
    }
  }, [projectName, dbYamlContent, simYamlContent]);

  return {
    handleExportAll
  };
};

export default useExportAllConfigs;
