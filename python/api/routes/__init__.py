"""
Routes package for DB Simulator API.
Contains modular route definitions organized by functional area.
"""

from flask import Blueprint

# Import all route modules
from .projects import projects_bp
from .configurations import configurations_bp
from .database import database_bp
from .simulation import simulation_bp
from .results import results_bp
from .validation import validation_bp

def register_routes(app):
    """Register all route blueprints with the Flask app."""
    # Register all blueprints with /api prefix
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(configurations_bp, url_prefix='/api')
    app.register_blueprint(database_bp, url_prefix='/api')
    app.register_blueprint(simulation_bp, url_prefix='/api')
    app.register_blueprint(results_bp, url_prefix='/api')
    app.register_blueprint(validation_bp, url_prefix='/api')