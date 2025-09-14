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

def cleanup_test_data(current_dir):
    """Remove test data and configurations before building for distribution"""
    print("Cleaning up test data before building...")

    # Clean config storage database
    config_db_path = current_dir / "config_storage" / "configs.db"
    if config_db_path.exists():
        print(f"Removing test configuration database: {config_db_path}")
        config_db_path.unlink()

    # Clean any test output directories in the project root
    project_root = current_dir.parent
    output_dir = project_root / "output"
    if output_dir.exists():
        print(f"Removing test simulation outputs: {output_dir}")
        shutil.rmtree(output_dir, ignore_errors=True)

    # Clean any test databases in test directories
    test_config_output = current_dir / "tests" / "test_config" / "output"
    if test_config_output.exists():
        print(f"Removing test config outputs: {test_config_output}")
        shutil.rmtree(test_config_output, ignore_errors=True)

    print("Test data cleanup completed.")

def validate_build_dependencies(current_dir):
    """Validate that all required dependencies and files exist before building"""
    print("Validating build dependencies...")

    missing_items = []

    # Check for JavaScript bundle
    bundle_path = current_dir / "src" / "generator" / "data" / "faker_js" / "bundle.js"
    if not bundle_path.exists():
        missing_items.append(f"Faker.js bundle: {bundle_path}")

    # Check for py-mini-racer
    try:
        __import__('py_mini_racer')
        print("[OK] py-mini-racer dependency found")
    except ImportError:
        missing_items.append("py-mini-racer Python package")

    # Check for other critical dependencies
    critical_deps = ['flask', 'sqlalchemy', 'numpy', 'pandas', 'simpy', 'faker']
    for dep in critical_deps:
        try:
            __import__(dep)
            print(f"[OK] {dep} dependency found")
        except ImportError:
            missing_items.append(f"{dep} Python package")

    if missing_items:
        print("\n[ERROR] Build validation failed! Missing dependencies:")
        for item in missing_items:
            print(f"  - {item}")

        if bundle_path.parents[0].exists():
            print(f"\nNote: To generate the Faker.js bundle, run:")
            print(f"  cd electron && node build-faker-bundle.js")

        raise RuntimeError("Build validation failed - missing required dependencies")

    print("[SUCCESS] All build dependencies validated successfully")

def build_api():
    print("Building API executable with PyInstaller...")

    # Ensure PyInstaller is installed
    try:
        __import__('PyInstaller')
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # Get the current directory
    current_dir = Path(__file__).parent.absolute()

    # Clean up test data before building
    cleanup_test_data(current_dir)

    # Validate all build dependencies
    validate_build_dependencies(current_dir)

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

    spec_content = f"""
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    [r'{main_path}'],
    pathex=[r'{current_dir}'],
    binaries=[],
    datas=[
        (r'{current_dir / "config_storage"}', 'config_storage'),
        (r'{current_dir / "src" / "generator" / "data" / "faker_js" / "bundle.js"}', 'src/generator/data/faker_js'),
    ],
    hiddenimports=[
        'flask', 'flask_cors', 'sqlalchemy', 'pandas', 'numpy', 'simpy', 'psycopg2', 'faker',
        'py_mini_racer', 'py_mini_racer.py_mini_racer',
        'mini_racer', 'ctypes', 'ctypes.util',
        'json', 'os', 'sys', 'logging'
    ],
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
        "-y",  # Force overwrite output directory
        str(current_dir / "db_simulator_api.spec")
    ], cwd=current_dir)

def build_with_direct_command(current_dir):
    """Build using direct PyInstaller command without a spec file"""
    logger.info("Building with direct PyInstaller command...")
    main_script = current_dir / "main.py"

    # Use platform-appropriate path separator for --add-data
    separator = ";" if os.name == "nt" else ":"

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=db_simulator_api",
        "--clean",
        f"--add-data={current_dir / 'config_storage'}{separator}config_storage",
        f"--add-data={current_dir / 'src' / 'generator' / 'data' / 'faker_js' / 'bundle.js'}{separator}src/generator/data/faker_js",
        "--hidden-import=flask",
        "--hidden-import=flask_cors",
        "--hidden-import=sqlalchemy",
        "--hidden-import=pandas",
        "--hidden-import=numpy",
        "--hidden-import=simpy",
        "--hidden-import=psycopg2",
        "--hidden-import=faker",
        "--hidden-import=py_mini_racer",
        "--hidden-import=py_mini_racer.py_mini_racer",
        "--hidden-import=mini_racer",
        "--hidden-import=ctypes",
        "--hidden-import=ctypes.util",
        str(main_script)
    ]

    logger.info(f"Running command: {' '.join(cmd)}")
    subprocess.check_call(cmd, cwd=current_dir)

if __name__ == "__main__":
    build_api() 