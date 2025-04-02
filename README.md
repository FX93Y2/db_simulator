# DB Simulator

A database simulation tool for modeling and simulating database workloads using discrete event simulation.

## Features

- Entity-Relationship diagram creation and editing
- Discrete event simulation for database workloads
- Visualization of simulation results
- Support for various database systems and query types
- Interactive flowchart editor for simulation configurations

## Getting Started

### Prerequisites

- Node.js 16+
- Python 3.8+
- npm or yarn

### Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/db-simulator.git
   cd db-simulator
   ```

2. Install dependencies:
   ```
   # Install Python dependencies
   pip install -r requirements.txt
   
   # Install Electron dependencies
   cd electron
   npm install
   ```

3. Run the application in development mode:
   ```
   cd electron
   npm run dev
   ```

This will start both the Python backend API and the Electron frontend.

## Packaging for Distribution

We've prepared scripts to package the application for distribution. This creates standalone executables that users can install without having to set up Node.js or Python.

### Windows Packaging

Run the build script from the project root:
```
.\build-app.ps1
```

For detailed packaging instructions, see [PACKAGING.md](PACKAGING.md).

## Project Structure

- `/electron` - Electron frontend application
  - `/src` - React application source code
  - `/public` - Static assets
- `/python` - Python backend API
  - `/models` - Data models and database logic
  - `/api` - API endpoints and controllers
- `/output` - Simulation results and output files

## Technologies Used

- **Frontend**: Electron, React, React Flow, Chart.js
- **Backend**: Python, Flask, SQLite
- **Simulation**: Custom discrete event simulation engine

## License

This project is licensed under the MIT License - see the LICENSE file for details. 