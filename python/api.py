@app.route('/api/generate-database', methods=['POST'])
def api_generate_database():
    """
    Generate a SQLite database from configuration.
    
    Expected JSON payload:
    {
        "config": "YAML configuration content or file path",
        "project_id": "Optional project ID to organize files"
    }
    
    Returns:
        JSON: Path to the generated database and status
    """
    try:
        data = request.json
        config = data.get('config')
        project_id = data.get('project_id')  # Get project_id from request
        
        if not config:
            return jsonify({'success': False, 'error': 'No configuration provided'})
        
        logger.info(f"Generating database from config. Project ID: {project_id}")
        
        # Pass project_id to generate_database to organize output files
        db_path = generate_database(config, project_id=project_id)
        
        # Return path relative to root for frontend display
        output_path = os.path.relpath(db_path, os.path.abspath(os.path.dirname(__file__)))
        output_path = output_path.replace('\\', '/')  # Normalize path for all platforms
        
        return jsonify({
            'success': True, 
            'db_path': output_path
        })
    
    except Exception as e:
        logger.exception(f"Error generating database: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}) 