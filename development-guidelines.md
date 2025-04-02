# Database Simulator - Development Guidelines

This document outlines practices and tools to streamline the development process for the Database Simulator project.

## Table of Contents
- [Development Environment Setup](#development-environment-setup)
- [Code Organization and Documentation](#code-organization-and-documentation)
- [Automated Testing](#automated-testing)
- [Deployment Automation](#deployment-automation)
- [Code Reuse and Modularization](#code-reuse-and-modularization)
- [Development Experience Improvements](#development-experience-improvements)
- [Project Management](#project-management)

## Development Environment Setup

### Docker for Consistent Environments

Create a consistent development environment using Docker to ensure all developers have the same Python/Node.js versions and dependencies.

```yaml
# docker-compose.yml
version: '3'
services:
  app:
    build: .
    volumes:
      - .:/app
    ports:
      - "3000:3000"
      - "5000:5000"
```

### VS Code Launch Configuration

Configure launch tasks in VS Code for running both frontend and backend simultaneously:

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Launch Frontend",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/electron",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"]
    },
    {
      "name": "Launch Backend",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/python/main.py",
      "args": ["api"],
      "cwd": "${workspaceFolder}"
    }
  ],
  "compounds": [
    {
      "name": "Frontend + Backend",
      "configurations": ["Launch Backend", "Launch Frontend"]
    }
  ]
}
```

### Environment Variables Management

Create a `.env.development` and `.env.production` file for managing environment variables:

```bash
# .env.development
API_BASE_URL=http://localhost:5000/api
DEBUG=true
LOG_LEVEL=debug
```

## Code Organization and Documentation

### API Documentation

Document all API endpoints using Swagger/OpenAPI to provide a central reference point:

```javascript
// In python/api/routes.py, add swagger documentation
"""
@swagger.path({
  "/api/generate-database": {
    "post": {
      "summary": "Generate a synthetic database",
      "parameters": [
        {
          "name": "config_id",
          "in": "body",
          "required": true,
          "description": "Configuration ID to use for database generation"
        },
        ...
      ],
      "responses": {
        "200": {
          "description": "Database generated successfully"
        },
        "400": {
          "description": "Missing required fields"
        }
      }
    }
  }
})
"""
```

### Component Structure

Organize React components with a consistent structure:

```
electron/src/components/
  ├── common/             # Shared components
  ├── features/           # Feature-specific components
  │   ├── simulation/     # Simulation-related components
  │   └── database/       # Database-related components
  ├── layout/             # Layout components
  └── pages/              # Page components
```

### Consistent Coding Style

Use ESLint, Prettier, and Black to enforce consistent coding styles:

```json
// .eslintrc.json for JavaScript/React
{
  "extends": ["eslint:recommended", "plugin:react/recommended"],
  "rules": {
    "react/prop-types": "off",
    "no-unused-vars": "warn"
  }
}
```

```toml
# pyproject.toml for Python
[tool.black]
line-length = 88
target-version = ['py38']
```

## Automated Testing

### Frontend Testing with Jest

Add Jest tests for React components and utility functions:

```javascript
// electron/src/utils/__tests__/resultsApi.test.js
import { exportDatabaseToCSV } from '../resultsApi';

jest.mock('window.api', () => ({
  exportDatabaseToCSV: jest.fn()
}));

test('exportDatabaseToCSV handles custom paths', async () => {
  window.api.exportDatabaseToCSV.mockResolvedValue({
    success: true,
    tables: 5,
    totalRows: 100,
    path: 'C:/exports/mydb'
  });
  
  const result = await exportDatabaseToCSV('db.sqlite', 'C:/exports');
  expect(result.success).toBe(true);
  expect(window.api.exportDatabaseToCSV).toHaveBeenCalledWith('db.sqlite', 'C:/exports');
});
```

### Backend Testing with pytest

Add pytest tests for Python backend code:

```python
# python/tests/test_generator.py
import pytest
from src.generator import generate_database

def test_generate_database():
    """Test database generation function"""
    db_path = generate_database("test_config", "output", "test_db")
    assert db_path.endswith('test_db.db')
    assert os.path.exists(db_path)
```

### Integration Tests

Create integration tests that validate the frontend-backend interaction:

```javascript
// Using Playwright for end-to-end testing
const { test, expect } = require('@playwright/test');

test('can run a database simulation', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Create Project');
  await page.fill('input[name="projectName"]', 'Test Project');
  await page.click('text=Save');
  await page.click('text=Run Simulation');
  await expect(page.locator('text=Simulation completed')).toBeVisible();
});
```

## Deployment Automation

### GitHub Actions Workflow

Set up a CI/CD pipeline using GitHub Actions:

```yaml
# .github/workflows/build.yml
name: Build and Release
on:
  push:
    branches: [main]
    tags:
      - 'v*'
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          npm ci --prefix electron
          pip install -r python/requirements.txt
      - name: Run tests
        run: |
          npm test --prefix electron
          python -m pytest python/tests/
      - name: Build application
        run: npm run build --prefix electron
      - name: Upload artifacts
        uses: actions/upload-artifact@v2
        with:
          name: app-${{ matrix.os }}
          path: electron/dist/
```

### Semantic Versioning

Automate versioning with semantic versioning scripts:

```json
// package.json
{
  "scripts": {
    "version:patch": "npm version patch && git push && git push --tags",
    "version:minor": "npm version minor && git push && git push --tags",
    "version:major": "npm version major && git push && git push --tags"
  }
}
```

## Code Reuse and Modularization

### Path Resolution Module

Create a centralized path resolution module to eliminate duplicate code:

```javascript
// electron/src/utils/pathResolver.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Resolves database path across different environments
 * @param {string} relativePath - Relative path to resolve
 * @param {Object} options - Options for resolution
 * @returns {string} Resolved absolute path
 */
function resolveDbPath(relativePath, options = {}) {
  const { checkExists = true, appPaths } = options;
  const possiblePaths = [];
  
  // Add path resolution logic here
  // ...

  return resolvedPath;
}

module.exports = {
  resolveDbPath
};
```

### Shared API Utilities

Extract common API handling code into shared utilities:

```javascript
// electron/src/utils/apiHandler.js
/**
 * Creates a wrapped API call with standard error handling
 * @param {Function} apiCall - The API function to call
 * @returns {Function} Wrapped function with error handling
 */
export const withErrorHandling = (apiCall) => async (...args) => {
  try {
    const result = await apiCall(...args);
    if (!result.success) {
      console.error(`API error: ${result.error}`);
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    console.error(`Error in API call: ${error.message}`);
    throw error;
  }
};
```

## Development Experience Improvements

### Hot Reloading

Configure hot reloading for both frontend and backend development:

```javascript
// electron/webpack.config.js
config.plugins.push(new webpack.HotModuleReplacementPlugin());
config.devServer = {
  hot: true,
  contentBase: path.join(__dirname, 'dist'),
  port: 3000
};
```

### Error Handling Middleware

Implement standardized error handling for the API:

```python
# python/api/error_handlers.py
from flask import jsonify

def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'success': False,
            'error': 'Bad request',
            'message': str(error)
        }), 400
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'error': 'Not found',
            'message': str(error)
        }), 404
    
    @app.errorhandler(500)
    def server_error(error):
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(error)
        }), 500
