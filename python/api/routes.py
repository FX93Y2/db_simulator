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
from src.utils.file_operations import safe_delete_sqlite_file
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
        logger.info(f"Request data keys: {list(data.keys() if data else [])}")
        logger.info(f"Content length: {len(data.get('content', '')) if data and 'content' in data else 'No content'}")
        
        if not data or not data.get('content'):
            logger.warning("Missing required fields in request")
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        # Check if project exists
        project = config_manager.get_project(project_id)
        if not project:
            logger.warning(f"Project not found: {project_id}")
            return jsonify({"success": False, "error": "Project not found"}), 404
        
        # Validate the YAML content
        try:
            import yaml
            yaml_content = data.get('content', '')
            logger.info(f"Attempting to parse YAML content (first 100 chars): {yaml_content[:100]}...")
            parsed_yaml = yaml.safe_load(yaml_content)
            if parsed_yaml is None:
                logger.warning("YAML content parsed to None - may be empty or invalid")
            else:
                logger.info(f"YAML validation successful, parsed to object type: {type(parsed_yaml)}")
        except Exception as yaml_error:
            logger.error(f"YAML validation failed: {yaml_error}")
            return jsonify({
                "success": False, 
                "error": f"Invalid YAML content: {str(yaml_error)}"
            }), 400
            
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
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error saving project DB config: {e}")
        import traceback
        logger.error(traceback.format_exc())
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
        logger.info(f"Request data keys: {list(data.keys() if data else [])}")
        logger.info(f"Content length: {len(data.get('content', '')) if data and 'content' in data else 'No content'}")
        
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
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error saving project simulation config: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

