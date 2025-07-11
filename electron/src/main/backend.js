/**
 * Backend Management Module
 * Handles Python backend startup, process management, and health checking
 */

const { app } = require('electron');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { API_BASE_URL, BACKEND_CONFIG } = require('./config');

let backendProcess = null;
let isBackendReady = false;

/**
 * Start the Python backend
 * @param {Object} appPaths - Application paths object
 */
function startBackend(appPaths) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Running in development mode, not starting backend (using npm run dev instead)');
    return;
  }
  
  try {
    console.log('Starting Python backend...');
    
    // Check if we should use the PyInstaller executable or copied Python environment
    const useExecutablePath = app.isPackaged
      ? path.join(process.resourcesPath, 'python', 'USE_EXECUTABLE')
      : path.join(__dirname, '..', '..', '..', 'python', 'USE_EXECUTABLE');
    
    const useExecutable = fs.existsSync(useExecutablePath);
    
    if (useExecutable) {
      console.log('Using PyInstaller-generated executable');
      startBackendWithExecutable(appPaths);
    } else {
      console.log('Using copied Python environment (PyInstaller was not successful)');
      startBackendWithPython(appPaths);
    }
  } catch (error) {
    console.error('Error starting Python backend:', error);
    
    // If the primary method fails, try the fallback
    try {
      console.log('Trying fallback method to start backend...');
      if (backendProcess) return; // Avoid starting multiple processes
      
      const useExecutableFallback = fs.existsSync(path.join(process.resourcesPath, 'python', 'USE_EXECUTABLE'));
      if (useExecutableFallback) {
        startBackendWithExecutable(appPaths);
      } else {
        startBackendWithPython(appPaths);
      }
    } catch (fallbackError) {
      console.error('Error with fallback method:', fallbackError);
    }
  }
}

/**
 * Start backend using PyInstaller-generated executable
 * @param {Object} appPaths - Application paths object
 */
function startBackendWithExecutable(appPaths) {
  // Use the PyInstaller executable in packaged mode
  let backendExePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'python', 'dist', 'db_simulator_api', 'db_simulator_api.exe')
    : path.join(__dirname, '..', '..', '..', 'python', 'dist', 'db_simulator_api', 'db_simulator_api.exe');
  
  // Log the path we're using
  console.log(`Backend executable path: ${backendExePath}`);
  
  // Check if the executable exists
  if (!fs.existsSync(backendExePath)) {
    console.error(`Backend executable not found at: ${backendExePath}`);
    
    // Try alternative paths if not found
    const alternativePaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'dist', 'db_simulator_api', 'db_simulator_api.exe'),
      path.join(process.cwd(), 'resources', 'python', 'dist', 'db_simulator_api', 'db_simulator_api.exe')
    ];
    
    for (const altPath of alternativePaths) {
      console.log(`Checking alternative path: ${altPath}`);
      if (fs.existsSync(altPath)) {
        backendExePath = altPath;
        console.log(`Found backend executable at: ${backendExePath}`);
        break;
      }
    }
  }
  
  // Pass important paths to the backend as command line arguments
  const args = ['api', 
    '--output-dir', appPaths.output,
    '--config-db', appPaths.configDb,
    '--packaged', app.isPackaged ? 'true' : 'false'
  ];
  
  // Start the backend process
  console.log(`Spawning backend process: ${backendExePath} ${args.join(' ')}`);
  backendProcess = spawn(backendExePath, args, {
    stdio: 'pipe',
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1'  // Keep this for any internal Python components
    }
  });
  
  setupBackendProcessHandlers();
}

/**
 * Start backend using Python directly
 * @param {Object} appPaths - Application paths object
 */