```

### Performance Monitoring

Add performance monitoring to track application responsiveness:

```javascript
// electron/main.js
app.on('ready', () => {
  // Start performance monitoring
  const startTime = Date.now();
  startBackend();
  createWindow();
  console.log(`App startup time: ${Date.now() - startTime}ms`);
});
```

## Project Management

### Feature Flags

Implement feature flags for gradual rollout of new functionality:

```javascript
// electron/src/utils/featureFlags.js
const features = {
  MULTI_TABLE_EXPORT: process.env.FEATURE_MULTI_TABLE_EXPORT === 'true',
  ADVANCED_SIMULATION: process.env.FEATURE_ADVANCED_SIMULATION === 'true'
};

export const isFeatureEnabled = (featureName) => {
  return !!features[featureName];
};
```

### Logging System

Set up detailed logging throughout the app:

```javascript
// electron/src/utils/logger.js
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

export const logger = {
  debug: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
};
```

### Changelog Generator

Create an automated changelog based on commit history:

```javascript
// scripts/generate-changelog.js
const { execSync } = require('child_process');
const fs = require('fs');

// Get all commits since last tag
const lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
const commits = execSync(`git log ${lastTag}..HEAD --pretty=format:"%s"`)
  .toString()
  .split('\n')
  .filter(line => line.trim() !== '');

// Group commits by type
const features = commits.filter(c => c.startsWith('feat:'));
const fixes = commits.filter(c => c.startsWith('fix:'));
const docs = commits.filter(c => c.startsWith('docs:'));

// Generate changelog content
const changelog = `# Changelog

## [Unreleased]
${features.length > 0 ? '\n### Features\n\n' + features.map(f => `- ${f.replace('feat: ', '')}`).join('\n') : ''}
${fixes.length > 0 ? '\n### Bug Fixes\n\n' + fixes.map(f => `- ${f.replace('fix: ', '')}`).join('\n') : ''}
${docs.length > 0 ? '\n### Documentation\n\n' + docs.map(d => `- ${d.replace('docs: ', '')}`).join('\n') : ''}
`;

fs.writeFileSync('CHANGELOG.md', changelog);
console.log('Changelog generated!');
```

---

By implementing these practices, you can significantly streamline the development process for the Database Simulator project, improving code quality, developer productivity, and the end-user experience. 