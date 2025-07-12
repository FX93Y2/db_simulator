# GitHub Actions Build Setup

This repository uses GitHub Actions for automated building and releasing of the DB Simulator Electron app across multiple platforms.

## Workflows

### 1. Build Test (`build-test.yml`)
- **Triggers**: Pull requests and pushes to main branch
- **Purpose**: Test builds without packaging to ensure code compiles
- **Platforms**: Linux, Windows, macOS
- **Output**: Compilation verification only

### 2. Build Release (`build-release.yml`)
- **Triggers**: 
  - Version tags (e.g., `v1.0.0`)
  - Manual workflow dispatch
- **Purpose**: Create distributable packages and GitHub releases
- **Platforms**: Linux (AppImage), Windows (exe), macOS (dmg)
- **Output**: Release artifacts and GitHub release

## Creating a Release

1. **Tag a version:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Manual trigger:**
   - Go to Actions tab in GitHub
   - Select "Build and Release" workflow
   - Click "Run workflow"

## Requirements

### Icons (Required)
Create these icon files in `electron/public/`:
- `app-icon.ico` (Windows)
- `app-icon.icns` (macOS)
- `app-icon.png` (Linux)

### Secrets (Optional)
For code signing, add these to repository secrets:
- `CSC_LINK` - Certificate file (base64 encoded)
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_ID` - Apple ID for notarization
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password

## Build Artifacts

Each successful build creates:
- **Linux**: `.AppImage` file
- **Windows**: `.exe` installer and portable version
- **macOS**: `.dmg` installer and `.zip` archive

Artifacts are available for download from:
1. GitHub Actions runs (temporary)
2. GitHub Releases (permanent, for tagged versions)

## Platform-Specific Notes

### macOS
- Requires macOS runner for native builds
- DMG creation now works with GitHub Actions
- Code signing requires Apple Developer account

### Windows
- Creates both installer (NSIS) and portable versions
- Requires admin privileges for installation
- Code signing optional but recommended

### Linux
- Creates AppImage for universal compatibility
- No installation required - runs directly
- Works on most Linux distributions