# Config management routes
@api.route('/configs', methods=['GET'])
def get_configs():
    """Get all configurations or configurations of a specific type"""
    try:
        config_type = request.args.get('type')
        if config_type:
            configs = config_manager.get_configs_by_type(config_type)
        else:
            configs = config_manager.get_all_configs()
            
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
        
        # Get the newly created config
        config = config_manager.get_config(config_id)
        
        return jsonify({
            "success": True, 
            "config": config,
            "config_id": config_id,
            "message": "Configuration saved successfully"
        })
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
            # Get the updated config
            config = config_manager.get_config(config_id)
            return jsonify({
                "success": True,
                "config": config,
                "message": "Configuration updated successfully"
            })
            
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
            return jsonify({"success": True, "message": "Configuration deleted successfully"})
        return jsonify({"success": False, "error": "Configuration not found"}), 404
    except Exception as e:
        logger.error(f"Error deleting configuration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/configs/clear', methods=['POST'])
def clear_configs():
    """Clear all configurations"""
    try:
        # Get parameters from request
        data = request.json or {}
        include_project_configs = data.get('include_project_configs', True)
        
        # Delete all configurations
        deleted_count = config_manager.clear_all_configs(include_project_configs)
        
        return jsonify({
            "success": True, 
            "deleted_count": deleted_count,
            "message": f"Successfully cleared {deleted_count} configurations"
        })
    except Exception as e:
        logger.error(f"Error clearing configurations: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

# Database generation routes
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
        
        # Pass configuration content directly to generate_database
        logger.info(f"Generating database directly from config content")
        db_path = generate_database(config['content'], output_dir, db_name)
        
        return jsonify({
            "success": True, 
            "database_path": str(db_path),
            "message": f"Database generated at: {db_path}"
        })
    except Exception as e:
        logger.error(f"Error generating database: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

# Simulation routes
@api.route('/run-simulation', methods=['POST'])
def run_sim():
    """Run a simulation on an existing database"""
    try:
        data = request.json
        if not data or not data.get('config_id') or not data.get('database_path'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        config = config_manager.get_config(data['config_id'])
        if not config:
            return jsonify({"success": False, "error": "Configuration not found"}), 404
            
        # Pass configuration content directly to run_simulation
        logger.info(f"Running simulation directly from config content")
        # Get database config if available
        db_config_id = data.get('db_config_id')
        db_config_content = None
        
        if db_config_id:
            db_config = config_manager.get_config(db_config_id)
            if db_config:
                db_config_content = db_config['content']
        
        # Run simulation with database config if available
        if db_config_content:
            results = run_simulation(config['content'], db_config_content, data['database_path'])
        else:
            # Fallback to old method for backward compatibility
            results = run_simulation(config['content'], data['database_path'])
        
        return jsonify({
            "success": True,
            "results": results,
            "message": "Simulation completed successfully"
        })
    except Exception as e:
        logger.error(f"Error running simulation: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/generate-and-simulate', methods=['POST'])
def generate_and_simulate():
    """Generate a database and run a simulation"""
    try:
        data = request.json
        if not data or not data.get('db_config_id') or not data.get('sim_config_id'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        db_config = config_manager.get_config(data['db_config_id'])
        sim_config = config_manager.get_config(data['sim_config_id'])
        
        if not db_config or not sim_config:
            return jsonify({"success": False, "error": "Configuration not found"}), 404
        
        # Check if we're in packaged mode (environment variable set by Electron)
        is_packaged = os.environ.get('DB_SIMULATOR_PACKAGED', 'false').lower() == 'true'
        logger.info(f"Running in {'packaged' if is_packaged else 'development'} mode")
        
        # Get environment output directory if specified
        output_base_dir = os.environ.get('DB_SIMULATOR_OUTPUT_DIR', None)
        
        if output_base_dir:
            logger.info(f"Using output directory from environment: {output_base_dir}")
            # Use the environment-specified directory
            output_dir = output_base_dir
        else:
            # Default to project root 'output' directory
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            output_dir = os.path.join(project_root, "output")
            logger.info(f"Using default output directory at project root: {output_dir}")
        
        # Create base output directory
        os.makedirs(output_dir, exist_ok=True)
        logger.info(f"Created or verified base output directory: {output_dir}")
        
        # Get project ID for project-specific folder
        project_id = data.get('project_id')
        db_name = data.get('name')
        
        # Generate complete database with all tables
        # Pass the project_id to ensure correct directory structure
        logger.info(f"Generating database with project_id: {project_id}")
        
        # --- Explicitly delete existing DB file first --- 
        try:
            # Construct preliminary path to check for existence before generation logic determines final name
            preliminary_db_name = db_name or db_config.get('name', 'database') # Use provided name or fallback
            if not preliminary_db_name.endswith('.db'):
                preliminary_db_name += '.db'
                
            target_dir = os.path.join(output_dir, project_id) if project_id else output_dir
            preliminary_db_path = os.path.join(target_dir, preliminary_db_name)
            
            logger.info(f"Checking for existing database file at: {preliminary_db_path}")
            if not safe_delete_sqlite_file(preliminary_db_path):
                logger.warning(f"Could not safely delete existing database file: {preliminary_db_path}")
        except Exception as del_err:
            logger.error(f"Error trying to delete existing database file: {del_err}")
        # --- Deletion attempt finished --- 
        
        db_path = generate_database(
            db_config['content'], 
            output_dir,
            db_name,
            project_id
        )
        
        # Log database creation with full details
        if os.path.exists(db_path):
            file_size = os.path.getsize(db_path)
            logger.info(f"Database file created successfully: {db_path}, size: {file_size} bytes")
            
            # Log directory contents for debugging
            db_dir = os.path.dirname(db_path)
            if os.path.exists(db_dir):
                logger.info(f"Contents of database directory {db_dir}:")
                for f in os.listdir(db_dir):
                    file_path = os.path.join(db_dir, f)
                    if os.path.isfile(file_path):
                        logger.info(f"  - {f} ({os.path.getsize(file_path)} bytes)")
        else:
            logger.error(f"Database file was not created at expected path: {db_path}")
            # Try to log the output directory contents
            if os.path.exists(output_dir):
                logger.info(f"Contents of output directory {output_dir}:")
                for f in os.listdir(output_dir):
                    logger.info(f"  - {f}")
                    
                # Check if project directory exists
                if project_id:
                    project_dir = os.path.join(output_dir, project_id)
                    if os.path.exists(project_dir):
                        logger.info(f"Contents of project directory {project_dir}:")
                        for f in os.listdir(project_dir):
                            file_path = os.path.join(project_dir, f)
                            if os.path.isfile(file_path):
                                file_size = os.path.getsize(file_path)
                                logger.info(f"  - {f} ({file_size} bytes)")
                    else:
                        logger.warning(f"Project directory does not exist: {project_dir}")
            
            return jsonify({
                "success": False,
                "error": f"Failed to create database file at {db_path}"
            }), 500
        
        # Run simulation
        logger.info(f"Running simulation using database at: {db_path}")
        # Pass both sim and db config content to run_simulation
        results = run_simulation(
            sim_config['content'],
            db_config['content'],
            db_path
        )
        
        # Verify database file after simulation
        if os.path.exists(db_path):
            file_size = os.path.getsize(db_path)
            logger.info(f"Database file exists after simulation: {db_path}, size: {file_size} bytes")
            
            # Verify database has tables and content
            conn = None
            try:
                import sqlite3
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                logger.info(f"Database contains {len(tables)} tables: {[t[0] for t in tables]}")
                
                # Count rows in a few key tables
                for table_name in [t[0] for t in tables]:
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
                        count = cursor.fetchone()[0]
                        logger.info(f"Table '{table_name}' has {count} rows")
                    except Exception as e:
                        logger.error(f"Error counting rows in table '{table_name}': {e}")
                
            except Exception as e:
                logger.error(f"Error verifying database content: {e}")
            finally:
                # ALWAYS close the database connection to prevent EBUSY errors on Windows
                if conn:
                    try:
                        conn.close()
                        logger.debug(f"Database verification connection closed for: {db_path}")
                    except Exception as close_err:
                        logger.warning(f"Error closing verification connection: {close_err}")
            
            # Create a relative path for the frontend to use
            db_filename = os.path.basename(db_path)
            
            # For project-specific path
            if project_id:
                relative_path = f"output/{project_id}/{db_filename}"
            else:
                relative_path = f"output/{db_filename}"
                
            logger.info(f"Using relative path for frontend: {relative_path}")
            db_path_for_response = relative_path
        else:
            logger.error(f"Database file not found after simulation: {db_path}")
            # Try to find the file by pattern matching
            expected_dir = os.path.dirname(db_path)
            if os.path.exists(expected_dir):
                files = os.listdir(expected_dir)
                db_files = [f for f in files if f.endswith('.db')]
                if db_files:
                    logger.info(f"Found alternative database files in directory: {db_files}")
                    
                    # Use the first database file found as a fallback
                    alternative_db = os.path.join(expected_dir, db_files[0])
                    logger.info(f"Using alternative database file: {alternative_db}")
                    
                    # Create a relative path for the frontend
                    if project_id:
                        relative_path = f"output/{project_id}/{db_files[0]}"
                    else:
                        relative_path = f"output/{db_files[0]}"
                        
                    logger.info(f"Using alternative relative path for frontend: {relative_path}")
                    db_path_for_response = relative_path
                else:
                    logger.error(f"No database files found in directory: {expected_dir}")
                    db_path_for_response = str(db_path)
            else:
                logger.error(f"Expected directory does not exist: {expected_dir}")
                db_path_for_response = str(db_path)
        
        # Make sure path uses forward slashes for consistent handling in frontend
        db_path_for_response = db_path_for_response.replace('\\', '/')
        
        # Add a final verification that the database file exists in the expected location
        # This helps diagnose issues where the backend and frontend have different path expectations
        try:
            # Try different ways of resolving the path
            potential_paths = [
                db_path,  # Original absolute path
                db_path_for_response,  # Relative path for frontend
                os.path.join(output_dir, db_path_for_response.replace('output/', ''))  # Resolved from output dir
            ]
            
            # Check if any of these paths exist
            found = False
            for path in potential_paths:
                if os.path.exists(path):
                    logger.info(f"Final verification: Database exists at: {path}")
                    found = True
                    break
            
            if not found:
                logger.warning("Final verification: Database file not found at any expected location")
        except Exception as e:
            logger.error(f"Error in final verification: {e}")
        
        return jsonify({
            "success": True,
            "database_path": db_path_for_response,
            "results": results,
            "message": "Generate-and-simulate completed successfully"
        })
    except Exception as e:
        logger.error(f"Error in generate-and-simulate: {e}")
        import traceback
        logger.error(traceback.format_exc())
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

@api.route('/force-cleanup', methods=['POST'])
def force_cleanup():
    """
    Force cleanup of database connections and resources.
    This is a workaround for EBUSY errors on Windows caused by persistent connections.
    """
    try:
        # Force garbage collection to clean up any lingering objects
        import gc
        gc.collect()
        
        # Give a small delay for OS to release handles
        import time
        time.sleep(0.1)
        
        logger.info("Forced cleanup completed")
        return jsonify({'message': 'Cleanup completed successfully'})
        
    except Exception as e:
        logger.error(f"Error during forced cleanup: {e}")
        return jsonify({'error': str(e)}), 500 