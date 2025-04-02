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
  } else {
    throw new Error('PyInstaller completed but executable not found');
  }
} catch (error) {
  console.error('Error building Python backend with PyInstaller:', error.message);
  console.log('Falling back to copying the Python directory...');
}

// Fallback: If PyInstaller fails, create a marker file to indicate we should use the copied Python directory
if (!pyinstallerSucceeded) {
  console.log('Creating a fallback Python environment...');
  
  // Create marker file to indicate we should use the copied Python environment
  fs.writeFileSync(path.join(pythonDir, 'USE_COPIED_ENV'), 'This file indicates that PyInstaller failed and we should use the copied Python environment instead.', 'utf8');
  
  console.log('Python environment prepared for packaging with fallback approach.');
  console.log('NOTE: The app will use the system Python on the target machine if available.');
}

console.log('Python packaging step completed.'); 