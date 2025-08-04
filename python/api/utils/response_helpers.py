"""
Response helper utilities for DB Simulator API.
Provides standardized response patterns and error handling.
"""

from flask import jsonify
import logging
import traceback

logger = logging.getLogger(__name__)

def success_response(data=None, message=None, **kwargs):
    """
    Create a standardized success response.
    
    Args:
        data: Response data
        message: Success message
        **kwargs: Additional fields to include in response
        
    Returns:
        Flask JSON response
    """
    response = {"success": True}
    
    if data is not None:
        response.update(data)
    
    if message:
        response["message"] = message
    
    response.update(kwargs)
    
    return jsonify(response)

def error_response(error_message, status_code=500, details=None, **kwargs):
    """
    Create a standardized error response.
    
    Args:
        error_message: Error message string
        status_code: HTTP status code
        details: Additional error details
        **kwargs: Additional fields to include in response
        
    Returns:
        Flask JSON response with error status code
    """
    response = {
        "success": False,
        "error": error_message
    }
    
    if details:
        response["details"] = details
    
    response.update(kwargs)
    
    return jsonify(response), status_code

def validation_error_response(error_message, details=None):
    """
    Create a standardized validation error response.
    
    Args:
        error_message: Validation error message
        details: Additional validation details
        
    Returns:
        Flask JSON response with 400 status code
    """
    return error_response(error_message, status_code=400, details=details)

def not_found_response(resource_name="Resource"):
    """
    Create a standardized not found response.
    
    Args:
        resource_name: Name of the resource that was not found
        
    Returns:
        Flask JSON response with 404 status code
    """
    return error_response(f"{resource_name} not found", status_code=404)

def handle_exception(e, operation_name, logger_instance=None):
    """
    Handle exceptions with consistent logging and response.
    
    Args:
        e: Exception instance
        operation_name: Name of the operation that failed
        logger_instance: Logger to use (defaults to module logger)
        
    Returns:
        Flask JSON response with 500 status code
    """
    log = logger_instance or logger
    log.error(f"Error in {operation_name}: {e}")
    log.error(traceback.format_exc())
    
    return error_response(str(e), status_code=500)

def require_json_fields(request, required_fields):
    """
    Validate that required fields are present in JSON request.
    
    Args:
        request: Flask request object
        required_fields: List of required field names
        
    Returns:
        tuple: (data, error_response) - data is None if validation fails
    """
    if not request.is_json:
        return None, validation_error_response("Request must be JSON")
    
    data = request.get_json()
    
    if not data:
        return None, validation_error_response("Missing request data")
    
    missing_fields = [field for field in required_fields if not data.get(field)]
    
    if missing_fields:
        return None, validation_error_response(
            f"Missing required fields: {', '.join(missing_fields)}"
        )
    
    return data, None

def log_api_request(logger_instance, operation, project_id=None, extra_info=None):
    """
    Log API request with consistent format.
    
    Args:
        logger_instance: Logger to use
        operation: Operation being performed
        project_id: Project ID if applicable
        extra_info: Additional information to log
    """
    log_message = f"API Request: {operation}"
    
    if project_id:
        log_message += f" (project: {project_id})"
    
    if extra_info:
        log_message += f" - {extra_info}"
    
    logger_instance.info(log_message)