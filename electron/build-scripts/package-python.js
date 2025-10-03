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

// Use the venv in python/ directory
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

// Build the Python backend using PyInstaller
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
    
    // Create a marker file to indicate we should use the PyInstaller executable
    fs.writeFileSync(useExecutableMarker, 'This file indicates that PyInstaller succeeded and we should use the executable.', 'utf8');

    // Ensure py-mini-racer native library and data files are present at runtime location
    try {
      const sitePkgDir = path.resolve(path.join(pythonDir, 'venv', 'lib', 'python3.11', 'site-packages', 'py_mini_racer'));
      const internalDir = path.join(exeDestPath, '_internal');
      if (!fs.existsSync(internalDir)) {
        fs.mkdirSync(internalDir, { recursive: true });
      }

      const filesToCopy = [
        { src: path.join(sitePkgDir, process.platform === 'win32' ? 'mini_racer.dll' : 'mini_racer.so'), dst: path.join(internalDir, process.platform === 'win32' ? 'mini_racer.dll' : 'mini_racer.so'), label: 'MiniRacer native library' },
        { src: path.join(sitePkgDir, 'icudtl.dat'), dst: path.join(internalDir, 'icudtl.dat'), label: 'ICU data file' },
        { src: path.join(sitePkgDir, 'snapshot_blob.bin'), dst: path.join(internalDir, 'snapshot_blob.bin'), label: 'V8 snapshot blob' }
      ];

      for (const f of filesToCopy) {
        if (fs.existsSync(f.src)) {
          fs.copyFileSync(f.src, f.dst);
          console.log(`Copied ${f.label} to ${f.dst}`);
        } else {
          console.warn(`${f.label} not found at ${f.src}.`);
        }
      }
    } catch (err) {
      console.warn('Failed to copy MiniRacer native library:', err.message);
    }
  } else {
    throw new Error('PyInstaller completed but executable not found');
  }
} catch (error) {
  console.error('Error building Python backend with PyInstaller:', error.message);
  console.error('PyInstaller is required for packaging. Please ensure all dependencies are properly installed.');
  process.exit(1); // Fail fast instead of using fallback
}

// Update package.json to include only necessary files
console.log('Updating package.json for Python packaging...');
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = require(packageJsonPath);
  
  // Reset extraResources and only include PyInstaller executable
  packageJson.build.extraResources = [];
  
  // Only include the PyInstaller executable (since we fail fast if it doesn't work)
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
  
  // Write the updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
  console.log('Package.json updated for Python packaging.');
} catch (error) {
  console.error('Error updating package.json:', error.message);
}

console.log('Python packaging step completed.'); 
