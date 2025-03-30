"""
Configuration storage manager using SQLite database.
"""

import sqlite3
import os
import json
import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class ConfigManager:
    """SQLite-based configuration storage manager"""
    
    def __init__(self, db_path=None):
        """
        Initialize the configuration database.
        
        Args:
            db_path (str, optional): Path to the SQLite database file.
                If None, defaults to 'configs.db' in the config_storage directory.
        """
        if db_path is None:
            # Use default location in the config_storage directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            self.db_path = os.path.join(current_dir, 'configs.db')
        else:
            self.db_path = db_path
            
        # Create the database directory if it doesn't exist
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Initialize the database
        self._init_db()
    
    def _init_db(self):
        """Initialize the database schema if it doesn't exist"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create configurations table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS configurations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config_type TEXT NOT NULL,
                content TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # Create trigger to update the updated_at timestamp
            cursor.execute('''
            CREATE TRIGGER IF NOT EXISTS update_timestamp 
            AFTER UPDATE ON configurations
            FOR EACH ROW
            BEGIN
                UPDATE configurations SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = OLD.id;
            END
            ''')
            
            conn.commit()
            conn.close()
            logger.info(f"Initialized configuration database at {self.db_path}")
        except Exception as e:
            logger.error(f"Error initializing configuration database: {e}")
            raise
    
    def save_config(self, name, config_type, content, description=""):
        """
        Save a new configuration.
        
        Args:
            name (str): Name of the configuration
            config_type (str): Type of configuration (e.g., 'database', 'simulation')
            content (str): Configuration content (YAML or JSON string)
            description (str, optional): Description of the configuration
            
        Returns:
            str: The ID of the saved configuration
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Generate a unique ID
            config_id = str(uuid.uuid4())
            
            # Convert content to string if it's not already
            if not isinstance(content, str):
                content = json.dumps(content)
                
            cursor.execute(
                '''
                INSERT INTO configurations (id, name, config_type, content, description)
                VALUES (?, ?, ?, ?, ?)
                ''',
                (config_id, name, config_type, content, description)
            )
            
            conn.commit()
            conn.close()
            logger.info(f"Saved configuration '{name}' with ID {config_id}")
            return config_id
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
            raise
    
    def get_config(self, config_id):
        """
        Get a configuration by ID.
        
        Args:
            config_id (str): The ID of the configuration to retrieve
            
        Returns:
            dict: The configuration as a dictionary, or None if not found
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # This enables column access by name
            cursor = conn.cursor()
            
            cursor.execute(
                '''
                SELECT id, name, config_type, content, description, 
                       created_at, updated_at
                FROM configurations
                WHERE id = ?
                ''',
                (config_id,)
            )
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Error retrieving configuration: {e}")
            raise
    
    def get_all_configs(self, config_type=None):
        """
        Get all configurations, optionally filtered by type.
        
        Args:
            config_type (str, optional): Filter by configuration type
            
        Returns:
            list: List of configuration dictionaries
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if config_type:
                cursor.execute(
                    '''
                    SELECT id, name, config_type, description, created_at, updated_at
                    FROM configurations
                    WHERE config_type = ?
                    ORDER BY updated_at DESC
                    ''',
                    (config_type,)
                )
            else:
                cursor.execute(
                    '''
                    SELECT id, name, config_type, description, created_at, updated_at
                    FROM configurations
                    ORDER BY updated_at DESC
                    '''
                )
            
            rows = cursor.fetchall()
            conn.close()
            
            # Convert rows to dictionaries (exclude content to reduce payload size)
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error retrieving configurations: {e}")
            raise
    
    def update_config(self, config_id, name=None, config_type=None, content=None, description=None):
        """
        Update an existing configuration.
        
        Args:
            config_id (str): The ID of the configuration to update
            name (str, optional): New name
            config_type (str, optional): New type
            content (str, optional): New content
            description (str, optional): New description
            
        Returns:
            bool: True if updated successfully, False if not found
        """
        try:
            # First check if the configuration exists
            existing = self.get_config(config_id)
            if not existing:
                return False
                
            # Build the update query
            update_fields = []
            params = []
            
            if name is not None:
                update_fields.append("name = ?")
                params.append(name)
                
            if config_type is not None:
                update_fields.append("config_type = ?")
                params.append(config_type)
                
            if content is not None:
                # Convert content to string if it's not already
                if not isinstance(content, str):
                    content = json.dumps(content)
                update_fields.append("content = ?")
                params.append(content)
                
            if description is not None:
                update_fields.append("description = ?")
                params.append(description)
                
            if not update_fields:
                # No fields to update
                return True
                
            # Add the config_id to params
            params.append(config_id)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                f'''
                UPDATE configurations
                SET {", ".join(update_fields)}
                WHERE id = ?
                ''',
                params
            )
            
            conn.commit()
            conn.close()
            
            logger.info(f"Updated configuration with ID {config_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating configuration: {e}")
            raise
    
    def delete_config(self, config_id):
        """
        Delete a configuration.
        
        Args:
            config_id (str): The ID of the configuration to delete
            
        Returns:
            bool: True if deleted successfully, False if not found
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                '''
                DELETE FROM configurations
                WHERE id = ?
                ''',
                (config_id,)
            )
            
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            
            if deleted:
                logger.info(f"Deleted configuration with ID {config_id}")
            else:
                logger.warning(f"Attempted to delete non-existent configuration with ID {config_id}")
                
            return deleted
        except Exception as e:
            logger.error(f"Error deleting configuration: {e}")
            raise
            
    def import_from_file(self, file_path, config_type):
        """
        Import a configuration from a file.
        
        Args:
            file_path (str): Path to the configuration file
            config_type (str): Type of configuration (e.g., 'database', 'simulation')
            
        Returns:
            str: The ID of the imported configuration
        """
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"Configuration file not found: {file_path}")
                
            # Read the file content
            with open(file_path, 'r') as f:
                content = f.read()
                
            # Use the filename (without extension) as the configuration name
            name = file_path.stem
            
            # Save the configuration
            return self.save_config(name, config_type, content)
        except Exception as e:
            logger.error(f"Error importing configuration from file: {e}")
            raise
            
    def export_to_file(self, config_id, output_dir):
        """
        Export a configuration to a file.
        
        Args:
            config_id (str): The ID of the configuration to export
            output_dir (str): Directory to save the file
            
        Returns:
            str: Path to the exported file
        """
        try:
            config = self.get_config(config_id)
            if not config:
                raise ValueError(f"Configuration not found with ID: {config_id}")
                
            # Create the output directory if it doesn't exist
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Determine the file extension based on content
            extension = '.yaml'
            
            # Generate the output filename
            filename = f"{config['name']}{extension}"
            file_path = output_path / filename
            
            # Write the configuration to file
            with open(file_path, 'w') as f:
                f.write(config['content'])
                
            logger.info(f"Exported configuration to {file_path}")
            return str(file_path)
        except Exception as e:
            logger.error(f"Error exporting configuration to file: {e}")
            raise 