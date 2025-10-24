import React from 'react';
import { FiDatabase, FiSettings, FiUpload, FiDownload, FiSave, FiPackage } from 'react-icons/fi';

/**
 * Shared EditorHeader component for both DbConfigEditor and SimConfigEditor
 * Contains VS Code-style tabs and action buttons
 */
const EditorHeader = ({
  currentTab,
  onTabChange,
  onImport,
  onExport,
  onExportAll,
  onSave,
  yamlContent,
  isLoading,
  fileInputRef,
  saveAll = false
}) => {
  return (
    <div className="grid-yaml-header">
      <div className="yaml-header-container">
        {/* VS Code style tabs */}
        <div className="vscode-tabs">
          <div 
            className={`tab-item ${currentTab === 'database' ? 'active' : ''}`}
            onClick={() => onTabChange('database')}
          >
            <FiDatabase className="tab-icon" />
            DB Config
          </div>
          <div 
            className={`tab-item ${currentTab === 'simulation' ? 'active' : ''}`}
            onClick={() => onTabChange('simulation')}
          >
            <FiSettings className="tab-icon" />
            Sim Config
          </div>
        </div>
        
        {/* Action buttons on the right - icon only */}
        <div className="yaml-actions">
          <button
            className="yaml-action-btn"
            onClick={onImport}
            disabled={isLoading}
            title="Import YAML"
          >
            <FiDownload />
          </button>
          <button
            className="yaml-action-btn"
            onClick={onExport}
            disabled={!yamlContent || isLoading}
            title="Export YAML"
          >
            <FiUpload />
          </button>
          {onExportAll && (
            <button
              className="yaml-action-btn"
              onClick={onExportAll}
              disabled={isLoading}
              title="Export Both Configs as ZIP"
            >
              <FiPackage />
            </button>
          )}
          <button
            className="yaml-action-btn"
            onClick={onSave}
            disabled={isLoading}
            title={saveAll ? "Save All Configurations" : "Save Configuration"}
          >
            <FiSave />
          </button>
        </div>
      </div>
      
      {fileInputRef && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml"
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

export default EditorHeader;