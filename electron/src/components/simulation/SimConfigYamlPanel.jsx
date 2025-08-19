import React, { useState, useCallback } from 'react';
import { LuListTree } from 'react-icons/lu';
import { TbTimelineEventText } from 'react-icons/tb';
import YamlEditor from '../shared/YamlEditor';
import ModuleSidebar from './ModuleSidebar';


/**
 * Integrated YAML editor and module sidebar panel for Sim Config tab
 * Contains sub-tabs to switch between YAML editor and module sidebar
 */
const SimConfigYamlPanel = ({
  yamlContent,
  theme,
  onModuleAdd,
  onConfigOpen,
  disabled,
  isLoading
}) => {
  const [activeSubTab, setActiveSubTab] = useState('yaml');


  const handleSubTabChange = useCallback((tabId) => {
    setActiveSubTab(tabId);
  }, []);

  return (
    <div className="sim-config-yaml-panel">
      {/* Sub-tab navigation */}
      <div className="yaml-panel-header">
        <div className="yaml-panel-tabs">
          <div 
            className={`yaml-sub-tab ${activeSubTab === 'yaml' ? 'active' : ''}`}
            onClick={() => handleSubTabChange('yaml')}
          >
            <LuListTree className="tab-icon" />
            YAML
          </div>
          <div 
            className={`yaml-sub-tab ${activeSubTab === 'modules' ? 'active' : ''}`}
            onClick={() => handleSubTabChange('modules')}
          >
            <TbTimelineEventText className="tab-icon" />
            Model
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="yaml-panel-content">
        {activeSubTab === 'yaml' && (
          <YamlEditor 
            initialValue={yamlContent} 
            onSave={null}
            readOnly={true}
            showImportExport={false}
            filename="simulation-config"
            theme={theme}
          />
        )}
        {activeSubTab === 'modules' && (
          <ModuleSidebar
            isVisible={true}
            onModuleAdd={onModuleAdd}
            onConfigOpen={onConfigOpen}
            theme={theme}
            disabled={disabled}
            embedded={true}
          />
        )}
      </div>
    </div>
  );
};

export default SimConfigYamlPanel;