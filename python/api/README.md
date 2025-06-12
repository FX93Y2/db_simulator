# DB Simulator API Reference

This document provides comprehensive documentation for the DB Simulator REST API endpoints.

## Base URL

```
http://localhost:5000/api
```

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## Response Format

All API responses follow this standard format:

```json
{
  "success": true|false,
  "data": {...},           // Present on success
  "error": "error message", // Present on failure
  "message": "info message" // Optional additional info
}
```

## Project Management

### List Projects
```http
GET /projects
```

**Response:**
```json
{
  "success": true,
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Project
```http
POST /projects
```

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Project description"
}
```

**Response:**
```json
{
  "success": true,
  "project": {
    "id": "uuid",
    "name": "New Project",
    "description": "Project description",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "Project created successfully"
}
```

### Get Project
```http
GET /projects/{project_id}
```

**Response:**
```json
{
  "success": true,
  "project": {
    "id": "uuid",
    "name": "Project Name",
    "description": "Project description",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### Update Project
```http
PUT /projects/{project_id}
```

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

### Delete Project
```http
DELETE /projects/{project_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

## Configuration Management

### Get Database Configuration
```http
GET /projects/{project_id}/db-config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "id": "uuid",
    "name": "DB Config",
    "content": "YAML content string",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "projectName": "Project Name"
}
```

### Save Database Configuration
```http
POST /projects/{project_id}/db-config
```

**Request Body:**
```json
{
  "name": "Database Configuration",
  "content": "entities:\n  - name: Project\n    ...",
  "description": "Optional description"
}
```

### Get Simulation Configuration
```http
GET /projects/{project_id}/sim-config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "id": "uuid",
    "name": "Sim Config",
    "content": "YAML content string",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "projectName": "Project Name"
}
```

### Save Simulation Configuration
```http
POST /projects/{project_id}/sim-config
```

**Request Body:**
```json
{
  "name": "Simulation Configuration",
  "content": "simulation:\n  duration_days: 60\n  ...",
  "description": "Optional description"
}
```

## Database Generation

### Generate Database
```http
POST /generate-database
```

**Request Body:**
```json
{
  "config_id": "uuid",
  "output_dir": "output",
  "name": "my_database"
}
```

**Response:**
```json
{
  "success": true,
  "database_path": "/path/to/database.db",
  "message": "Database generated at: /path/to/database.db"
}
```

## Simulation Execution

### Run Simulation
```http
POST /run-simulation
```

**Request Body:**
```json
{
  "config_id": "simulation_config_uuid",
  "db_config_id": "database_config_uuid",
  "database_path": "/path/to/database.db"
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "duration_days": 60,
    "entity_count": 18,
    "processed_events": 97,
    "resource_utilization": {
      "total_resources": 30,
      "currently_allocated": 0,
      "total_allocations": 150,
      "by_resource": {
        "Consultant_1": {
          "allocation_count": 5,
          "total_busy_time": 120.5,
          "utilization_percentage": 15.2
        }
      },
      "by_type": {
        "Developer": {
          "count": 15,
          "total_allocations": 89,
          "average_utilization_percentage": 18.7
        }
      }
    }
  },
  "message": "Simulation completed successfully"
}
```

### Generate and Simulate
```http
POST /generate-and-simulate
```

**Request Body:**
```json
{
  "db_config_id": "database_config_uuid",
  "sim_config_id": "simulation_config_uuid",
  "output_dir": "output",
  "name": "my_simulation"
}
```

**Response:**
```json
{
  "success": true,
  "database_path": "/path/to/database.db",
  "results": {
    "duration_days": 60,
    "entity_count": 18,
    "processed_events": 97,
    "resource_utilization": {...}
  },
  "message": "Generate-simulate completed successfully"
}
```

## Results Analysis

### Get Simulation Summary
```http
GET /results/summary?database_path=/path/to/result.db
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_tables": 5,
    "total_records": 1250,
    "simulation_duration": "60 days",
    "entities_processed": 18,
    "events_completed": 97
  }
}
```

### Get Database Tables
```http
GET /results/tables?database_path=/path/to/result.db
```

**Response:**
```json
{
  "success": true,
  "tables": [
    {
      "name": "Project",
      "row_count": 18,
      "columns": ["id", "name", "budget", "status"]
    },
    {
      "name": "Consultant",
      "row_count": 30,
      "columns": ["id", "name", "role", "hourly_rate"]
    }
  ]
}
```

### Get Table Data
```http
GET /results/table-data?database_path=/path/to/result.db&table=Project&limit=100&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Project Alpha",
      "budget": 125000.0,
      "status": "In Progress"
    }
  ],
  "total_rows": 18,
  "limit": 100,
  "offset": 0
}
```

### Export to CSV
```http
POST /results/export-csv
```

**Request Body:**
```json
{
  "database_path": "/path/to/result.db",
  "tables": ["Project", "Consultant"],
  "output_dir": "exports"
}
```

**Response:**
```json
{
  "success": true,
  "exported_files": [
    "/path/to/exports/Project.csv",
    "/path/to/exports/Consultant.csv"
  ],
  "message": "Tables exported successfully"
}
```

## Configuration Validation

### Validate Configuration
```http
POST /validate
```

**Request Body:**
```json
{
  "content": "YAML configuration content",
  "config_type": "database" // or "simulation"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "message": "Configuration is valid"
}
```

**Error Response:**
```json
{
  "success": true,
  "valid": false,
  "error": "Invalid YAML: missing required field 'entities'"
}
```

## Error Codes

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request parameters or body |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server-side error during processing |

## Common Error Responses

### Missing Required Fields
```json
{
  "success": false,
  "error": "Missing required fields"
}
```

### Configuration Not Found
```json
{
  "success": false,
  "error": "Configuration not found"
}
```

### Database Generation Error
```json
{
  "success": false,
  "error": "Error generating database: Invalid entity configuration"
}
```

### Simulation Error
```json
{
  "success": false,
  "error": "Error running simulation: No resources available"
}
```

## Rate Limiting

Currently, no rate limiting is implemented. All endpoints can be called without restrictions.

## Examples

### Complete Workflow Example

1. **Create a project:**
```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "A test project"}'
```

2. **Save database configuration:**
```bash
curl -X POST http://localhost:5000/api/projects/{project_id}/db-config \
  -H "Content-Type: application/json" \
  -d '{"name": "DB Config", "content": "entities:\n  - name: Project\n    ..."}'
```

3. **Generate database:**
```bash
curl -X POST http://localhost:5000/api/generate-database \
  -H "Content-Type: application/json" \
  -d '{"config_id": "{config_id}", "name": "test_db"}'
```

4. **Run simulation:**
```bash
curl -X POST http://localhost:5000/api/run-simulation \
  -H "Content-Type: application/json" \
  -d '{"config_id": "{sim_config_id}", "database_path": "/path/to/test_db.db"}'
```

## SDK and Client Libraries

Currently, no official SDK is available. The API can be accessed using any HTTP client library in your preferred programming language.

### Python Example
```python
import requests

# Create project
response = requests.post('http://localhost:5000/api/projects', 
                        json={'name': 'My Project'})
project = response.json()['project']

# Generate database
response = requests.post('http://localhost:5000/api/generate-database',
                        json={'config_id': config_id, 'name': 'my_db'})
```

### JavaScript Example
```javascript
// Create project
const response = await fetch('http://localhost:5000/api/projects', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({name: 'My Project'})
});
const project = await response.json();
```

## Support

For API-related questions or issues:
- Check the main documentation in the project root
- Review example configurations in `tests/test_config/`
- Create an issue on the project repository