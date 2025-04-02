/**
 * Script to prepare Python environment for packaging
 * Ensures all required Python dependencies are installed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
  console.log('Python dependencies installed successfully.');
} catch (error) {
  console.error('Error installing Python dependencies:', error.message);
  process.exit(1);
}

console.log('Python environment prepared for packaging.'); 