# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

# Get the current directory (python folder)
current_dir = os.path.dirname(os.path.abspath('.'))

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('config_storage', 'config_storage'),
        ('src/generator/data/faker_js/bundle.js', 'src/generator/data/faker_js'),
    ],
    hiddenimports=[
        'flask', 
        'flask_cors', 
        'sqlalchemy', 
        'pandas', 
        'numpy', 
        'simpy', 
        'psycopg2', 
        'faker',
        'yaml',
        'dateutil',
        'pkg_resources.py2_warn',
        'py_mini_racer',
        'py_mini_racer.py_mini_racer',
    ],
    hookspath=[],
    hooksconfig={},
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