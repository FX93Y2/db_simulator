const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Configuration Management
    getConfigs: (configType) => ipcRenderer.invoke('api:getConfigs', configType),
    getConfig: (configId) => ipcRenderer.invoke('api:getConfig', configId),
    saveConfig: (configData) => ipcRenderer.invoke('api:saveConfig', configData),
    updateConfig: (configId, configData) => ipcRenderer.invoke('api:updateConfig', configId, configData),
    deleteConfig: (configId) => ipcRenderer.invoke('api:deleteConfig', configId),
    
    // Database Generation
    generateDatabase: (data) => ipcRenderer.invoke('api:generateDatabase', data),
    
    // Simulation
    runSimulation: (data) => ipcRenderer.invoke('api:runSimulation', data),
    generateAndSimulate: (data) => ipcRenderer.invoke('api:generateAndSimulate', data),
  }
); 