
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    [r'C:\Users\yfang\OneDrive\Documents\Projects\db_simulator\python\main.py'],
    pathex=[r'C:\Users\yfang\OneDrive\Documents\Projects\db_simulator\python'],
    binaries=[],
    datas=[
        (r'C:\Users\yfang\OneDrive\Documents\Projects\db_simulator\python\config_storage', 'config_storage'),
    ],
    hiddenimports=['flask', 'flask_cors', 'sqlalchemy', 'pandas', 'numpy', 'simpy', 'psycopg2', 'faker'],
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
