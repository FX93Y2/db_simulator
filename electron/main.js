const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

// API Base URL for the Python backend
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
let backendProcess = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start Python backend
function startBackend() {
  console.log('Starting Python backend...');
  // Path to Python executable - use the virtual environment if possible
  const pythonPath = process.platform === 'win32' ? 
    path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe') : 
    path.join(__dirname, '..', 'venv', 'bin', 'python');
  
  // Check if venv exists, otherwise use system Python
  const pythonExe = fs.existsSync(pythonPath) ? pythonPath : 'python';
  
  // Path to the main.py file
  const scriptPath = path.join(__dirname, '..', 'python', 'main.py');
  
  // Start the process
  backendProcess = spawn(pythonExe, [scriptPath, 'api']);
  
  // Handle output
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend stdout: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend stderr: ${data}`);
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
  });
}

// API handlers
ipcMain.handle('api:getConfigs', async (event, configType) => {
  try {
    const url = configType ? `${API_BASE_URL}/config?type=${configType}` : `${API_BASE_URL}/config`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error getting configurations:', error);
    throw error;
  }
});

ipcMain.handle('api:getConfig', async (event, configId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/config/${configId}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting configuration ${configId}:`, error);
    throw error;
  }
});

ipcMain.handle('api:saveConfig', async (event, configData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/config`, configData);
    return response.data;
  } catch (error) {
    console.error('Error saving configuration:', error);
    throw error;
  }
});

ipcMain.handle('api:updateConfig', async (event, configId, configData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/config/${configId}`, configData);
    return response.data;
  } catch (error) {
    console.error(`Error updating configuration ${configId}:`, error);
    throw error;
  }
});

ipcMain.handle('api:deleteConfig', async (event, configId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/config/${configId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting configuration ${configId}:`, error);
    throw error;
  }
});

ipcMain.handle('api:generateDatabase', async (event, data) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/generate`, data);
    return response.data;
  } catch (error) {
    console.error('Error generating database:', error);
    throw error;
  }
});

ipcMain.handle('api:runSimulation', async (event, data) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/simulate`, data);
    return response.data;
  } catch (error) {
    console.error('Error running simulation:', error);
    throw error;
  }
});

ipcMain.handle('api:generateAndSimulate', async (event, data) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/generate-simulate`, data);
    return response.data;
  } catch (error) {
    console.error('Error in generate and simulate:', error);
    throw error;
  }
});

// App lifecycle events
app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Kill the backend process when the app is closing
  if (backendProcess) {
    console.log('Terminating backend process...');
    backendProcess.kill();
    backendProcess = null;
  }
}); 