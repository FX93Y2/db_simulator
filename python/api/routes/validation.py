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


@validation_bp.route('/health', methods=['GET'])
def health_check():
    """
    Simple health check endpoint to verify the API is running.
    Used by Electron frontend to check if backend is ready.
    """
    return success_response(message="API is running", status="ok")

