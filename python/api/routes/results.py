"""
Results retrieval and export routes for DB Simulator API.
Handles simulation results analysis and data export operations.
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

# Create Blueprint
results_bp = Blueprint('results', __name__)

# Create logger
logger = logging.getLogger(__name__)

@results_bp.route('/results/summary', methods=['GET'])
def get_simulation_results():
    """Get summary data about a simulation result database"""
    try:
        database_path = request.args.get('database_path')
        if not database_path:
            return validation_error_response("Missing database_path parameter")
        
        log_api_request(logger, "Get simulation results", extra_info=f"path: {database_path}")
        
        # Here you would extract summary data from the database
        # For now, we'll return some placeholder data
        summary_data = {
            "simulationId": "sim123",
            "runDate": "2023-12-15T15:30:00Z",
            "duration": 30,
            "entitiesCount": 50,
            "eventsCount": 120
        }
        
        return success_response({"data": summary_data})
        
    except Exception as e:
        return handle_exception(e, "retrieving simulation results", logger)

@results_bp.route('/results/tables', methods=['GET'])
def get_database_tables():
    """Get list of tables in a result database"""
    try:
        database_path = request.args.get('database_path')
        if not database_path:
            return validation_error_response("Missing database_path parameter")
        
        log_api_request(logger, "Get database tables", extra_info=f"path: {database_path}")
        
        # Here you would query the database for its tables
        # For now, we'll return some example tables
        tables = [
            "Entity",
            "Event",
            "Resource",
            "ResourceAllocation",
            "SimulationLog"
        ]
        
        return success_response({"tables": tables})
        
    except Exception as e:
        return handle_exception(e, "retrieving database tables", logger)

@results_bp.route('/results/table-data', methods=['GET'])
def get_table_data():
    """Get data from a specific table"""
    try:
        database_path = request.args.get('databasePath')
        table_name = request.args.get('tableName')
        limit = request.args.get('limit', 1000)
        
        if not database_path or not table_name:
            return validation_error_response("Missing required parameters")
        
        log_api_request(logger, "Get table data", extra_info=f"table: {table_name}, path: {database_path}")
        
        # Here you would query the database for the table data
        mock_data = _generate_mock_table_data(table_name)
        
        return success_response({"data": mock_data})
        
    except Exception as e:
        return handle_exception(e, "retrieving table data", logger)

@results_bp.route('/results/export-csv', methods=['POST'])
def export_database_to_csv():
    """Export database tables to CSV files"""
    try:
        log_api_request(logger, "Export database to CSV")
        
        # Validate request data
        data, validation_error = require_json_fields(request, ['database_path', 'export_path'])
        if validation_error:
            return validation_error
        
        database_path = data['database_path']
        export_path = data['export_path']
        
        # Here you would export the database tables to CSV files
        # For now, we'll just return success
        
        return success_response({
            "exportPath": export_path
        }, message=f"Data exported successfully to {export_path}")
        
    except Exception as e:
        return handle_exception(e, "exporting database to CSV", logger)

def _generate_mock_table_data(table_name):
    """Generate mock data for different table types."""
    mock_data = []
    
    if table_name == "Entity":
        for i in range(10):
            mock_data.append({
                "id": i + 1,
                "name": f"Entity{i+1}",
                "created_at": "2023-12-15T10:00:00Z"
            })
    elif table_name == "Event":
        for i in range(10):
            mock_data.append({
                "id": i + 1,
                "entity_id": (i % 5) + 1,
                "type": f"Event{(i % 3) + 1}",
                "start_time": "2023-12-15T10:00:00Z",
                "duration": i + 5
            })
    elif table_name == "Resource":
        for i in range(5):
            mock_data.append({
                "id": i + 1,
                "name": f"Resource{i+1}",
                "type": f"Type{(i % 2) + 1}",
                "capacity": 10
            })
    elif table_name == "ResourceAllocation":
        for i in range(15):
            mock_data.append({
                "id": i + 1,
                "resource_id": (i % 5) + 1,
                "entity_id": (i % 10) + 1,
                "allocated_at": "2023-12-15T10:00:00Z",
                "released_at": "2023-12-15T11:00:00Z"
            })
    elif table_name == "SimulationLog":
        for i in range(20):
            mock_data.append({
                "id": i + 1,
                "timestamp": "2023-12-15T10:00:00Z",
                "level": "INFO" if i % 3 == 0 else "DEBUG",
                "message": f"Log message {i+1}",
                "entity_id": (i % 10) + 1 if i % 2 == 0 else None
            })
    
    return mock_data