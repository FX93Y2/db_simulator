"""
Error handling middleware for DB Simulator API.
Provides global error handlers and exception handling.
"""

from flask import jsonify
import logging

logger = logging.getLogger(__name__)

def register_error_handlers(app):
    """Register global error handlers with the Flask app."""
    
    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 Bad Request errors."""
        return jsonify({
            "success": False,
            "error": "Bad request"
        }), 400
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 Not Found errors."""
        return jsonify({
            "success": False,
            "error": "Resource not found"
        }), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        """Handle 405 Method Not Allowed errors."""
        return jsonify({
            "success": False,
            "error": "Method not allowed"
        }), 405
    
    @app.errorhandler(500)
    def internal_server_error(error):
        """Handle 500 Internal Server Error."""
        logger.error(f"Internal server error: {error}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500
    
    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        """Handle any unexpected exceptions."""
        logger.error(f"Unexpected error: {error}")
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred"
        }), 500