"""
Project management routes for DB Simulator API.
Handles CRUD operations for projects.
"""

import logging
import sys
import os

# Add parent directory to sys.path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from flask import Blueprint, request
from config_storage.config_db import ConfigManager
from ..utils.response_helpers import (
    success_response, error_response, not_found_response, 
    handle_exception, require_json_fields, log_api_request
)

# Create Blueprint
projects_bp = Blueprint('projects', __name__)

# Initialize configuration manager
config_manager = ConfigManager()

# Create logger
logger = logging.getLogger(__name__)

@projects_bp.route('/projects', methods=['GET'])
def get_projects():
    """Get all projects"""
    try:
        log_api_request(logger, "Get all projects")
        projects = config_manager.get_all_projects()
        return success_response({"projects": projects})
    except Exception as e:
        return handle_exception(e, "retrieving projects", logger)

@projects_bp.route('/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get a specific project by ID"""
    try:
        log_api_request(logger, "Get project", project_id)
        project = config_manager.get_project(project_id)
        
        if project:
            return success_response({"project": project})
        
        return not_found_response("Project")
    except Exception as e:
        return handle_exception(e, "retrieving project", logger)

@projects_bp.route('/projects', methods=['POST'])
def create_project():
    """Create a new project"""
    try:
        log_api_request(logger, "Create project")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['name'])
        if validation_error:
            return validation_error
        
        project_id = config_manager.create_project(
            data['name'],
            data.get('description', '')
        )
        
        # Get the newly created project
        project = config_manager.get_project(project_id)
        
        return success_response(
            {"project": project},
            message="Project created successfully"
        )
    except Exception as e:
        return handle_exception(e, "creating project", logger)

@projects_bp.route('/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update an existing project"""
    try:
        log_api_request(logger, "Update project", project_id)
        
        if not request.is_json:
            return error_response("Request must be JSON", status_code=400)
        
        data = request.get_json()
        if not data:
            return error_response("Missing data", status_code=400)
        
        success = config_manager.update_project(
            project_id,
            data.get('name'),
            data.get('description')
        )
        
        if success:
            # Get the updated project
            project = config_manager.get_project(project_id)
            return success_response(
                {"project": project},
                message="Project updated successfully"
            )
        
        return not_found_response("Project")
    except Exception as e:
        return handle_exception(e, "updating project", logger)

@projects_bp.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project"""
    try:
        log_api_request(logger, "Delete project", project_id)
        
        success = config_manager.delete_project(project_id)
        
        if success:
            return success_response(message="Project deleted successfully")
        
        return not_found_response("Project")
    except Exception as e:
        return handle_exception(e, "deleting project", logger)