const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

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

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

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
    const pythonPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'python', 'venv', 'bin', 'python')
      : 'python';
    
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'python', 'main.py')
      : path.join(__dirname, '..', 'python', 'main.py');
    
    backendProcess = spawn(pythonPath, [scriptPath, 'api'], {
      stdio: 'pipe'
    });
    
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
  } catch (error) {
    console.error('Error starting Python backend:', error);
  }
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
  return await makeApiRequest('POST', 'generate-database', data);
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
    console.log(`Checking database at path: ${databasePath}`);
    
    // Try to resolve the database path
    let resolvedPath = databasePath;
    
    // Try multiple locations to find the database file
    const possiblePaths = [
      databasePath,                                    // Original path
      path.resolve(process.cwd(), databasePath),       // Relative to CWD
      path.resolve(app.getAppPath(), databasePath),    // Relative to app path
      path.resolve(path.dirname(app.getAppPath()), databasePath) // Relative to project root
    ];
    
    // Add one more path for project root/output case
    const projectRoot = path.dirname(app.getAppPath());
    if (databasePath.startsWith('output/')) {
      possiblePaths.push(path.resolve(projectRoot, databasePath));
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
    
    // Ensure database exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Database not found at any resolved path`);
      return { success: false, error: 'Database file not found' };
    }
    
    console.log(`Using database at: ${resolvedPath}`);
    
    // We'll just return basic info for now - you can enhance this later
    const stats = fs.statSync(resolvedPath);
    const creationDate = new Date(stats.birthtime).toISOString();
    
    return {
      success: true,
      data: {
        simulationId: path.basename(resolvedPath, '.db'),
        runDate: creationDate,
        duration: 30, // Default value, could be extracted from DB in a real implementation
        entitiesCount: 100, // Default value, could be extracted from DB
        eventsCount: 250   // Default value, could be extracted from DB
      }
    };
  } catch (error) {
    console.error(`Error getting simulation results: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Add new API endpoint to scan for simulation results in a project folder
ipcMain.handle('api:scanProjectResults', async (_, projectId) => {
  try {
    console.log(`Scanning for simulation results in project: ${projectId}`);
    
    // Determine the output directory for this project
    const outputDir = path.resolve(path.dirname(app.getAppPath()), 'output', projectId);
    
    console.log(`Checking output directory: ${outputDir}`);
    
    // Check if the directory exists
    if (!fs.existsSync(outputDir)) {
      console.log(`Output directory does not exist: ${outputDir}`);
      return { success: true, results: [] };
    }
    
    // Get all .db files in the directory
    const files = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(outputDir, file);
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
    
    console.log(`Found ${files.length} database files`);
    
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
    console.log(`Getting tables from database at path: ${databasePath}`);
    
    // Try to resolve the database path using the same logic
    let resolvedPath = databasePath;
    
    // Try multiple locations to find the database file
    const possiblePaths = [
      databasePath,                                    // Original path
      path.resolve(process.cwd(), databasePath),       // Relative to CWD
      path.resolve(app.getAppPath(), databasePath),    // Relative to app path
      path.resolve(path.dirname(app.getAppPath()), databasePath) // Relative to project root
    ];
    
    // Add one more path for project root/output case
    const projectRoot = path.dirname(app.getAppPath());
    if (databasePath.startsWith('output/')) {
      possiblePaths.push(path.resolve(projectRoot, databasePath));
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
    
    console.log(`Using database at: ${resolvedPath}`);
    
    // Query for all table names using better-sqlite3
    const Database = require('better-sqlite3');
    const db = new Database(resolvedPath, { readonly: true });
    
    try {
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      const tables = rows.map(row => row.name);
      console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);
      db.close();
      return { success: true, tables };
    } catch (err) {
      console.error(`Error querying database tables: ${err.message}`);
      db.close();
      return { success: false, error: err.message };
    }
  } catch (error) {
    console.error(`Error getting database tables: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:getTableData', async (_, params) => {
  try {
    const { databasePath, tableName, limit = 1000 } = params;
    console.log(`Getting data from table ${tableName} in database at path: ${databasePath}`);
    
    // Try to resolve the database path using the same logic
    let resolvedPath = databasePath;
    
    // Try multiple locations to find the database file
    const possiblePaths = [
      databasePath,                                    // Original path
      path.resolve(process.cwd(), databasePath),       // Relative to CWD
      path.resolve(app.getAppPath(), databasePath),    // Relative to app path
      path.resolve(path.dirname(app.getAppPath()), databasePath) // Relative to project root
    ];
    
    // Add one more path for project root/output case
    const projectRoot = path.dirname(app.getAppPath());
    if (databasePath.startsWith('output/')) {
      possiblePaths.push(path.resolve(projectRoot, databasePath));
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
    
    console.log(`Using database at: ${resolvedPath} to query table: ${tableName}`);
    
    // Query for table data using better-sqlite3
    const Database = require('better-sqlite3');
    const db = new Database(resolvedPath, { readonly: true });
    
    try {
      const rows = db.prepare(`SELECT * FROM "${tableName}" LIMIT ${limit}`).all();
      console.log(`Retrieved ${rows.length} rows from table ${tableName}`);
      db.close();
      return { success: true, data: rows };
    } catch (err) {
      console.error(`Error querying table data: ${err.message}`);
      db.close();
      return { success: false, error: err.message };
    }
  } catch (error) {
    console.error(`Error getting table data: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api:exportDatabaseToCSV', async (_, databasePath) => {
  try {
    console.log(`Exporting database at path: ${databasePath} to CSV`);
    
    // Try to resolve the database path using the same logic
    let resolvedPath = databasePath;
    
    // Try multiple locations to find the database file
    const possiblePaths = [
      databasePath,                                    // Original path
      path.resolve(process.cwd(), databasePath),       // Relative to CWD
      path.resolve(app.getAppPath(), databasePath),    // Relative to app path
      path.resolve(path.dirname(app.getAppPath()), databasePath) // Relative to project root
    ];
    
    // Add one more path for project root/output case
    const projectRoot = path.dirname(app.getAppPath());
    if (databasePath.startsWith('output/')) {
      possiblePaths.push(path.resolve(projectRoot, databasePath));
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
    
    // Create output directory
    const exportDir = path.join(path.dirname(resolvedPath), 'exports');
    console.log(`Creating export directory at: ${exportDir}`);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Export file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbName = path.basename(resolvedPath, '.db');
    const exportPath = path.join(exportDir, `${dbName}_export_${timestamp}.csv`);
    console.log(`Will export to: ${exportPath}`);
    
    // Get all tables using better-sqlite3
    const Database = require('better-sqlite3');
    const db = new Database(resolvedPath, { readonly: true });
    
    try {
      // For this implementation, just export the first table
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1").all();
      
      if (tables.length === 0) {
        console.error('No tables found in database');
        db.close();
        return { success: false, error: 'No tables found in database' };
      }
      
      // Get data from the first table
      const tableName = tables[0].name;
      console.log(`Exporting data from table: ${tableName}`);
      const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
      db.close();
      
      if (rows.length === 0) {
        console.error('No data found in table');
        return { success: false, error: 'No data found in table' };
      }
      
      // Get headers
      const headers = Object.keys(rows[0]);
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
      
      fs.writeFileSync(exportPath, csvContent);
      console.log(`Successfully exported to: ${exportPath}`);
      return { success: true, exportPath };
    } catch (err) {
      console.error(`Error exporting database: ${err.message}`);
      db.close();
      return { success: false, error: err.message };
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
    
    // Resolve the full path to the result file
    let resolvedPath = resultPath;
    
    // Try multiple locations to find the database file
    const possiblePaths = [
      resultPath,                                   // Original path
      path.resolve(process.cwd(), resultPath),      // Relative to CWD
      path.resolve(app.getAppPath(), resultPath),   // Relative to app path
      path.resolve(path.dirname(app.getAppPath()), resultPath) // Relative to project root
    ];
    
    // Find the correct path
    for (const p of possiblePaths) {
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