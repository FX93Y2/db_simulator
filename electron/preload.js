const { contextBridge, ipcRenderer } = require('electron');

// Node.js globals shim for Monaco editor
contextBridge.exposeInMainWorld('global', {
  // Add any global properties Monaco editor needs
  ArrayBuffer: ArrayBuffer,
  Uint8Array: Uint8Array,
  TextDecoder: TextDecoder,
  TextEncoder: TextEncoder,
  URL: URL,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
});

contextBridge.exposeInMainWorld('process', {
  platform: process.platform,
  env: {
    NODE_ENV: process.env.NODE_ENV,
    MONACO_EDITOR_PATH: 'node_modules/monaco-editor/min/vs'
  },
  nextTick: process.nextTick,
  versions: process.versions
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Project Management
    getProjects: () => ipcRenderer.invoke('api:getProjects'),
    getProject: (projectId) => ipcRenderer.invoke('api:getProject', projectId),
    createProject: (projectData) => ipcRenderer.invoke('api:createProject', projectData),
    updateProject: (projectId, projectData) => ipcRenderer.invoke('api:updateProject', projectId, projectData),
    deleteProject: (projectId) => ipcRenderer.invoke('api:deleteProject', projectId),
    
    // Project Configuration Management
    getProjectDbConfig: (projectId) => ipcRenderer.invoke('api:getProjectDbConfig', projectId),
    saveProjectDbConfig: (projectId, configData) => ipcRenderer.invoke('api:saveProjectDbConfig', projectId, configData),
    getProjectSimConfig: (projectId) => ipcRenderer.invoke('api:getProjectSimConfig', projectId),
    saveProjectSimConfig: (projectId, configData) => ipcRenderer.invoke('api:saveProjectSimConfig', projectId, configData),
    
    // Standalone Configuration Management
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
    
    // Results Management
    getSimulationResults: (databasePath) => ipcRenderer.invoke('api:getSimulationResults', databasePath),
    getDatabaseTables: (databasePath) => ipcRenderer.invoke('api:getDatabaseTables', databasePath),
    getTableData: (params) => ipcRenderer.invoke('api:getTableData', params),
    exportDatabaseToCSV: (databasePath) => ipcRenderer.invoke('api:exportDatabaseToCSV', databasePath),
    
    // File Management
    openFile: (filePath) => ipcRenderer.invoke('api:openFile', filePath),
    saveFile: (filePath, content) => ipcRenderer.invoke('api:saveFile', filePath, content)
  }
); 