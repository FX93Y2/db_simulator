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
  const exeName = process.platform === 'win32' ? 'db_simulator_api.exe' : 'db_simulator_api';
  let backendExePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'python', 'dist', 'db_simulator_api', exeName)
    : path.join(__dirname, '..', '..', '..', 'python', 'dist', 'db_simulator_api', exeName);
  
  // Log the path we're using
  console.log(`Backend executable path: ${backendExePath}`);
  
  // Check if the executable exists
  if (!fs.existsSync(backendExePath)) {
    console.error(`Backend executable not found at: ${backendExePath}`);
    console.error(`Current working directory: ${process.cwd()}`);
    console.error(`Resource path: ${process.resourcesPath}`);
    console.error(`Is packaged: ${app.isPackaged}`);

    // Try alternative paths if not found
    const alternativePaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'dist', 'db_simulator_api', exeName),
      path.join(process.cwd(), 'resources', 'python', 'dist', 'db_simulator_api', exeName)
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

  // Ensure MiniRacer ICU dependency exists in backend _internal folder
  try {
    const internalDir = path.join(process.resourcesPath, 'python', 'dist', 'db_simulator_api', '_internal');
    const icuTarget = path.join(internalDir, 'icudtl.dat');
    if (!fs.existsSync(icuTarget)) {
      const icuCandidates = [
        path.resolve(process.resourcesPath, '..', 'icudtl.dat'),
        path.join(process.resourcesPath, 'icudtl.dat')
      ];
      const icuSource = icuCandidates.find(p => fs.existsSync(p));
      if (icuSource) {
        try {
          fs.copyFileSync(icuSource, icuTarget);
          console.log(`Copied ICU data file to backend: ${icuTarget}`);
        } catch (copyErr) {
          console.warn('Failed to copy ICU data file for backend:', copyErr.message);
        }
      } else {
        console.warn('ICU data file (icudtl.dat) not found in Electron bundle; MiniRacer may fail.');
      }
    }
  } catch (prepErr) {
    console.warn('Error preparing MiniRacer ICU dependency:', prepErr.message);
  }

  // Ensure V8 snapshot files exist for MiniRacer
  try {
    const internalDir = path.join(process.resourcesPath, 'python', 'dist', 'db_simulator_api', '_internal');
    const files = ['snapshot_blob.bin', 'v8_context_snapshot.bin'];
    for (const fname of files) {
      const target = path.join(internalDir, fname);
      if (!fs.existsSync(target)) {
        const candidates = [
          path.resolve(process.resourcesPath, '..', fname),
          path.join(process.resourcesPath, fname)
        ];
        const src = candidates.find(p => fs.existsSync(p));
        if (src) {
          try {
            fs.copyFileSync(src, target);
            console.log(`Copied V8 file to backend: ${target}`);
          } catch (e) {
            console.warn(`Failed to copy ${fname} to backend:`, e.message);
          }
        } else {
          console.warn(`${fname} not found in Electron bundle; MiniRacer may fail.`);
        }
      }
    }
  } catch (e) {
    console.warn('Error preparing V8 snapshot files for backend:', e.message);
  }
  
  // Prepare log file for backend stdout/stderr
  const logsDir = path.join(appPaths.output, 'logs');
  try {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  } catch (e) {
    console.warn('Unable to create logs directory:', e.message);
  }
  const logFilePath = path.join(logsDir, 'backend.log');
  let logStream = null;
  try {
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    const banner = `\n==== Backend start ${new Date().toISOString()} ====${app.isPackaged ? ' [packaged]' : ''}\n`;
    logStream.write(banner);
  } catch (e) {
    console.warn('Unable to open backend log file:', e.message);
  }

  // Start the backend process
  console.log(`Spawning backend process: ${backendExePath} ${args.join(' ')}`);
  backendProcess = spawn(backendExePath, args, {
    stdio: 'pipe',
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1', // Unbuffered stdout/stderr for realtime logs
      DB_SIMULATOR_LOG_FILE: logFilePath
    }
  });

  // Pipe backend stdout/stderr to file and console
  if (backendProcess.stdout) {
    backendProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (logStream) logStream.write(text);
      process.stdout.write(`[backend] ${text}`);
    });
  }
  if (backendProcess.stderr) {
    backendProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (logStream) logStream.write(text);
      process.stderr.write(`[backend:err] ${text}`);
    });
  }

  setupBackendProcessHandlers();
}

/**
 * Start backend using Python directly
 * @param {Object} appPaths - Application paths object
 */
function startBackendWithPython(appPaths) {
  console.log('Starting backend with Python directly...');

  // Determine correct Python path for packaged app
  let pythonExePath = process.platform === 'darwin' ? 'python3' : 'python'; // Use python3 on macOS, python elsewhere
  let pythonScriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'python', 'main.py')
    : path.join(__dirname, '..', '..', '..', 'python', 'main.py');
  
  // Check if packaged Python exists and use it if available
  if (app.isPackaged) {
    const pythonBinDir = process.platform === 'win32' ? 'Scripts' : 'bin';
    const pythonExeName = process.platform === 'win32' ? 'python.exe' : 'python';
    const packagedPythonPath = path.join(process.resourcesPath, 'python', 'venv', pythonBinDir, pythonExeName);
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
    console.error(`Error code: ${err.code}`);
    console.error(`Error stack: ${err.stack}`);
    if (err.code === 'ENOENT') {
      console.error('Backend executable or Python not found.');
      console.error('This usually means the PyInstaller build failed or the executable is not in the expected location.');
    }
    // Notify the main window about backend failure
    const { getMainWindow } = require('./window');
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-error', {
        message: err.message,
        code: err.code
      });
    }
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      console.error(`Backend process exited unexpectedly with code ${code}`);
      // Notify the main window about backend closure
      const { getMainWindow } = require('./window');
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-closed', { code });
      }
    }
    backendProcess = null;
    isBackendReady = false;
    try { if (logStream) logStream.end(`\n==== Backend stop ${new Date().toISOString()} (code ${code}) ====`); } catch {}
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
