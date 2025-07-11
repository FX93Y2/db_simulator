/**
 * Path Management Module
 * Handles application path resolution, directory creation, and path validation
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Get application paths for various resources
 * @returns {Object} Object containing all application paths
 */
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
      : path.join(__dirname, '..', '..', 'python', 'main.py')
  };
  
  // Adjust Python path for different platforms
  adjustPythonPath(paths);
  
  // Create necessary directories
  createDirectories(paths);
  
  // Validate paths
  validatePaths(paths);
  
  console.log('Application paths:');
  Object.entries(paths).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
  
  return paths;
}

/**
 * Adjust Python executable path for different platforms
 * @param {Object} paths - Paths object to modify
 */
function adjustPythonPath(paths) {
  // Check if we're on Windows and adjust Python path if needed
  if (process.platform === 'win32' && app.isPackaged) {
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
}

/**
 * Create necessary directories if they don't exist
 * @param {Object} paths - Paths object
 */
function createDirectories(paths) {
  if (app.isPackaged) {
    // Create config directory
    const configDir = path.dirname(paths.configDb);
    createDirectory(configDir, 'config');
    
    // Create output directory with fallback
    createOutputDirectory(paths);
  } else {
    // In development mode, ensure the output directory exists at project root
    const projectRoot = path.dirname(app.getAppPath());
    const outputDir = path.join(projectRoot, 'output');
    createDirectory(outputDir, 'development output');
  }
}

/**
 * Create a directory with error handling
 * @param {string} dirPath - Directory path to create
 * @param {string} dirType - Description of directory type for logging
 */
function createDirectory(dirPath, dirType) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created ${dirType} directory: ${dirPath}`);
    } catch (err) {
      console.error(`Error creating ${dirType} directory: ${err.message}`);
    }
  }
}

/**
 * Create output directory with fallback logic
 * @param {Object} paths - Paths object
 */
function createOutputDirectory(paths) {
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
}

/**
 * Validate that paths are accessible and writable
 * @param {Object} paths - Paths object
 */
function validatePaths(paths) {
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
}

/**
 * Resolve database path with multiple fallback locations
 * @param {string} databasePath - Original database path
 * @param {Object} appPaths - Application paths object
 * @returns {string|null} Resolved path or null if not found
 */
function resolveDatabasePath(databasePath, appPaths) {
  const possiblePaths = [];
  
  // Check if this is a project-specific database path (output/project_id/filename.db)
  const isProjectPath = databasePath.startsWith('output/') && databasePath.split('/').length > 2;
  
  if (isProjectPath) {
    const pathParts = databasePath.split('/');
    const projectId = pathParts[1];
    const dbFilename = pathParts[2];
    
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
  
  // Find the first existing path
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

module.exports = {
  getAppPaths,
  resolveDatabasePath,
  createDirectory,
  validatePaths
};