"""
Flask server for DB Simulator API.
Provides API endpoints for the Electron frontend to interact with.
"""

import os
import logging
import sys
from flask import Flask
from flask_cors import CORS

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import the modular routes registration function
from api.routes import register_routes
from api.middleware.error_handlers import register_error_handlers

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Enable CORS for Electron frontend
    CORS(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register all modular routes
    register_routes(app)
    
    # Index route for health check
    @app.route('/')
    def index():
        return {"status": "OK", "service": "DB Simulator API"}
    
    return app

def run_server(host='127.0.0.1', port=5000, debug=False):
    """Run the Flask server"""
    app = create_app()
    logger.info(f"Starting DB Simulator API server on {host}:{port}")
    app.run(host=host, port=port, debug=debug)

if __name__ == '__main__':
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 5000))
    run_server(host='127.0.0.1', port=port, debug=True) 