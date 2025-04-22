"""
Description: Build script to create a standalone executable for the Python API using PyInstaller.

This script will bundle the Python API into a single executable that can be distributed
without requiring Python to be installed on the target machine.
"""

import os
import sys
import subprocess
import shutil
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def build_api():
    print("Building API executable with PyInstaller...")
    
    # Ensure PyInstaller is installed
    try:
        import PyInstaller # type: ignore
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    # Get the current directory
    current_dir = Path(__file__).parent.absolute()
    
    try:
        # First approach: Try with a spec file
        build_with_spec_file(current_dir)
    except Exception as e:
        print(f"Error using spec file approach: {e}")
        print("Falling back to direct PyInstaller command...")
        build_with_direct_command(current_dir)
    
    print("API executable built successfully!")
    return str(current_dir / "dist" / "db_simulator_api")

def build_with_spec_file(current_dir):
    # Create a spec file for the API - Fix path formatting for Windows
    main_path = current_dir / "main.py"
    path_str = str(main_path).replace("\\", "\\\\")  # Double escape backslashes for Windows paths
    pathex_str = str(current_dir).replace("\\", "\\\\")
    config_storage_path = str(current_dir / "config_storage").replace("\\", "\\\\")
    
    spec_content = f"""
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    [r'{main_path}'],
    pathex=[r'{current_dir}'],
    binaries=[],
    datas=[
        (r'{current_dir / "config_storage"}', 'config_storage'),
    ],
    hiddenimports=['flask', 'flask_cors', 'sqlalchemy', 'pandas', 'numpy', 'simpy', 'psycopg2', 'faker'],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='db_simulator_api',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='db_simulator_api',
)
"""
    
    with open(current_dir / "db_simulator_api.spec", "w") as f:
        f.write(spec_content)
    
    # Build the executable
    subprocess.check_call([
        sys.executable, 
        "-m", 
        "PyInstaller", 
        "--clean",
        str(current_dir / "db_simulator_api.spec")
    ], cwd=current_dir)

def build_with_direct_command(current_dir):
    """Build using direct PyInstaller command without a spec file"""
    logger.info("Building with direct PyInstaller command...")
    main_script = current_dir / "main.py"
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=db_simulator_api",
        "--clean",
        "--add-data", f"{current_dir / 'config_storage'};config_storage",
        "--hidden-import=flask",
        "--hidden-import=flask_cors",
        "--hidden-import=sqlalchemy",
        "--hidden-import=pandas",
        "--hidden-import=numpy",
        "--hidden-import=simpy",
        "--hidden-import=psycopg2",
        "--hidden-import=faker",
        str(main_script)
    ]
    
    logger.info(f"Running command: {' '.join(cmd)}")
    subprocess.check_call(cmd, cwd=current_dir)

if __name__ == "__main__":
    build_api() 