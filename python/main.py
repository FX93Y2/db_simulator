"""
Main entry point for DB Simulator Python backend.
Provides APIs for Electron frontend integration.
"""

import argparse
import logging
import sys
import os
from flask import Flask, request, jsonify

# Import components from refactored structure
from src.generator import generate_database, generate_database_for_simulation
from src.simulation.runner import run_simulation, run_simulation_from_config_dir
from config_storage.config_db import ConfigManager

# Import the API Blueprint
from api.routes import api

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize the Flask app
app = Flask(__name__)

# Register the API Blueprint
app.register_blueprint(api, url_prefix='/api')

# Initialize configuration manager
config_manager = ConfigManager()

@app.route('/api/config', methods=['GET'])
def get_configs():
    """Get all saved configurations"""
    try:
        configs = config_manager.get_all_configs()
        return jsonify({"success": True, "configs": configs})
    except Exception as e:
        logger.error(f"Error retrieving configurations: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/config/<config_id>', methods=['GET'])
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

@app.route('/api/config', methods=['POST'])
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

@app.route('/api/config/<config_id>', methods=['PUT'])
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

@app.route('/api/config/<config_id>', methods=['DELETE'])
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

@app.route('/api/generate', methods=['POST'])
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

@app.route('/api/simulate', methods=['POST'])
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

@app.route('/api/dynamic-simulate', methods=['POST'])
def dynamic_simulate():
    """Generate a database and run simulation"""
    logger.warning("The /api/dynamic-simulate endpoint is deprecated. Please use /api/generate-simulate instead.")
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
        
        # Use generate_database instead of generate_database_for_simulation for better reliability
        db_path = generate_database(
            db_config['content'], 
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

@app.route('/api/generate-simulate', methods=['POST'])
def generate_simulate():
    """Generate a complete database and run simulation with proper table relationships"""
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
        
        # Generate complete database with all tables
        db_path = generate_database(
            db_config['content'], 
            output_dir,
            db_name
        )
        
        results = run_simulation(sim_config['content'], db_path)
        return jsonify({
            "success": True,
            "database_path": str(db_path),
            "results": results,
            "message": "Generate-simulate completed successfully with proper table relationships"
        })
    except Exception as e:
        logger.error(f"Error in generate-simulate: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

def run_api(host='127.0.0.1', port=5000):
    """Run the Flask API server"""
    app.run(host=host, port=port, debug=False)

def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description='DB Simulator')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # API server command
    api_parser = subparsers.add_parser('api', help='Start the API server')
    api_parser.add_argument('--host', default='127.0.0.1', help='Host to bind the API server')
    api_parser.add_argument('--port', type=int, default=5000, help='Port to bind the API server')
    
    # Generate database command (preserved for CLI compatibility)
    gen_parser = subparsers.add_parser('generate', help='Generate a synthetic database')
    gen_parser.add_argument('config', help='Path to database configuration file')
    gen_parser.add_argument('--output-dir', '-o', default='output', help='Output directory')
    gen_parser.add_argument('--name', '-n', help='Database name (without extension)')
    
    # Run simulation command (preserved for CLI compatibility)
    sim_parser = subparsers.add_parser('simulate', help='Run a simulation')
    sim_parser.add_argument('config', help='Path to simulation configuration file')
    sim_parser.add_argument('database', help='Path to SQLite database file')
    
    # Generate resources and run simulation command
    dynamic_parser = subparsers.add_parser('dynamic-simulate', 
                                          help='[DEPRECATED] Generate a database with only resource tables and run a simulation (use generate-simulate instead)')
    dynamic_parser.add_argument('db_config', help='Path to database configuration file')
    dynamic_parser.add_argument('sim_config', help='Path to simulation configuration file')
    dynamic_parser.add_argument('--output-dir', '-o', default='output', help='Output directory')
    dynamic_parser.add_argument('--name', '-n', help='Database name (without extension)')
    
    # New command that properly handles relationship columns
    gen_sim_parser = subparsers.add_parser('generate-simulate',
                                         help='Generate a complete database and run a simulation with proper table relationships')
    gen_sim_parser.add_argument('db_config', help='Path to database configuration file')
    gen_sim_parser.add_argument('sim_config', help='Path to simulation configuration file')
    gen_sim_parser.add_argument('--output-dir', '-o', default='output', help='Output directory')
    gen_sim_parser.add_argument('--name', '-n', help='Database name (without extension)')
    
    # Parse arguments
    args = parser.parse_args()
    
    if args.command == 'api':
        run_api(host=args.host, port=args.port)
    elif args.command == 'generate':
        try:
            db_path = generate_database(args.config, args.output_dir, args.name)
            logger.info(f"Database generated at: {db_path}")
        except Exception as e:
            logger.error(f"Error generating database: {e}")
            sys.exit(1)
    elif args.command == 'simulate':
        try:
            results = run_simulation(args.config, args.database)
            logger.info(f"Simulation results: {results}")
        except Exception as e:
            logger.error(f"Error running simulation: {e}")
            sys.exit(1)
    elif args.command == 'dynamic-simulate':
        logger.warning("The 'dynamic-simulate' command is deprecated and may be removed in future versions. Please use 'generate-simulate' instead.")
        try:
            # Use generate_database instead of generate_database_for_simulation for better reliability
            db_path = generate_database(args.db_config, args.output_dir, args.name)
            logger.info(f"Database generated at: {db_path}")
            
            # Run simulation with dynamic entity generation
            results = run_simulation(args.sim_config, db_path)
            logger.info(f"Simulation results: {results}")
        except Exception as e:
            logger.error(f"Error in dynamic simulation: {e}")
            sys.exit(1)
    elif args.command == 'generate-simulate':
        try:
            # This command fixes the relationship column issue by:
            # 1. Creating a full database with all tables (not just resources)
            # 2. Running the simulation on this complete database
            
            # Generate complete database with all tables including Project and Deliverable
            db_path = generate_database(args.db_config, args.output_dir, args.name)
            logger.info(f"Complete database generated at: {db_path}")
            
            # Run simulation on the complete database
            results = run_simulation(args.sim_config, db_path)
            logger.info(f"Simulation results: {results}")
        except Exception as e:
            logger.error(f"Error in generate-simulate: {e}")
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == '__main__':
    main() 