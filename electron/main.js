/**
 * Main entry point for the Electron application.
 * Handles window creation, Python API communication,
 * and lifecycle events.
 */

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const axios = require('axios');
const isDev = require('electron-is-dev');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
// Keep a reference to the Python API process
let pyApiProcess = null;
// API URL
const API_URL = 'http://localhost:5000/api';

/**
 * Start the Python API server
 */
function startPythonApi() {
  // Determine the path to the Python executable and script
  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
  
  // In development, run the Python file directly from the source
  // In production, use the bundled Python files
  const pythonPath = isDev 
    ? path.join(__dirname, '..', 'python', 'api', 'server.py')
    : path.join(process.resourcesPath, 'python', 'api', 'server.py');
    
  // Start the Python process
  pyApiProcess = spawn(pythonExecutable, [pythonPath]);
  
  pyApiProcess.stdout.on('data', (data) => {
    console.log(`Python API: ${data}`);
  });
  
  pyApiProcess.stderr.on('data', (data) => {
    console.error(`Python API error: ${data}`);
  });
  
  pyApiProcess.on('close', (code) => {
    console.log(`Python API process exited with code ${code}`);
    // Only restart if the app is not quitting
    if (!app.isQuitting) {
      dialog.showErrorBox(
        'API Server Error',
        `The Python API server has stopped unexpectedly. The application might not function correctly.`
      );
    }
  });
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html of the app
  const startUrl = isDev
    ? 'http://localhost:3000' // Use React dev server in development
    : url.format({
        pathname: path.join(__dirname, 'build', 'index.html'),
        protocol: 'file:',
        slashes: true
      });
      
  mainWindow.loadURL(startUrl);

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Start the Python API before creating the window
  startPythonApi();
  
  // Wait for the API to start before creating the window
  setTimeout(() => {
    createWindow();
  }, 1000); // Give the API server time to start
  
  app.on('activate', function () {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (mainWindow === null) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  // On macOS it is common for applications to stay active until the user quits
  if (process.platform !== 'darwin') app.quit();
});

// Handle app being ready to quit
app.on('before-quit', () => {
  app.isQuitting = true;
  // Kill the Python API process
  if (pyApiProcess) {
    process.platform === 'win32' ? spawn('taskkill', ['/pid', pyApiProcess.pid, '/f', '/t']) : pyApiProcess.kill();
  }
});

// IPC handlers for communicating with the Python API

// Get all configurations
ipcMain.handle('get-configs', async () => {
  try {
    const response = await axios.get(`${API_URL}/config`);
    return response.data;
  } catch (error) {
    console.error('Error getting configurations:', error);
    throw new Error(`Failed to get configurations: ${error.message}`);
  }
});

// Get a specific configuration
ipcMain.handle('get-config', async (event, configId) => {
  try {
    const response = await axios.get(`${API_URL}/config/${configId}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting configuration ${configId}:`, error);
    throw new Error(`Failed to get configuration: ${error.message}`);
  }
});

// Save a new configuration
ipcMain.handle('save-config', async (event, config) => {
  try {
    const response = await axios.post(`${API_URL}/config`, config);
    return response.data;
  } catch (error) {
    console.error('Error saving configuration:', error);
    throw new Error(`Failed to save configuration: ${error.message}`);
  }
});

// Update an existing configuration
ipcMain.handle('update-config', async (event, configId, config) => {
  try {
    const response = await axios.put(`${API_URL}/config/${configId}`, config);
    return response.data;
  } catch (error) {
    console.error(`Error updating configuration ${configId}:`, error);
    throw new Error(`Failed to update configuration: ${error.message}`);
  }
});

// Delete a configuration
ipcMain.handle('delete-config', async (event, configId) => {
  try {
    const response = await axios.delete(`${API_URL}/config/${configId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting configuration ${configId}:`, error);
    throw new Error(`Failed to delete configuration: ${error.message}`);
  }
});

// Generate a database
ipcMain.handle('generate-database', async (event, data) => {
  try {
    const response = await axios.post(`${API_URL}/generate`, data);
    return response.data;
  } catch (error) {
    console.error('Error generating database:', error);
    throw new Error(`Failed to generate database: ${error.message}`);
  }
});

// Run a simulation
ipcMain.handle('run-simulation', async (event, data) => {
  try {
    const response = await axios.post(`${API_URL}/simulate`, data);
    return response.data;
  } catch (error) {
    console.error('Error running simulation:', error);
    throw new Error(`Failed to run simulation: ${error.message}`);
  }
});

// Run a dynamic simulation
ipcMain.handle('run-dynamic-simulation', async (event, data) => {
  try {
    const response = await axios.post(`${API_URL}/dynamic-simulate`, data);
    return response.data;
  } catch (error) {
    console.error('Error running dynamic simulation:', error);
    throw new Error(`Failed to run dynamic simulation: ${error.message}`);
  }
}); 