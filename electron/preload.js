/**
 * Preload script for Electron application.
 * Exposes specific functionality from main process to renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Configuration management
    getConfigurations: () => ipcRenderer.invoke('get-configs'),
    getConfiguration: (configId) => ipcRenderer.invoke('get-config', configId),
    saveConfiguration: (config) => ipcRenderer.invoke('save-config', config),
    updateConfiguration: (configId, config) => ipcRenderer.invoke('update-config', configId, config),
    deleteConfiguration: (configId) => ipcRenderer.invoke('delete-config', configId),
    
    // Database operations
    generateDatabase: (data) => ipcRenderer.invoke('generate-database', data),
    
    // Simulation operations
    runSimulation: (data) => ipcRenderer.invoke('run-simulation', data),
    runDynamicSimulation: (data) => ipcRenderer.invoke('run-dynamic-simulation', data)
  }
); 