function startBackendWithPython(appPaths) {
  console.log('Starting backend with Python directly...');
  
  // Determine correct Python path for packaged app
  let pythonExePath = 'python'; // First try system Python
  let pythonScriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'python', 'main.py')
    : path.join(__dirname, '..', '..', '..', 'python', 'main.py');
  
  // Check if packaged Python exists and use it if available
  if (app.isPackaged) {
    const packagedPythonPath = path.join(process.resourcesPath, 'python', 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(packagedPythonPath)) {
      pythonExePath = packagedPythonPath;
      console.log(`Using packaged Python: ${pythonExePath}`);
    } else {
      console.log('Packaged Python not found, using system Python');
    }
  }
  
  // Log the paths we're using
  console.log(`Python executable path: ${pythonExePath}`);
  console.log(`Python script path: ${pythonScriptPath}`);
  
  // Check if the Python script exists
  if (!fs.existsSync(pythonScriptPath)) {
    console.error(`Python script not found at: ${pythonScriptPath}`);
    
    // Try alternative paths
    const alternativePaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'main.py'),
      path.join(process.resourcesPath, 'python', 'main.py'),
      path.join(process.cwd(), 'resources', 'python', 'main.py')
    ];
    
    for (const altPath of alternativePaths) {
      console.log(`Checking alternative path: ${altPath}`);
      if (fs.existsSync(altPath)) {
        pythonScriptPath = altPath;
        console.log(`Found Python script at: ${pythonScriptPath}`);
        break;
      }
    }
  }
  
  // Pass important paths to the Python backend as environment variables
  const env = {
    ...process.env,
    DB_SIMULATOR_OUTPUT_DIR: appPaths.output,
    DB_SIMULATOR_CONFIG_DB: appPaths.configDb,
    DB_SIMULATOR_PACKAGED: app.isPackaged ? 'true' : 'false',
    PYTHONUNBUFFERED: '1'  // Make Python output unbuffered for better logging
  };
  
  console.log('Environment variables for Python backend:');
  Object.entries(env).forEach(([key, value]) => {
    if (key.startsWith('DB_SIMULATOR_')) {
      console.log(`- ${key}: ${value}`);
    }
  });
  
  // Start the backend process
  console.log(`Spawning Python process: ${pythonExePath} ${pythonScriptPath} api`);
  backendProcess = spawn(pythonExePath, [pythonScriptPath, 'api'], {
    stdio: 'pipe',
    env
  });
  
  setupBackendProcessHandlers();
}

/**
 * Common process handler setup for backend processes
 */
function setupBackendProcessHandlers() {
  // Log stdout from the process
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend stdout: ${data.toString().trim()}`);
  });
  
  // Log stderr from the process
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend stderr: ${data.toString().trim()}`);
  });
  
  backendProcess.on('error', (err) => {
    console.error(`Failed to start backend process: ${err.message}`);
    if (err.code === 'ENOENT') {
      console.error('Backend executable or Python not found.');
    }
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
    isBackendReady = false;
  });
  
  // Wait for backend to start
  checkBackendStatus(BACKEND_CONFIG.maxStartupTries);
}

/**
 * Function to check if backend is ready
 * @param {number} maxTries - Maximum number of tries
 */
function checkBackendStatus(maxTries = 30) {
  console.log(`Checking if backend is ready (remaining tries: ${maxTries})...`);
  
  // Exit if no more tries left
  if (maxTries <= 0) {
    console.error('Backend failed to start after multiple attempts');
    return;
  }
  
  // Try to connect to backend
  axios.get(`${API_BASE_URL}/health`, { timeout: 1000 })
    .then(response => {
      if (response.status === 200) {
        console.log('Backend API is ready!');
        isBackendReady = true;
      }
    })
    .catch(error => {
      console.log('Backend not ready yet, will retry in 1 second...');
      setTimeout(() => checkBackendStatus(maxTries - 1), BACKEND_CONFIG.retryDelay);
    });
}

/**
 * Check if backend is ready and wait for it if needed
 * @returns {Promise<boolean>} Promise that resolves when backend is ready
 */
async function waitForBackend() {
  if (isBackendReady) {
    return true;
  }
  
  const { maxRetries, retryDelayMs } = BACKEND_CONFIG;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Checking if backend is ready (attempt ${i + 1}/${maxRetries})...`);
      // Check /api/projects which is a working endpoint instead of root path
      const response = await axios.get(`${API_BASE_URL}/projects`);
      if (response.status === 200) {
        console.log('Backend is ready!');
        isBackendReady = true;
        return true;
      }
    } catch (error) {
      console.log(`Backend not ready yet, waiting ${retryDelayMs}ms...`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  console.error('Backend failed to start or is not responding');
  // Continue anyway since some endpoints might still work
  return true;
}

/**
 * Stop the backend process
 */
function stopBackend() {
  if (backendProcess) {
    console.log('Terminating backend process...');
    backendProcess.kill();
    backendProcess = null;
    isBackendReady = false;
  }
}

/**
 * Get backend status
 * @returns {boolean} True if backend is ready
 */
function getBackendStatus() {
  return isBackendReady;
}

/**
 * Get backend process
 * @returns {ChildProcess|null} Backend process or null
 */
function getBackendProcess() {
  return backendProcess;
}

module.exports = {
  startBackend,
  stopBackend,
  waitForBackend,
  getBackendStatus,
  getBackendProcess,
  checkBackendStatus
};