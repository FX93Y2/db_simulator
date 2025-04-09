# DB Simulator

A discrete event simulation tool for modeling and analyzing database workloads.

## Overview

DB Simulator generates synthetic databases and simulates workloads to help analyze performance, resource utilization, and system behavior under various conditions. The application combines a Python simulation engine with an Electron-based GUI.

## Key Features

- **Synthetic Database Generation**: Create realistic test databases with configurable schemas and relationships
- **Discrete Event Simulation**: Model entity arrivals, event processing, and resource allocation
- **Interactive Visualization**: View simulation results through charts and diagrams
- **Entity-Relationship Modeling**: Design database schemas through an intuitive interface
- **Configurable Workloads**: Define custom event types, processing times, and resource requirements

## Architecture

- **Frontend**: Electron + React application providing the user interface
- **Backend**: Python Flask API handling database generation and simulation
- **Simulation Engine**: SimPy-based discrete event simulator
- **Storage**: SQLite for both configuration and generated databases

## Getting Started

1. **Prerequisites**: Node.js 16+, Python 3.8+
2. **Installation**:
   ```
   # Install Python dependencies
   pip install -r python/requirements.txt
   
   # Install Electron dependencies
   cd electron && npm install
   ```
3. **Run Development Mode**:
   ```
   cd electron && npm run dev
   ```

## Workflow

1. Create a project and define database schema
2. Configure simulation parameters
3. Generate synthetic database
4. Run simulation
5. Analyze results