"""
API routes for DB Simulator.
This module defines the Flask routes for the Electron integration.
"""

from flask import Blueprint, request, jsonify
import logging

import sys
import os

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.generator import generate_database, generate_database_for_simulation
from src.simulation.runner import run_simulation, run_simulation_from_config_dir
from config_storage.config_db import ConfigManager

# Create logger
logger = logging.getLogger(__name__)

# Create Blueprint
api = Blueprint('api', __name__)

# Initialize configuration manager
config_manager = ConfigManager()

# Project management routes
@api.route('/projects', methods=['GET'])
def get_projects():
    """Get all projects"""
    try:
        projects = config_manager.get_all_projects()
        return jsonify({"success": True, "projects": projects})
    except Exception as e:
        logger.error(f"Error retrieving projects: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get a specific project by ID"""
    try:
        project = config_manager.get_project(project_id)
        if project:
            return jsonify({"success": True, "project": project})
        return jsonify({"success": False, "error": "Project not found"}), 404
    except Exception as e:
        logger.error(f"Error retrieving project: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/projects', methods=['POST'])
def create_project():
    """Create a new project"""
    try:
        data = request.json
        if not data or not data.get('name'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        project_id = config_manager.create_project(
            data['name'],
            data.get('description', '')
        )
        
        # Get the newly created project
        project = config_manager.get_project(project_id)
        
        return jsonify({
            "success": True, 
            "project": project,
            "message": "Project created successfully"
        })
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update an existing project"""
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "error": "Missing data"}), 400
            
        success = config_manager.update_project(
            project_id,
            data.get('name'),
            data.get('description')
        )
        
        if success:
            # Get the updated project
            project = config_manager.get_project(project_id)
            return jsonify({
                "success": True,
                "project": project,
                "message": "Project updated successfully"
            })
        
        return jsonify({"success": False, "error": "Project not found"}), 404
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project"""
    try:
        success = config_manager.delete_project(project_id)
        if success:
            return jsonify({"success": True, "message": "Project deleted successfully"})
        return jsonify({"success": False, "error": "Project not found"}), 404
    except Exception as e:
        logger.error(f"Error deleting project: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# Project configuration routes
@api.route('/projects/<project_id>/db-config', methods=['GET'])
def get_project_db_config(project_id):
    """Get the database configuration for a project"""
    try:
        project = config_manager.get_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "Project not found"}), 404
            
        config = config_manager.get_project_config(project_id, 'database')
        
        if config:
            return jsonify({
                "success": True, 
                "config": config,
                "projectName": project.get('name')
            })
        else:
            return jsonify({
                "success": True, 
                "config": None,
                "projectName": project.get('name'),
                "message": "No database configuration found for this project"
            })
    except Exception as e:
        logger.error(f"Error retrieving project DB config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/projects/<project_id>/db-config', methods=['POST'])
def save_project_db_config(project_id):
    """Save database configuration for a project"""
    try:
        logger.info(f"Received request to save DB config for project {project_id}")
        data = request.json
        logger.debug(f"Request data: {data}")
        
        if not data or not data.get('content'):
            logger.warning("Missing required fields in request")
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        # Check if project exists
        project = config_manager.get_project(project_id)
        if not project:
            logger.warning(f"Project not found: {project_id}")
            return jsonify({"success": False, "error": "Project not found"}), 404
            
        logger.info(f"Saving DB config for project {project_id} ({project['name']})")
        config_id = config_manager.save_project_config(
            project_id,
            'database',
            data.get('name', f"{project['name']} DB Config"),
            data['content'],
            data.get('description', '')
        )
        
        # Get the newly created/updated config
        config = config_manager.get_config(config_id)
        
        response = {
            "success": True, 
            "config": config,
            "config_id": config_id,
            "message": "Database configuration saved successfully"
        }
        logger.info(f"DB config saved successfully with ID {config_id}")
        logger.debug(f"Response: {response}")
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error saving project DB config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/projects/<project_id>/sim-config', methods=['GET'])
def get_project_sim_config(project_id):
    """Get the simulation configuration for a project"""
    try:
        project = config_manager.get_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "Project not found"}), 404
            
        config = config_manager.get_project_config(project_id, 'simulation')
        
        if config:
            return jsonify({
                "success": True, 
                "config": config,
                "projectName": project.get('name')
            })
        else:
            return jsonify({
                "success": True, 
                "config": None,
                "projectName": project.get('name'),
                "message": "No simulation configuration found for this project"
            })
    except Exception as e:
        logger.error(f"Error retrieving project simulation config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/projects/<project_id>/sim-config', methods=['POST'])
def save_project_sim_config(project_id):
    """Save simulation configuration for a project"""
    try:
        logger.info(f"Received request to save simulation config for project {project_id}")
        data = request.json
        logger.debug(f"Request data: {data}")
        
        if not data or not data.get('content'):
            logger.warning("Missing required fields in request")
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        # Check if project exists
        project = config_manager.get_project(project_id)
        if not project:
            logger.warning(f"Project not found: {project_id}")
            return jsonify({"success": False, "error": "Project not found"}), 404
            
        logger.info(f"Saving simulation config for project {project_id} ({project['name']})")
        config_id = config_manager.save_project_config(
            project_id,
            'simulation',
            data.get('name', f"{project['name']} Simulation Config"),
            data['content'],
            data.get('description', '')
        )
        
        # Get the newly created/updated config
        config = config_manager.get_config(config_id)
        
        response = {
            "success": True, 
            "config": config,
            "config_id": config_id,
            "message": "Simulation configuration saved successfully"
        }
        logger.info(f"Simulation config saved successfully with ID {config_id}")
        logger.debug(f"Response: {response}")
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error saving project simulation config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# Standard configuration routes
@api.route('/configs', methods=['GET'])
def get_configs():
    """Get all saved configurations"""
    try:
        config_type = request.args.get('type')
        configs = config_manager.get_all_configs(config_type)
        return jsonify({"success": True, "configs": configs})
    except Exception as e:
        logger.error(f"Error retrieving configurations: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/configs/<config_id>', methods=['GET'])
def get_config(config_id):
    """Get a specific configuration by ID"""
    try:
        config = config_manager.get_config(config_id)
        if config:
            return jsonify({"success": True, "config": config})
        return jsonify({"success": False, "error": "Configuration not found"}), 404
    except Exception as e:
        logger.error(f"Error retrieving configuration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/configs', methods=['POST'])
def save_config():
    """Save a new configuration"""
    try:
        data = request.json
        if not data or not data.get('name') or not data.get('config_type') or not data.get('content'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        config_id = config_manager.save_config(
            data['name'], 
            data['config_type'], 
            data['content'],
            data.get('description', '')
        )
        return jsonify({"success": True, "config_id": config_id})
    except Exception as e:
        logger.error(f"Error saving configuration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/configs/<config_id>', methods=['PUT'])
def update_config(config_id):
    """Update an existing configuration"""
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "error": "Missing data"}), 400
            
        success = config_manager.update_config(
            config_id,
            data.get('name'),
            data.get('config_type'),
            data.get('content'),
            data.get('description')
        )
        if success:
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "Configuration not found"}), 404
    except Exception as e:
        logger.error(f"Error updating configuration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/configs/<config_id>', methods=['DELETE'])
def delete_config(config_id):
    """Delete a configuration"""
    try:
        success = config_manager.delete_config(config_id)
        if success:
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "Configuration not found"}), 404
    except Exception as e:
        logger.error(f"Error deleting configuration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/generate-database', methods=['POST'])
def generate_db():
    """Generate a synthetic database"""
    try:
        data = request.json
        if not data or not data.get('config_id'):
            return jsonify({"success": False, "error": "Missing config_id"}), 400
            
        config = config_manager.get_config(data['config_id'])
        if not config:
            return jsonify({"success": False, "error": "Configuration not found"}), 404
            
        output_dir = data.get('output_dir', 'output')
        db_name = data.get('name')
        
        # Generate database using the configuration content
        db_path = generate_database(config['content'], output_dir, db_name)
        return jsonify({
            "success": True, 
            "database_path": str(db_path),
            "message": f"Database generated at: {db_path}"
        })
    except Exception as e:
        logger.error(f"Error generating database: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/run-simulation', methods=['POST'])
def simulate():
    """Run a simulation"""
    try:
        data = request.json
        if not data or not data.get('config_id') or not data.get('database_path'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        config = config_manager.get_config(data['config_id'])
        if not config:
            return jsonify({"success": False, "error": "Configuration not found"}), 404
            
        # Run simulation using the configuration content
        results = run_simulation(config['content'], data['database_path'])
        return jsonify({
            "success": True,
            "results": results,
            "message": "Simulation completed successfully"
        })
    except Exception as e:
        logger.error(f"Error running simulation: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/generate-and-simulate', methods=['POST'])
def generate_and_simulate():
    """Generate a database and run simulation"""
    try:
        data = request.json
        if not data or not data.get('db_config_id') or not data.get('sim_config_id'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        db_config = config_manager.get_config(data['db_config_id'])
        sim_config = config_manager.get_config(data['sim_config_id'])
        
        if not db_config or not sim_config:
            return jsonify({"success": False, "error": "Configuration not found"}), 404
            
        output_dir = data.get('output_dir', 'output')
        db_name = data.get('name')
        
        # Generate database with only resource tables then run simulation
        db_path = generate_database_for_simulation(
            db_config['content'], 
            sim_config['content'],
            output_dir,
            db_name
        )
        
        results = run_simulation(sim_config['content'], db_path)
        return jsonify({
            "success": True,
            "database_path": str(db_path),
            "results": results,
            "message": "Dynamic simulation completed successfully"
        })
    except Exception as e:
        logger.error(f"Error in dynamic simulation: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# Add additional routes for simulation results here
@api.route('/results/summary', methods=['GET'])
def get_simulation_results():
    """Get summary data about a simulation result database"""
    try:
        database_path = request.args.get('database_path')
        if not database_path:
            return jsonify({"success": False, "error": "Missing database_path parameter"}), 400
            
        # Here you would extract summary data from the database
        # For now, we'll return some placeholder data
        summary_data = {
            "simulationId": "sim123",
            "runDate": "2023-12-15T15:30:00Z",
            "duration": 30,
            "entitiesCount": 50,
            "eventsCount": 120
        }
        
        return jsonify({
            "success": True,
            "data": summary_data
        })
    except Exception as e:
        logger.error(f"Error retrieving simulation results: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/results/tables', methods=['GET'])
def get_database_tables():
    """Get list of tables in a result database"""
    try:
        database_path = request.args.get('database_path')
        if not database_path:
            return jsonify({"success": False, "error": "Missing database_path parameter"}), 400
            
        # Here you would query the database for its tables
        # For now, we'll return some example tables
        tables = [
            "Entity",
            "Event",
            "Resource",
            "ResourceAllocation",
            "SimulationLog"
        ]
        
        return jsonify({
            "success": True,
            "tables": tables
        })
    except Exception as e:
        logger.error(f"Error retrieving database tables: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/results/table-data', methods=['GET'])
def get_table_data():
    """Get data from a specific table"""
    try:
        database_path = request.args.get('databasePath')
        table_name = request.args.get('tableName')
        limit = request.args.get('limit', 1000)
        
        if not database_path or not table_name:
            return jsonify({"success": False, "error": "Missing required parameters"}), 400
            
        # Here you would query the database for the table data
        # For now, we'll return some example data
        mock_data = []
        
        if table_name == "Entity":
            for i in range(10):
                mock_data.append({
                    "id": i + 1,
                    "name": f"Entity{i+1}",
                    "created_at": "2023-12-15T10:00:00Z"
                })
        elif table_name == "Event":
            for i in range(10):
                mock_data.append({
                    "id": i + 1,
                    "entity_id": (i % 5) + 1,
                    "type": f"Event{(i % 3) + 1}",
                    "start_time": "2023-12-15T10:00:00Z",
                    "duration": i + 5
                })
        
        return jsonify({
            "success": True,
            "data": mock_data
        })
    except Exception as e:
        logger.error(f"Error retrieving table data: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/results/export-csv', methods=['POST'])
def export_database_to_csv():
    """Export database tables to CSV files"""
    try:
        data = request.json
        database_path = data.get('database_path')
        export_path = data.get('export_path')
        
        if not database_path or not export_path:
            return jsonify({"success": False, "error": "Missing required parameters"}), 400
            
        # Here you would export the database tables to CSV files
        # For now, we'll just return success
        
        return jsonify({
            "success": True,
            "exportPath": export_path,
            "message": f"Data exported successfully to {export_path}"
        })
    except Exception as e:
        logger.error(f"Error exporting database to CSV: {e}")
        return jsonify({"success": False, "error": str(e)}), 500 