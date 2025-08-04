"""
Configuration management routes for DB Simulator API.
Handles database and simulation configuration CRUD operations.
"""

import logging
import sys
import os

# Add parent directory to sys.path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from flask import Blueprint, request
from config_storage.config_db import ConfigManager
from ..utils.response_helpers import (
    success_response, error_response, not_found_response, validation_error_response,
    handle_exception, require_json_fields, log_api_request
)
from ..utils.validators import validate_yaml_content, validate_event_flows_structure

# Create Blueprint
configurations_bp = Blueprint('configurations', __name__)

# Initialize configuration manager
config_manager = ConfigManager()

# Create logger
logger = logging.getLogger(__name__)

# Project configuration routes
@configurations_bp.route('/projects/<project_id>/db-config', methods=['GET'])
def get_project_db_config(project_id):
    """Get the database configuration for a project"""
    try:
        log_api_request(logger, "Get project DB config", project_id)
        
        project = config_manager.get_project(project_id)
        if not project:
            return not_found_response("Project")
        
        config = config_manager.get_project_config(project_id, 'database')
        
        if config:
            return success_response({
                "config": config,
                "projectName": project.get('name')
            })
        else:
            return success_response({
                "config": None,
                "projectName": project.get('name'),
                "message": "No database configuration found for this project"
            })
    except Exception as e:
        return handle_exception(e, "retrieving project DB config", logger)

@configurations_bp.route('/projects/<project_id>/db-config', methods=['POST'])
def save_project_db_config(project_id):
    """Save database configuration for a project"""
    try:
        log_api_request(logger, "Save project DB config", project_id, 
                       f"Content length: {len(request.get_json().get('content', '')) if request.is_json else 'No JSON'}")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['content'])
        if validation_error:
            return validation_error
        
        # Check if project exists
        project = config_manager.get_project(project_id)
        if not project:
            return not_found_response("Project")
        
        # Validate the YAML content
        yaml_validation = validate_yaml_content(data.get('content', ''))
        if not yaml_validation['valid']:
            return validation_error_response(f"Invalid YAML content: {yaml_validation['error']}")
        
        config_id = config_manager.save_project_config(
            project_id,
            'database',
            data.get('name', f"{project['name']} DB Config"),
            data['content'],
            data.get('description', '')
        )
        
        # Get the newly created/updated config
        config = config_manager.get_config(config_id)
        
        return success_response({
            "config": config,
            "config_id": config_id
        }, message="Database configuration saved successfully")
        
    except Exception as e:
        return handle_exception(e, "saving project DB config", logger)

@configurations_bp.route('/projects/<project_id>/sim-config', methods=['GET'])
def get_project_sim_config(project_id):
    """Get the simulation configuration for a project"""
    try:
        log_api_request(logger, "Get project simulation config", project_id)
        
        project = config_manager.get_project(project_id)
        if not project:
            return not_found_response("Project")
        
        config = config_manager.get_project_config(project_id, 'simulation')
        
        if config:
            return success_response({
                "config": config,
                "projectName": project.get('name')
            })
        else:
            return success_response({
                "config": None,
                "projectName": project.get('name'),
                "message": "No simulation configuration found for this project"
            })
    except Exception as e:
        return handle_exception(e, "retrieving project simulation config", logger)

@configurations_bp.route('/projects/<project_id>/sim-config', methods=['POST'])
def save_project_sim_config(project_id):
    """Save simulation configuration for a project"""
    try:
        log_api_request(logger, "Save project simulation config", project_id,
                       f"Content length: {len(request.get_json().get('content', '')) if request.is_json else 'No JSON'}")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['content'])
        if validation_error:
            return validation_error
        
        # Check if project exists
        project = config_manager.get_project(project_id)
        if not project:
            return not_found_response("Project")
        
        # Validate the YAML content
        yaml_validation = validate_yaml_content(data.get('content', ''))
        if not yaml_validation['valid']:
            return validation_error_response(f"Invalid YAML content: {yaml_validation['error']}")
        
        # Validate event_flows structure if present
        validation_result = validate_event_flows_structure(yaml_validation['parsed'])
        if not validation_result['valid']:
            return validation_error_response(
                f"Invalid event flows configuration: {validation_result['error']}",
                details=validation_result.get('details', [])
            )
        
        config_id = config_manager.save_project_config(
            project_id,
            'simulation',
            data.get('name', f"{project['name']} Simulation Config"),
            data['content'],
            data.get('description', '')
        )
        
        # Get the newly created/updated config
        config = config_manager.get_config(config_id)
        
        return success_response({
            "config": config,
            "config_id": config_id
        }, message="Simulation configuration saved successfully")
        
    except Exception as e:
        return handle_exception(e, "saving project simulation config", logger)

