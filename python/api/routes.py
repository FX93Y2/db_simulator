"""
API routes for DB Simulator.
This module defines the Flask routes for the Electron integration.
"""

from flask import Blueprint, request, jsonify
import logging

from python.src.generator import generate_database, generate_database_for_simulation
from python.src.simulation.runner import run_simulation, run_simulation_from_config_dir
from python.config_storage.config_db import ConfigManager

# Create logger
logger = logging.getLogger(__name__)

# Create Blueprint
api = Blueprint('api', __name__)

# Initialize configuration manager
config_manager = ConfigManager()

@api.route('/config', methods=['GET'])
def get_configs():
    """Get all saved configurations"""
    try:
        configs = config_manager.get_all_configs()
        return jsonify({"success": True, "configs": configs})
    except Exception as e:
        logger.error(f"Error retrieving configurations: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/config/<config_id>', methods=['GET'])
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

@api.route('/config', methods=['POST'])
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

@api.route('/config/<config_id>', methods=['PUT'])
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

@api.route('/config/<config_id>', methods=['DELETE'])
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

@api.route('/generate', methods=['POST'])
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

@api.route('/simulate', methods=['POST'])
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

@api.route('/dynamic-simulate', methods=['POST'])
def dynamic_simulate():
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

@api.route('/import-config', methods=['POST'])
def import_config():
    """Import a configuration from a file"""
    try:
        data = request.json
        if not data or not data.get('file_path') or not data.get('config_type'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        config_id = config_manager.import_from_file(data['file_path'], data['config_type'])
        return jsonify({
            "success": True,
            "config_id": config_id,
            "message": "Configuration imported successfully"
        })
    except Exception as e:
        logger.error(f"Error importing configuration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@api.route('/export-config', methods=['POST'])
def export_config():
    """Export a configuration to a file"""
    try:
        data = request.json
        if not data or not data.get('config_id') or not data.get('output_dir'):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
            
        file_path = config_manager.export_to_file(data['config_id'], data['output_dir'])
        return jsonify({
            "success": True,
            "file_path": file_path,
            "message": f"Configuration exported to {file_path}"
        })
    except Exception as e:
        logger.error(f"Error exporting configuration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500 