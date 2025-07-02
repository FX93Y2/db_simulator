const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

// API Base URL for the Python backend
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
let backendProcess = null;

// Global flag to track backend status
let isBackendReady = false;

// Simple cache for GET requests
const apiCache = {};
const CACHE_EXPIRY = 10000; // 10 seconds in ms

// Helper function to get application paths
function getAppPaths() {
  // Get user data path - this is where app-specific data should be stored
  const userDataPath = app.getPath('userData');
  
  // Base paths for various app resources
  const paths = {
    // Output directory for database and simulation results
    output: app.isPackaged 
      ? path.join(userDataPath, 'output') 
      : path.join(path.dirname(app.getAppPath()), 'output'),
    
    // Config database location
    configDb: app.isPackaged
      ? path.join(userDataPath, 'config', 'configs.db')
      : path.join(path.dirname(app.getAppPath()), 'python', 'config_storage', 'configs.db'),
    
    // Python executable and script paths
    python: app.isPackaged 
      ? path.join(process.resourcesPath, 'python', 'venv', 'Scripts', 'python.exe')
      : 'python',
    
    pythonScript: app.isPackaged
      ? path.join(process.resourcesPath, 'python', 'main.py')
      : path.join(__dirname, '..', 'python', 'main.py')
  };
  
  // Check if we're on Windows and adjust Python path if needed
  if (process.platform === 'win32' && app.isPackaged) {
    // First check if python.exe exists, if not use python without .exe
    const pythonExe = path.join(process.resourcesPath, 'python', 'venv', 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExe)) {
      // Try without .exe
      const pythonNoExe = path.join(process.resourcesPath, 'python', 'venv', 'Scripts', 'python');
      if (fs.existsSync(pythonNoExe)) {
        paths.python = pythonNoExe;
      } else {
        // If neither exists, check in bin directory
        const pythonBin = path.join(process.resourcesPath, 'python', 'venv', 'bin', 'python');
        if (fs.existsSync(pythonBin)) {
          paths.python = pythonBin;
        } else {
          // Last resort, try Python directly
          paths.python = 'python';
          console.warn('Could not find packaged Python executable, using system Python');
        }
      }
    }
  }
  
  // Create directories if they don't exist
  if (app.isPackaged) {
    const configDir = path.dirname(paths.configDb);
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
        console.log(`Created config directory: ${configDir}`);
      } catch (err) {
        console.error(`Error creating config directory: ${err.message}`);
      }
    }
    
    if (!fs.existsSync(paths.output)) {
      try {
        fs.mkdirSync(paths.output, { recursive: true });
        console.log(`Created output directory: ${paths.output}`);
      } catch (err) {
        console.error(`Error creating output directory: ${err.message}`);
        // Try fallback to temp directory
        try {
          paths.output = path.join(app.getPath('temp'), 'db_simulator', 'output');
          fs.mkdirSync(paths.output, { recursive: true });
          console.log(`Created fallback output directory: ${paths.output}`);
        } catch (fallbackErr) {
          console.error(`Error creating fallback output directory: ${fallbackErr.message}`);
        }
      }
    }
  } else {
    // In development mode, ensure the output directory exists at project root
    const projectRoot = path.dirname(app.getAppPath());
    const outputDir = path.join(projectRoot, 'output');
    
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created development output directory: ${outputDir}`);
      } catch (err) {
        console.error(`Error creating development output directory: ${err.message}`);
      }
    }
  }
  
  // Check if the output directory is writable
  try {
    const testFile = path.join(paths.output, '.write_test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`Output directory is writable: ${paths.output}`);
  } catch (err) {
    console.error(`Output directory is not writable: ${err.message}`);
    // Try to create a fallback directory if not already using fallback
    if (!paths.output.includes('temp')) {
      try {
        const fallbackOutput = path.join(app.getPath('temp'), 'db_simulator', 'output');
        fs.mkdirSync(fallbackOutput, { recursive: true });
        paths.output = fallbackOutput;
        console.log(`Switched to fallback output directory: ${paths.output}`);
      } catch (fallbackErr) {
        console.error(`Error setting up fallback output directory: ${fallbackErr.message}`);
      }
    }
  }
  
  console.log('Application paths:');
  Object.entries(paths).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
  
  return paths;
}

// Get application paths
const appPaths = getAppPaths();

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // backgroundColor: '#2a2a2a', // Set default dark background - Removed to test focus issue
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove the default application menu
  mainWindow.setMenu(null);

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.jsdelivr.net/npm/* https://unpkg.com/*; " +
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.jsdelivr.net/npm/* https://unpkg.com/*; " +
          "font-src 'self' https://cdn.jsdelivr.net https://cdn.jsdelivr.net/npm/* https://unpkg.com/*; " +
          "img-src 'self' data: blob:; " +
          "connect-src 'self' http://localhost:* http://127.0.0.1:*; " +
          "worker-src 'self' blob:;"
        ]
      }
    });
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Replace direct DevTools opening with a context menu
  mainWindow.webContents.on('context-menu', (event, params) => {
    // Only show menu in development
    if (!app.isPackaged) {
      const template = [
        {
          label: 'Inspect Element',
          click: () => {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          click: () => {
            mainWindow.webContents.reload();
          }
        }
      ];
      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: mainWindow, x: params.x, y: params.y });
    }
  });

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start the Python backend
function startBackend() {
  if (process.env.NODE_ENV === 'development') {
    console.log('Running in development mode, not starting backend (using npm run dev instead)');
    return;
  }
  
  try {
    console.log('Starting Python backend...');
    
    // Check if we should use the PyInstaller executable or copied Python environment
    const useExecutablePath = app.isPackaged
      ? path.join(process.resourcesPath, 'python', 'USE_EXECUTABLE')
      : path.join(__dirname, '..', 'python', 'USE_EXECUTABLE');
    
    const useExecutable = fs.existsSync(useExecutablePath);
    
    if (useExecutable) {
      console.log('Using PyInstaller-generated executable');
      startBackendWithExecutable();
    } else {
      console.log('Using copied Python environment (PyInstaller was not successful)');
      startBackendWithPython();
    }
  } catch (error) {
    console.error('Error starting Python backend:', error);
    
    // If the primary method fails, try the fallback
    try {
      console.log('Trying fallback method to start backend...');
      if (backendProcess) return; // Avoid starting multiple processes
      
      const useExecutableFallback = fs.existsSync(path.join(process.resourcesPath, 'python', 'USE_EXECUTABLE'));
      if (useExecutableFallback) {
        startBackendWithExecutable();
      } else {
        startBackendWithPython();
      }
    } catch (fallbackError) {
      console.error('Error with fallback method:', fallbackError);
    }
  }
}

// Start backend using PyInstaller-generated executable
function startBackendWithExecutable() {
  // Use the PyInstaller executable in packaged mode
  let backendExePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'python', 'dist', 'db_simulator_api', 'db_simulator_api.exe')
    : path.join(__dirname, '..', 'python', 'dist', 'db_simulator_api', 'db_simulator_api.exe');
  
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

// Start backend using Python directly
function startBackendWithPython() {
  console.log('Starting backend with Python directly...');
  
  // Determine correct Python path for packaged app
  let pythonExePath = 'python'; // First try system Python
  let pythonScriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'python', 'main.py')
    : path.join(__dirname, '..', 'python', 'main.py');
  
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

// Common process handler setup
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
  });
  
  // Wait for backend to start
  checkBackendStatus(30); // Try for 30 seconds
}

// Function to check if backend is ready
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
      setTimeout(() => checkBackendStatus(maxTries - 1), 1000);
    });
}

// Helper function to make API requests
async function makeApiRequest(method, endpoint, data = null) {
  try {
    // Make sure backend is up and running
    await waitForBackend();
    
    const url = `${API_BASE_URL}/${endpoint}`;
    let response;
    
    // For GET requests, check the cache first
    if (method === 'GET') {
      const cacheKey = `${method}:${url}:${JSON.stringify(data || {})}`;
      const cachedResponse = apiCache[cacheKey];
      
      if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_EXPIRY) {
        // Only log cache hits in development when debugging
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_CACHE) {
          console.log(`Using cached response for ${method} ${url}`);
        }
        return cachedResponse.data;
      }
      
      response = await axios.get(url, { params: data });
      
      // Cache the response
      apiCache[cacheKey] = {
        data: response.data,
        timestamp: Date.now()
      };
    } else if (method === 'POST') {
      response = await axios.post(url, data);
      // Invalidate GET caches for this endpoint
      Object.keys(apiCache).forEach(key => {
        if (key.includes(endpoint)) {
          delete apiCache[key];
        }
      });
    } else if (method === 'PUT') {
      response = await axios.put(url, data);
      // Invalidate GET caches for this endpoint
      Object.keys(apiCache).forEach(key => {
        if (key.includes(endpoint)) {
          delete apiCache[key];
        }
      });
    } else if (method === 'DELETE') {
      response = await axios.delete(url, { data });
      // Invalidate all caches
      Object.keys(apiCache).forEach(key => {
        delete apiCache[key];
      });
    }
    
    return response.data;
  } catch (error) {
    console.error(`API ${method} request to ${endpoint} failed:`, error.message);
    if (error.response) {
      return { 
        success: false, 
        error: error.response.data.error || 'API request failed' 
      };
    }
    return { success: false, error: error.message || 'API request failed' };
  }
}

// Check if backend is ready and wait for it if needed
async function waitForBackend() {
  if (isBackendReady) {
    return true;
  }
  
  const maxRetries = 3;
  const retryDelay = 300; // ms
  
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
      console.log(`Backend not ready yet, waiting ${retryDelay}ms...`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  console.error('Backend failed to start or is not responding');
  // Continue anyway since some endpoints might still work
  return true;
}

// IPC Handlers

// Project Management
ipcMain.handle('api:getProjects', async () => {
  return await makeApiRequest('GET', 'projects');
});

ipcMain.handle('api:getProject', async (_, projectId) => {
  return await makeApiRequest('GET', `projects/${projectId}`);
});

ipcMain.handle('api:createProject', async (_, projectData) => {
  return await makeApiRequest('POST', 'projects', projectData);
});

ipcMain.handle('api:updateProject', async (_, projectId, projectData) => {
  return await makeApiRequest('PUT', `projects/${projectId}`, projectData);
});

ipcMain.handle('api:deleteProject', async (_, projectId) => {
  try {
    // First delete the project database entry
    const result = await makeApiRequest('DELETE', `projects/${projectId}`);
    
    // If successful, also clean up the project's output directory
    if (result.success) {
      // Build the path to the project's output directory
      const projectOutputDir = path.resolve(path.dirname(app.getAppPath()), 'output', projectId);
      
      // Check if the directory exists
      if (fs.existsSync(projectOutputDir)) {
        console.log(`Cleaning up project output directory: ${projectOutputDir}`);
        
        try {
          // Get all files in the directory
          const files = fs.readdirSync(projectOutputDir);
          
          // Delete each file
          for (const file of files) {
            const filePath = path.join(projectOutputDir, file);
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
          }
          
          // Delete the directory itself
          fs.rmdirSync(projectOutputDir);
          console.log(`Deleted project output directory: ${projectOutputDir}`);
        } catch (cleanupError) {
          console.error(`Error cleaning up project files: ${cleanupError.message}`);
          // Don't fail the operation if cleanup fails
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error deleting project: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Project Configuration Management
ipcMain.handle('api:getProjectDbConfig', async (_, projectId) => {
  return await makeApiRequest('GET', `projects/${projectId}/db-config`);
});

ipcMain.handle('api:saveProjectDbConfig', async (_, projectId, configData) => {
  return await makeApiRequest('POST', `projects/${projectId}/db-config`, configData);
});

ipcMain.handle('api:getProjectSimConfig', async (_, projectId) => {
  return await makeApiRequest('GET', `projects/${projectId}/sim-config`);
});

ipcMain.handle('api:saveProjectSimConfig', async (_, projectId, configData) => {
  return await makeApiRequest('POST', `projects/${projectId}/sim-config`, configData);
});

// Standalone Configuration Management
ipcMain.handle('api:getConfigs', async (_, configType) => {
  return await makeApiRequest('GET', 'configs', { type: configType });
});

ipcMain.handle('api:getConfig', async (_, configId) => {
  return await makeApiRequest('GET', `configs/${configId}`);
});

ipcMain.handle('api:saveConfig', async (_, configData) => {
  return await makeApiRequest('POST', 'configs', configData);
});

ipcMain.handle('api:updateConfig', async (_, configId, configData) => {
  return await makeApiRequest('PUT', `configs/${configId}`, configData);
});

ipcMain.handle('api:deleteConfig', async (_, configId) => {
  return await makeApiRequest('DELETE', `configs/${configId}`);
});

ipcMain.handle('api:clearConfigs', async (_, includeProjectConfigs = true) => {
  return await makeApiRequest('POST', 'configs/clear', { include_project_configs: includeProjectConfigs });
});

// Database Generation
ipcMain.handle('api:generateDatabase', async (_, data) => {
  try {
    // Make sure project_id is included in the data for project-specific storage
    if (data.project_id) {
      console.log(`Generating database for project: ${data.project_id}`);
      
      // Create project-specific directory if it doesn't exist
      if (app.isPackaged) {
        const projectDir = path.join(appPaths.output, data.project_id);
        if (!fs.existsSync(projectDir)) {
          fs.mkdirSync(projectDir, { recursive: true });
          console.log(`Created project output directory: ${projectDir}`);
        }
      }
    }
    
    // Pass the request to the backend API
    return await makeApiRequest('POST', 'generate-database', data);
  } catch (error) {
    console.error(`Error generating database: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Simulation
ipcMain.handle('api:runSimulation', async (_, data) => {
  return await makeApiRequest('POST', 'run-simulation', data);
});

ipcMain.handle('api:generateAndSimulate', async (_, data) => {
  return await makeApiRequest('POST', 'generate-and-simulate', data);
});

// Results Management
ipcMain.handle('api:getSimulationResults', async (_, databasePath) => {
  try {
    console.log(`[getSimulationResults] Checking database at path: ${databasePath}`);
    
    // Try to resolve the database path
    let resolvedPath = databasePath;
    
    // Check if this is a project-specific database path (output/project_id/filename.db)
    const isProjectPath = databasePath.startsWith('output/') && databasePath.split('/').length > 2;
    
    // Try multiple locations to find the database file
    const possiblePaths = [];
    
    if (isProjectPath) {
      // For project-specific paths, prioritize the appPaths.output directory
      const pathParts = databasePath.split('/');
      const projectId = pathParts[1];
      const dbFilename = pathParts[2];
      
      console.log(`[getSimulationResults] Detected project path with projectId=${projectId}, filename=${dbFilename}`);
      
      // Add the app's managed output directory path
      possiblePaths.push(path.join(appPaths.output, projectId, dbFilename));
    }
    
    // Add more general paths as fallbacks
    possiblePaths.push(
      databasePath,                                       // Original path as-is
      path.resolve(app.getPath('userData'), databasePath), // User data directory
      path.resolve(process.cwd(), databasePath),          // Current working directory
      path.resolve(app.getAppPath(), databasePath),       // App directory
      path.resolve(path.dirname(app.getAppPath()), databasePath) // Project root directory
    );
    
    console.log('[getSimulationResults] Checking these possible database paths:');
    for (const p of possiblePaths) {
      console.log(` - ${p}`);
      if (fs.existsSync(p)) {
        resolvedPath = p;
        console.log(`[getSimulationResults] Found database at: ${resolvedPath}`);
        break;
      }
    }
    
    // If no path is found, check if the output directory exists and list its contents
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[getSimulationResults] Database not found at any resolved path`);
      
      // If this is a project path, check if the project directory exists
      if (isProjectPath) {
        const pathParts = databasePath.split('/');
        const projectId = pathParts[1];
        const projectDir = path.join(appPaths.output, projectId);
        
        if (fs.existsSync(projectDir)) {
          console.log(`[getSimulationResults] Project directory exists at: ${projectDir}`);
          console.log(`[getSimulationResults] Contents of project directory:`);
          const files = fs.readdirSync(projectDir);
          files.forEach(file => {
            const filePath = path.join(projectDir, file);
            const stats = fs.statSync(filePath);
            console.log(` - ${file} (${stats.size} bytes)`);
          });
        } else {
          console.log(`[getSimulationResults] Project directory does not exist: ${projectDir}`);
        }
      }
      
      return { success: false, error: 'Database file not found' };
    }
    
    console.log(`[getSimulationResults] Using database at: ${resolvedPath}`);
    
    // Get file stats and basic info
    const stats = fs.statSync(resolvedPath);
    const creationDate = new Date(stats.birthtime).toISOString();
    
    // Try to open the database to verify it's valid and get more info
    const Database = require('better-sqlite3');
    let tableCount = 0;
    let recordCount = 0;
    
    let db = null;
    try {
      db = new Database(resolvedPath, { readonly: true });
      
      // Count tables
      const tablesResult = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      tableCount = tablesResult.length;
      
      // Count records in a few key tables if they exist
      const commonTables = ['sim_event_processing', 'Project', 'Consultant', 'Task'];
      for (const table of commonTables) {
        try {
          const count = db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get();
          if (count) {
            recordCount += count.count;
          }
        } catch (e) {
          // Table might not exist, continue to next table
        }
      }
      
    } catch (dbError) {
      console.error(`[getSimulationResults] Error opening database: ${dbError.message}`);
    } finally {
      // ALWAYS close the database connection to prevent EBUSY errors on Windows
      if (db) {
        try {
          db.close();
          console.log(`[getSimulationResults] Database connection closed for: ${resolvedPath}`);
        } catch (closeError) {
          console.error(`[getSimulationResults] Error closing database: ${closeError.message}`);
        }
      }
    }
    
    return {
      success: true,
      data: {
        simulationId: path.basename(resolvedPath, '.db'),
        runDate: creationDate,
        duration: 30, // Default value
        entitiesCount: recordCount || 100, // Use actual count or default
        eventsCount: tableCount || 5,     // Use table count or default
        fileSize: stats.size,
        tableCount: tableCount
      }
    };
  } catch (error) {
    console.error(`[getSimulationResults] Error getting simulation results: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Add new API endpoint to scan for simulation results in a project folder
ipcMain.handle('api:scanProjectResults', async (_, projectId) => {
  try {
    console.log(`Scanning for simulation results in project: ${projectId}`);
    
    // Determine the output directory for this project using appPaths
    // This ensures we're using the correct directory in packaged mode
    const projectOutputDir = path.join(appPaths.output, projectId);
    
    console.log(`Checking project output directory: ${projectOutputDir}`);
    
    // Check if the directory exists
    if (!fs.existsSync(projectOutputDir)) {
      console.log(`Project output directory does not exist: ${projectOutputDir}`);
      return { success: true, results: [] };
    }
    
    // Get all .db files in the directory
    const files = fs.readdirSync(projectOutputDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(projectOutputDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          id: file.replace('.db', ''),
          name: file.replace('.db', ''),
          path: `output/${projectId}/${file}`,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created - a.created); // Sort by creation date, newest first
    
    console.log(`Found ${files.length} database files in ${projectOutputDir}`);
    if (files.length > 0) {
      console.log(`First result path: ${files[0].path}`);
    }
    
    return { 
      success: true, 
      results: files 
    };
  } catch (error) {
    console.error(`Error scanning for simulation results: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:getDatabaseTables', async (_, databasePath) => {
  try {
    console.log(`[getDatabaseTables] Getting tables from database at path: ${databasePath}`);
    
    // Try to resolve the database path
    let resolvedPath = databasePath;
    
    // Check if this is a project-specific database path (output/project_id/filename.db)
    const isProjectPath = databasePath.startsWith('output/') && databasePath.split('/').length > 2;
    
    // Try multiple locations to find the database file
    const possiblePaths = [];
    
    if (isProjectPath) {
      // For project-specific paths, prioritize the appPaths.output directory
      const pathParts = databasePath.split('/');
      const projectId = pathParts[1];
      const dbFilename = pathParts[2];
      
      console.log(`[getDatabaseTables] Detected project path with projectId=${projectId}, filename=${dbFilename}`);
      
      // Add the app's managed output directory path
      possiblePaths.push(path.join(appPaths.output, projectId, dbFilename));
    }
    
    // Add more general paths as fallbacks
    possiblePaths.push(
      databasePath,                                       // Original path as-is
      path.resolve(app.getPath('userData'), databasePath), // User data directory
      path.resolve(process.cwd(), databasePath),          // Current working directory
      path.resolve(app.getAppPath(), databasePath),       // App directory
      path.resolve(path.dirname(app.getAppPath()), databasePath) // Project root directory
    );
    
    console.log('[getDatabaseTables] Checking these possible database paths:');
    for (const p of possiblePaths) {
      console.log(` - ${p}`);
      if (fs.existsSync(p)) {
        resolvedPath = p;
        console.log(`[getDatabaseTables] Found database at: ${resolvedPath}`);
        break;
      }
    }
    
    // If no path is found, check if the output directory exists and list its contents
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[getDatabaseTables] Database not found at any resolved path`);
      
      // If this is a project path, check if the project directory exists
      if (isProjectPath) {
        const pathParts = databasePath.split('/');
        const projectId = pathParts[1];
        const projectDir = path.join(appPaths.output, projectId);
        
        if (fs.existsSync(projectDir)) {
          console.log(`[getDatabaseTables] Project directory exists at: ${projectDir}`);
          console.log(`[getDatabaseTables] Contents of project directory:`);
          const files = fs.readdirSync(projectDir);
          files.forEach(file => {
            const filePath = path.join(projectDir, file);
            const stats = fs.statSync(filePath);
            console.log(` - ${file} (${stats.size} bytes)`);
          });
        } else {
          console.log(`[getDatabaseTables] Project directory does not exist: ${projectDir}`);
        }
      }
      
      return { success: false, error: 'Database file not found' };
    }
    
    console.log(`[getDatabaseTables] Using database at: ${resolvedPath}`);
    
    // Query for all table names using better-sqlite3
    const Database = require('better-sqlite3');
    const db = new Database(resolvedPath, { readonly: true });
    
    try {
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      const tables = rows.map(row => row.name);
      console.log(`[getDatabaseTables] Found ${tables.length} tables: ${tables.join(', ')}`);
      db.close();
      return { success: true, tables };
    } catch (err) {
      console.error(`[getDatabaseTables] Error querying database tables: ${err.message}`);
      db.close();
      return { success: false, error: err.message };
    }
  } catch (error) {
    console.error(`[getDatabaseTables] Error getting database tables: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:getTableData', async (_, params) => {
  try {
    const { databasePath, tableName, limit = 1000 } = params;
    console.log(`[getTableData] Getting data from table ${tableName} in database at path: ${databasePath}`);
    
    // Try to resolve the database path
    let resolvedPath = databasePath;
    
    // Check if this is a project-specific database path (output/project_id/filename.db)
    const isProjectPath = databasePath.startsWith('output/') && databasePath.split('/').length > 2;
    
    // Try multiple locations to find the database file
    const possiblePaths = [];
    
    if (isProjectPath) {
      // For project-specific paths, prioritize the appPaths.output directory
      const pathParts = databasePath.split('/');
      const projectId = pathParts[1];
      const dbFilename = pathParts[2];
      
      console.log(`[getTableData] Detected project path with projectId=${projectId}, filename=${dbFilename}`);
      
      // Add the app's managed output directory path
      possiblePaths.push(path.join(appPaths.output, projectId, dbFilename));
    }
    
    // Add more general paths as fallbacks
    possiblePaths.push(
      databasePath,                                       // Original path as-is
      path.resolve(app.getPath('userData'), databasePath), // User data directory
      path.resolve(process.cwd(), databasePath),          // Current working directory
      path.resolve(app.getAppPath(), databasePath),       // App directory
      path.resolve(path.dirname(app.getAppPath()), databasePath) // Project root directory
    );
    
    console.log('[getTableData] Checking these possible database paths:');
    for (const p of possiblePaths) {
      console.log(` - ${p}`);
      if (fs.existsSync(p)) {
        resolvedPath = p;
        console.log(`[getTableData] Found database at: ${resolvedPath}`);
        break;
      }
    }
    
    // If no path is found, check if the output directory exists and list its contents
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[getTableData] Database not found at any resolved path`);
      
      // If this is a project path, check if the project directory exists
      if (isProjectPath) {
        const pathParts = databasePath.split('/');
        const projectId = pathParts[1];
        const projectDir = path.join(appPaths.output, projectId);
        
        if (fs.existsSync(projectDir)) {
          console.log(`[getTableData] Project directory exists at: ${projectDir}`);
          console.log(`[getTableData] Contents of project directory:`);
          const files = fs.readdirSync(projectDir);
          files.forEach(file => {
            const filePath = path.join(projectDir, file);
            const stats = fs.statSync(filePath);
            console.log(` - ${file} (${stats.size} bytes)`);
          });
        } else {
          console.log(`[getTableData] Project directory does not exist: ${projectDir}`);
        }
      }
      
      return { success: false, error: 'Database file not found' };
    }
    
    console.log(`[getTableData] Using database at: ${resolvedPath} to query table: ${tableName}`);
    
    // Query for table data using better-sqlite3
    const Database = require('better-sqlite3');
    const db = new Database(resolvedPath, { readonly: true });
    
    try {
      const rows = db.prepare(`SELECT * FROM "${tableName}" LIMIT ${limit}`).all();
      console.log(`[getTableData] Retrieved ${rows.length} rows from table ${tableName}`);
      db.close();
      return { success: true, data: rows };
    } catch (err) {
      console.error(`[getTableData] Error querying table data: ${err.message}`);
      db.close();
      return { success: false, error: err.message };
    }
  } catch (error) {
    console.error(`[getTableData] Error getting table data: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:exportDatabaseToCSV', async (_, databasePath, customExportPath = null) => {
  try {
    console.log(`Exporting database at path: ${databasePath} to CSV`);
    if (customExportPath) {
      console.log(`Using custom export path: ${customExportPath}`);
    }
    
    // Try to resolve the database path using the new appPaths
    let resolvedPath = databasePath;
    
    // Try multiple locations to find the database file with priority for packaged paths
    const possiblePaths = [];
    
    // If the path starts with 'output/', it's likely a relative path to our output directory
    if (databasePath.startsWith('output/')) {
      // For a packaged app, prioritize the user data output directory
      if (app.isPackaged) {
        possiblePaths.push(path.join(appPaths.output, databasePath.replace('output/', '')));
      } else {
        possiblePaths.push(path.join(appPaths.output, databasePath.replace('output/', '')));
        possiblePaths.push(path.resolve(path.dirname(app.getAppPath()), databasePath));
      }
    } else {
      // For absolute or other relative paths
      possiblePaths.push(databasePath);                                    // Original path
      possiblePaths.push(path.resolve(app.getPath('userData'), databasePath)); // User data directory
      possiblePaths.push(path.resolve(process.cwd(), databasePath));       // Current working directory
      possiblePaths.push(path.resolve(app.getAppPath(), databasePath));    // App directory
    }
    
    console.log('Checking these possible database paths:');
    for (const p of possiblePaths) {
      console.log(` - ${p}`);
      if (fs.existsSync(p)) {
        resolvedPath = p;
        console.log(`Found database at: ${resolvedPath}`);
        break;
      }
    }
    
    // Check if database exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Database not found at any resolved path`);
      return { success: false, error: 'Database file not found' };
    }
    
    console.log(`Using database at: ${resolvedPath} for CSV export`);
    
    // Determine export directory - use custom path if provided
    let exportBaseDir;
    
    if (customExportPath) {
      // Validate the custom export path
      try {
        // Check if the directory exists, create it if it doesn't
        if (!fs.existsSync(customExportPath)) {
          fs.mkdirSync(customExportPath, { recursive: true });
          console.log(`Created custom export directory: ${customExportPath}`);
        }
        
        // Check if the directory is writable
        try {
          const testFile = path.join(customExportPath, '.write_test');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          console.log(`Custom export directory is writable: ${customExportPath}`);
          exportBaseDir = customExportPath;
        } catch (writeError) {
          console.error(`Custom export directory is not writable: ${writeError.message}`);
          return { success: false, error: 'Selected directory is not writable. Please choose a different directory.' };
        }
      } catch (dirError) {
        console.error(`Error with custom export directory: ${dirError.message}`);
        return { success: false, error: `Cannot use selected directory: ${dirError.message}` };
      }
    } else {
      // Use default exports directory
      exportBaseDir = path.join(appPaths.output, 'exports');
      console.log(`Using default export directory at: ${exportBaseDir}`);
      
      // Create default export directory if it doesn't exist
      if (!fs.existsSync(exportBaseDir)) {
        fs.mkdirSync(exportBaseDir, { recursive: true });
        console.log(`Created default export directory: ${exportBaseDir}`);
      }
    }
    
    // Create a subdirectory for this database export with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbName = path.basename(resolvedPath, '.db');
    const exportFolderName = `${dbName}_export_${timestamp}`;
    const exportDir = path.join(exportBaseDir, exportFolderName);
    
    // Create the export folder
    try {
      fs.mkdirSync(exportDir, { recursive: true });
      console.log(`Created export subfolder: ${exportDir}`);
    } catch (folderError) {
      console.error(`Error creating export subfolder: ${folderError.message}`);
      return { success: false, error: `Failed to create export folder: ${folderError.message}` };
    }
    
    // Get all tables using better-sqlite3
    const Database = require('better-sqlite3');
    let db = null;
    
    try {
      db = new Database(resolvedPath, { readonly: true });
      // Get all tables in the database
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      
      if (tables.length === 0) {
        console.error('No tables found in database');
        return { success: false, error: 'No tables found in database' };
      }
      
      console.log(`Found ${tables.length} tables to export: ${tables.map(t => t.name).join(', ')}`);
      
      // Export each table to its own CSV file
      const exportedFiles = [];
      let totalRowsExported = 0;
      
      for (const table of tables) {
        const tableName = table.name;
        console.log(`Exporting table: ${tableName}`);
        
        // Generate file name for this table
        const tableFileName = `${tableName}.csv`;
        const tableFilePath = path.join(exportDir, tableFileName);
        
        // Get all rows from the table
        const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
        
        if (rows.length === 0) {
          console.log(`Table ${tableName} has no data, creating empty CSV file`);
          // Create empty file with just headers if table exists but has no rows
          const columns = [];
          try {
            // Try to get column info
            const columnInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all();
            if (columnInfo.length > 0) {
              columnInfo.forEach(col => columns.push(col.name));
            }
          } catch (e) {
            console.error(`Error getting column info for empty table ${tableName}: ${e.message}`);
          }
          
          // Write header row only
          fs.writeFileSync(tableFilePath, columns.join(',') + '\n');
          exportedFiles.push({
            table: tableName,
            path: tableFilePath,
            rows: 0
          });
          continue;
        }
        
        // Get headers from the first row
        const headers = Object.keys(rows[0]);
        
        // Create CSV content
        const csvContent = [
          headers.join(','),
          ...rows.map(row => headers.map(header => {
            // Ensure proper CSV formatting (escape commas, quotes, etc.)
            const value = row[header];
            if (value === null || value === undefined) return '';
            const str = String(value);
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          }).join(','))
        ].join('\n');
        
        // Write CSV file
        fs.writeFileSync(tableFilePath, csvContent);
        
        console.log(`Exported ${rows.length} rows from table ${tableName} to ${tableFilePath}`);
        totalRowsExported += rows.length;
        
        exportedFiles.push({
          table: tableName,
          path: tableFilePath,
          rows: rows.length
        });
      }
      
      // Create a summary file with metadata
      const summaryPath = path.join(exportDir, '_summary.json');
      const summary = {
        database: dbName,
        exportedAt: new Date().toISOString(),
        tables: exportedFiles.map(f => ({
          name: f.table,
          rows: f.rows,
          file: path.basename(f.path)
        })),
        totalTables: exportedFiles.length,
        totalRows: totalRowsExported
      };
      
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      
      console.log(`Successfully exported ${tables.length} tables with ${totalRowsExported} total rows to ${exportDir}`);
      return { 
        success: true, 
        exportPath: exportDir,
        path: exportDir,  // For backward compatibility
        directory: exportBaseDir,
        tables: exportedFiles.length,
        files: exportedFiles.map(f => path.basename(f.path)),
        totalRows: totalRowsExported
      };
    } catch (err) {
      console.error(`Error exporting database: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      // ALWAYS close the database connection to prevent EBUSY errors on Windows
      if (db) {
        try {
          db.close();
          console.log(`[exportDatabaseToCSV] Database connection closed for: ${resolvedPath}`);
        } catch (closeError) {
          console.error(`[exportDatabaseToCSV] Error closing database: ${closeError.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error exporting database: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// File Management
ipcMain.handle('api:openFile', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:saveFile', async (_, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add new API endpoint to delete a simulation result
ipcMain.handle('api:deleteResult', async (_, resultPath) => {
  try {
    console.log(`Deleting simulation result: ${resultPath}`);
    
    // Resolve the full path to the result file using the new appPaths
    let resolvedPath = resultPath;
    
    // Try multiple locations to find the result file with priority for packaged paths
    const possiblePaths = [];
    
    // If the path starts with 'output/', it's likely a relative path to our output directory
    if (resultPath.startsWith('output/')) {
      // For a packaged app, prioritize the user data output directory
      if (app.isPackaged) {
        possiblePaths.push(path.join(appPaths.output, resultPath.replace('output/', '')));
      } else {
        possiblePaths.push(path.join(appPaths.output, resultPath.replace('output/', '')));
        possiblePaths.push(path.resolve(path.dirname(app.getAppPath()), resultPath));
      }
    } else {
      // For absolute or other relative paths
      possiblePaths.push(resultPath);                                    // Original path
      possiblePaths.push(path.resolve(app.getPath('userData'), resultPath)); // User data directory
      possiblePaths.push(path.resolve(process.cwd(), resultPath));       // Current working directory
      possiblePaths.push(path.resolve(app.getAppPath(), resultPath));    // App directory
    }
    
    console.log('Checking these possible result paths:');
    for (const p of possiblePaths) {
      console.log(` - ${p}`);
      if (fs.existsSync(p)) {
        resolvedPath = p;
        console.log(`Found result file at: ${resolvedPath}`);
        break;
      }
    }
    
    // Ensure file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Result file not found at any resolved path`);
      return { success: false, error: 'Result file not found' };
    }
    
    // Delete the file
    fs.unlinkSync(resolvedPath);
    console.log(`Successfully deleted result file: ${resolvedPath}`);
    
    return { success: true };
  } catch (error) {
    console.error(`Error deleting result file: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Add function to show directory picker dialog
ipcMain.handle('api:showDirectoryPicker', async (_, options = {}) => {
  try {
    const defaultPath = options.defaultPath || app.getPath('documents');
    const title = options.title || 'Select Export Directory';
    
    console.log(`Showing directory picker dialog with default path: ${defaultPath}`);
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath,
      title,
      buttonLabel: options.buttonLabel || 'Select Folder'
    });
    
    if (result.canceled) {
      console.log('Directory selection was canceled');
      return { success: false, canceled: true };
    }
    
    const selectedPath = result.filePaths[0];
    console.log(`Selected directory: ${selectedPath}`);
    
    // Verify the directory is writable
    try {
      const testFile = path.join(selectedPath, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`Selected directory is writable: ${selectedPath}`);
    } catch (writeError) {
      console.error(`Selected directory is not writable: ${writeError.message}`);
      return { 
        success: false, 
        error: 'Selected directory is not writable. Please choose a different directory.',
        path: selectedPath
      };
    }
    
    return { success: true, path: selectedPath };
  } catch (error) {
    console.error(`Error showing directory picker: ${error.message}`);
    return { success: false, error: error.message };
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