"""
Configuration validation routes for DB Simulator API.
Handles configuration validation and step template generation.
"""

import logging
import sys
import os

# Add parent directory to sys.path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from flask import Blueprint, request
from ..utils.response_helpers import (
    success_response, error_response, validation_error_response,
    handle_exception, require_json_fields, log_api_request
)
from ..utils.validators import validate_yaml_content, validate_event_flows_structure
from ..utils.step_types import get_step_types_info, generate_step_template, get_valid_step_types

# Create Blueprint
validation_bp = Blueprint('validation', __name__)

# Create logger
logger = logging.getLogger(__name__)

@validation_bp.route('/step-types', methods=['GET'])
def get_step_types():
    """Get information about supported step types for frontend UI."""
    try:
        log_api_request(logger, "Get step types")
        
        step_types_info = get_step_types_info()
        return success_response({"step_types": step_types_info})
        
    except Exception as e:
        return handle_exception(e, "getting step types", logger)

@validation_bp.route('/validate-simulation-config', methods=['POST'])
def validate_simulation_config():
    """Validate a simulation configuration without saving it."""
    try:
        log_api_request(logger, "Validate simulation config")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['config'])
        if validation_error:
            return validation_error
        
        config_content = data['config']
        
        # Parse and validate YAML
        yaml_validation = validate_yaml_content(config_content)
        if not yaml_validation['valid']:
            return validation_error_response(yaml_validation['error'])
        
        # Validate event_flows structure
        validation_result = validate_event_flows_structure(yaml_validation['parsed'])
        
        if validation_result['valid']:
            return success_response({
                "details": validation_result.get('details', [])
            }, message="Configuration is valid")
        else:
            return validation_error_response(
                validation_result['error'],
                details=validation_result.get('details', [])
            )
            
    except Exception as e:
        return handle_exception(e, "validating simulation config", logger)

@validation_bp.route('/generate-step-template', methods=['POST'])
def generate_step_template_route():
    """Generate a template for a specific step type."""
    try:
        log_api_request(logger, "Generate step template")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['step_type'])
        if validation_error:
            return validation_error
        
        step_type = data['step_type']
        step_id = data.get('step_id')
        
        # Validate step type
        if step_type not in get_valid_step_types():
            return validation_error_response(f"Unknown step type: {step_type}")
        
        # Generate template
        template = generate_step_template(step_type, step_id)
        step_types_info = get_step_types_info()
        
        return success_response({
            "template": template,
            "info": step_types_info[step_type]
        })
        
    except Exception as e:
        return handle_exception(e, "generating step template", logger)

@validation_bp.route('/simulation-config/preview', methods=['POST'])
def preview_simulation_config():
    """Preview how a simulation configuration will be executed."""
    try:
        log_api_request(logger, "Preview simulation config")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['config'])
        if validation_error:
            return validation_error
        
        config_content = data['config']
        
        # Parse configuration
        yaml_validation = validate_yaml_content(config_content)
        if not yaml_validation['valid']:
            return validation_error_response(yaml_validation['error'])
        
        parsed_config = yaml_validation['parsed']
        
        # Validate first
        validation_result = validate_event_flows_structure(parsed_config)
        if not validation_result['valid']:
            return validation_error_response(f"Invalid configuration: {validation_result['error']}")
        
        # Generate preview data
        preview_data = _generate_preview_data(parsed_config)
        
        return success_response({"preview": preview_data})
        
    except Exception as e:
        return handle_exception(e, "previewing simulation config", logger)

@validation_bp.route('/health', methods=['GET'])
def health_check():
    """
    Simple health check endpoint to verify the API is running.
    Used by Electron frontend to check if backend is ready.
    """
    return success_response(message="API is running", status="ok")

def _generate_preview_data(parsed_config):
    """Generate preview data from parsed configuration."""
    preview_data = {
        "flows": [],
        "total_steps": 0,
        "step_types_count": {"event": 0, "decide": 0, "release": 0, "assign": 0, "create": 0}
    }
    
    if 'event_simulation' in parsed_config and 'event_flows' in parsed_config['event_simulation']:
        for flow in parsed_config['event_simulation']['event_flows']:
            flow_preview = {
                "flow_id": flow['flow_id'],
                "steps_count": len(flow['steps']),
                "steps": []
            }
            
            for step in flow['steps']:
                step_preview = _generate_step_preview(step)
                flow_preview["steps"].append(step_preview)
                
                # Update counters
                step_type = step['step_type']
                if step_type in preview_data["step_types_count"]:
                    preview_data["step_types_count"][step_type] += 1
                preview_data["total_steps"] += 1
            
            preview_data["flows"].append(flow_preview)
    
    return preview_data

def _generate_step_preview(step):
    """Generate preview information for a single step."""
    step_preview = {
        "step_id": step['step_id'],
        "step_type": step['step_type'],
        "description": ""
    }
    
    step_type = step['step_type']
    
    # Add type-specific information
    if step_type == 'event':
        if 'event_config' in step:
            step_preview["description"] = f"Event: {step['event_config'].get('name', 'Unnamed')}"
            if 'resource_requirements' in step['event_config']:
                step_preview["resources"] = len(step['event_config']['resource_requirements'])
    
    elif step_type == 'decide':
        if 'decide_config' in step:
            outcomes_count = len(step['decide_config'].get('outcomes', []))
            step_preview["description"] = f"Decision: {outcomes_count} outcomes"
    
    elif step_type == 'assign':
        if 'assign_config' in step:
            assignments_count = len(step['assign_config'].get('assignments', []))
            step_preview["description"] = f"Assign: {assignments_count} assignments"
    
    elif step_type == 'release':
        step_preview["description"] = "Release resources"
    
    elif step_type == 'create':
        if 'create_config' in step:
            entity_table = step['create_config'].get('entity_table', 'Unknown')
            step_preview["description"] = f"Create entities in {entity_table}"
    
    return step_preview