/**
 * Script to prepare Python environment for packaging
 * Now using PyInstaller to create a standalone executable
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('Preparing Python environment for packaging...');

// Path to Python code
const pythonDir = path.resolve(__dirname, '../../python');
const requirementsFile = path.join(pythonDir, 'requirements.txt');

// Create virtualenv if it doesn't exist
const venvDir = path.join(pythonDir, 'venv');
if (!fs.existsSync(venvDir)) {
  console.log('Creating Python virtual environment...');
  try {
    execSync('python -m venv venv', { 
      cwd: pythonDir,
      stdio: 'inherit'
    });
    console.log('Virtual environment created successfully.');
  } catch (error) {
    console.error('Error creating virtual environment:', error.message);
    process.exit(1);
  }
}

// Install required packages
console.log('Installing Python dependencies...');
try {
  const pipCmd = process.platform === 'win32' 
    ? path.join(venvDir, 'Scripts', 'pip') 
    : path.join(venvDir, 'bin', 'pip');
    
  execSync(`"${pipCmd}" install -r "${requirementsFile}"`, { 
    cwd: pythonDir,
    stdio: 'inherit'
  });
  
  // Make sure PyInstaller is installed
  execSync(`"${pipCmd}" install pyinstaller`, { 
    cwd: pythonDir,
    stdio: 'inherit'
  });
  
  console.log('Python dependencies installed successfully.');
} catch (error) {
  console.error('Error installing Python dependencies:', error.message);
  process.exit(1);
}

// Remove any existing marker files
const useExecutableMarker = path.join(pythonDir, 'USE_EXECUTABLE');
const useCopiedEnvMarker = path.join(pythonDir, 'USE_COPIED_ENV');

if (fs.existsSync(useExecutableMarker)) {
  fs.unlinkSync(useExecutableMarker);
}
if (fs.existsSync(useCopiedEnvMarker)) {
  fs.unlinkSync(useCopiedEnvMarker);
}

// Try to build the Python backend using PyInstaller
let pyinstallerSucceeded = false;
console.log('Building standalone Python executable with PyInstaller...');
try {
  const pythonCmd = process.platform === 'win32' 
    ? path.join(venvDir, 'Scripts', 'python') 
    : path.join(venvDir, 'bin', 'python');
  
  execSync(`"${pythonCmd}" build_api.py`, { 
    cwd: pythonDir,
    stdio: 'inherit',
    timeout: 300000 // 5 minute timeout
  });
  
  // Check if the executable was created successfully
  const exeDestPath = path.join(pythonDir, 'dist', 'db_simulator_api');
  if (fs.existsSync(exeDestPath)) {
    console.log('Python backend built successfully with PyInstaller.');
    pyinstallerSucceeded = true;
    
    // Create a marker file to indicate we should use the PyInstaller executable
    fs.writeFileSync(useExecutableMarker, 'This file indicates that PyInstaller succeeded and we should use the executable.', 'utf8');
  } else {
    throw new Error('PyInstaller completed but executable not found');
  }
} catch (error) {
  console.error('Error building Python backend with PyInstaller:', error.message);
  console.log('Using fallback approach with copied Python environment.');
  
  // Create marker file to indicate we should use the copied Python environment
  fs.writeFileSync(useCopiedEnvMarker, 'This file indicates that PyInstaller failed and we should use the copied Python environment instead.', 'utf8');
}

// Update package.json to include only necessary files
console.log('Updating package.json for Python packaging...');
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = require(packageJsonPath);
  
  // Reset extraResources
  packageJson.build.extraResources = [];
  
  if (pyinstallerSucceeded) {
    // Only include the PyInstaller executable if it was successfully built
    packageJson.build.extraResources.push({
      from: "../python/dist/db_simulator_api",
      to: "python/dist/db_simulator_api",
      filter: ["**/*"]
    });
    
    // Include marker file
    packageJson.build.extraResources.push({
      from: "../python/USE_EXECUTABLE",
      to: "python/USE_EXECUTABLE"
    });
  } else {
    // Include marker file
    packageJson.build.extraResources.push({
      from: "../python/USE_COPIED_ENV",
      to: "python/USE_COPIED_ENV"
    });
    
    // Include necessary Python files for the fallback approach
    packageJson.build.extraResources.push({
      from: "../python/main.py",
      to: "python/main.py"
    });
    
    packageJson.build.extraResources.push({
      from: "../python/run.py",
      to: "python/run.py"
    });
    
    packageJson.build.extraResources.push({
      from: "../python/requirements.txt",
      to: "python/requirements.txt"
    });
    
    packageJson.build.extraResources.push({
      from: "../python/api",
      to: "python/api",
      filter: ["**/*", "!**/__pycache__/**", "!**/*.pyc"]
    });
    
    packageJson.build.extraResources.push({
      from: "../python/src",
      to: "python/src",
      filter: ["**/*", "!**/__pycache__/**", "!**/*.pyc"]
    });
    
    packageJson.build.extraResources.push({
      from: "../python/config_storage",
      to: "python/config_storage",
      filter: ["**/*", "!**/__pycache__/**", "!**/*.pyc"]
    });
    
    // Only include venv if this is a redistributable configuration
    // Usually not recommended for production but keeping for fallback
    packageJson.build.extraResources.push({
      from: "../python/venv",
      to: "python/venv",
      filter: [
        "Scripts/**",
        "Lib/**",
        "Include/**",
        "pyvenv.cfg",
        "!**/__pycache__/**",
        "!**/*.pyc",
        "!**/*.git"
      ]
    });
  }
  
  // Write the updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
  console.log('Package.json updated for Python packaging.');
} catch (error) {
  console.error('Error updating package.json:', error.message);
}

console.log('Python packaging step completed.'); 