# General config management routes
@configurations_bp.route('/configs', methods=['GET'])
def get_configs():
    """Get all configurations or configurations of a specific type"""
    try:
        config_type = request.args.get('type')
        log_api_request(logger, f"Get configs", extra_info=f"type: {config_type}" if config_type else "all")
        
        if config_type:
            configs = config_manager.get_configs_by_type(config_type)
        else:
            configs = config_manager.get_all_configs()
        
        return success_response({"configs": configs})
    except Exception as e:
        return handle_exception(e, "retrieving configurations", logger)

@configurations_bp.route('/configs/<config_id>', methods=['GET'])
def get_config(config_id):
    """Get a specific configuration by ID"""
    try:
        log_api_request(logger, "Get config", extra_info=f"config_id: {config_id}")
        
        config = config_manager.get_config(config_id)
        
        if config:
            return success_response({"config": config})
        
        return not_found_response("Configuration")
    except Exception as e:
        return handle_exception(e, "retrieving configuration", logger)

@configurations_bp.route('/configs', methods=['POST'])
def save_config():
    """Save a new configuration"""
    try:
        log_api_request(logger, "Save new config")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['name', 'config_type', 'content'])
        if validation_error:
            return validation_error
        
        config_id = config_manager.save_config(
            data['name'], 
            data['config_type'], 
            data['content'],
            data.get('description', '')
        )
        
        # Get the newly created config
        config = config_manager.get_config(config_id)
        
        return success_response({
            "config": config,
            "config_id": config_id
        }, message="Configuration saved successfully")
        
    except Exception as e:
        return handle_exception(e, "saving configuration", logger)

@configurations_bp.route('/configs/<config_id>', methods=['PUT'])
def update_config(config_id):
    """Update an existing configuration"""
    try:
        log_api_request(logger, "Update config", extra_info=f"config_id: {config_id}")
        
        if not request.is_json:
            return error_response("Request must be JSON", status_code=400)
        
        data = request.get_json()
        if not data:
            return error_response("Missing data", status_code=400)
        
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
            return success_response({
                "config": config
            }, message="Configuration updated successfully")
        
        return not_found_response("Configuration")
    except Exception as e:
        return handle_exception(e, "updating configuration", logger)

@configurations_bp.route('/configs/<config_id>', methods=['DELETE'])
def delete_config(config_id):
    """Delete a configuration"""
    try:
        log_api_request(logger, "Delete config", extra_info=f"config_id: {config_id}")
        
        success = config_manager.delete_config(config_id)
        
        if success:
            return success_response(message="Configuration deleted successfully")
        
        return not_found_response("Configuration")
    except Exception as e:
        return handle_exception(e, "deleting configuration", logger)

@configurations_bp.route('/configs/clear', methods=['POST'])
def clear_configs():
    """Clear all configurations"""
    try:
        log_api_request(logger, "Clear all configs")
        
        # Get parameters from request
        data = request.get_json() or {}
        include_project_configs = data.get('include_project_configs', True)
        
        # Delete all configurations
        deleted_count = config_manager.clear_all_configs(include_project_configs)
        
        return success_response({
            "deleted_count": deleted_count
        }, message=f"Successfully cleared {deleted_count} configurations")
        
    except Exception as e:
        return handle_exception(e, "clearing configurations", logger)