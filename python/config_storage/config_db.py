"""
Configuration Storage Manager using SQLite.
This module provides an interface for saving and retrieving configurations.
"""

import os
import sqlite3
import json
import logging
import uuid
from datetime import datetime
import yaml

# Set up logging
logger = logging.getLogger(__name__)

class ConfigManager:
    """
    Configuration storage manager using SQLite.
    Handles database configurations, simulation configurations, and projects.
    """
    
    def __init__(self, db_path=None):
        """
        Initialize the configuration manager with the specified database path.
        
        Args:
            db_path (str, optional): Path to the SQLite database file.
                                    If None, uses the default path.
        """
        if db_path is None:
            # Get the directory of this file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(current_dir, 'configs.db')
        
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize the database schema if it doesn't exist."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check if the old configurations table exists and drop it
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='configurations'")
        if cursor.fetchone():
            logger.info("Dropping legacy 'configurations' table")
            cursor.execute("DROP TABLE configurations")
        
        # Create tables if they don't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS configs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            description TEXT,
            project_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        ''')
        
        conn.commit()
        conn.close()
    
    # Project management methods
    def create_project(self, name, description=""):
        """
        Create a new project.
        
        Args:
            name (str): Project name
            description (str, optional): Project description
            
        Returns:
            str: The ID of the created project
        """
        project_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            INSERT INTO projects (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (project_id, name, description, now, now)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Created project: {name} (ID: {project_id})")
        return project_id
    
    def get_project(self, project_id):
        """
        Get a project by ID.
        
        Args:
            project_id (str): Project ID
            
        Returns:
            dict: Project data or None if not found
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT id, name, description, created_at, updated_at
            FROM projects
            WHERE id = ?
            ''',
            (project_id,)
        )
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'created_at': row[3],
                'updated_at': row[4]
            }
        return None
    
    def get_all_projects(self):
        """
        Get all projects.
        
        Returns:
            list: List of project dictionaries
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT id, name, description, created_at, updated_at
            FROM projects
            ORDER BY updated_at DESC
            '''
        )
        
        rows = cursor.fetchall()
        conn.close()
        
        projects = []
        for row in rows:
            projects.append({
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'created_at': row[3],
                'updated_at': row[4]
            })
        
        return projects
    
    def update_project(self, project_id, name=None, description=None):
        """
        Update a project.
        
        Args:
            project_id (str): Project ID
            name (str, optional): New project name
            description (str, optional): New project description
            
        Returns:
            bool: True if successful, False if project not found
        """
        project = self.get_project(project_id)
        if not project:
            return False
        
        now = datetime.now().isoformat()
        
        # Only update provided fields
        updated_name = name if name is not None else project['name']
        updated_description = description if description is not None else project['description']
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            UPDATE projects
            SET name = ?, description = ?, updated_at = ?
            WHERE id = ?
            ''',
            (updated_name, updated_description, now, project_id)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Updated project: {updated_name} (ID: {project_id})")
        return True
    
    def delete_project(self, project_id):
        """
        Delete a project and all its associated configurations.
        
        Args:
            project_id (str): Project ID
            
        Returns:
            bool: True if successful, False if project not found
        """
        project = self.get_project(project_id)
        if not project:
            return False
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Delete associated configurations first
        cursor.execute(
            '''
            DELETE FROM configs
            WHERE project_id = ?
            ''',
            (project_id,)
        )
        
        # Delete project
        cursor.execute(
            '''
            DELETE FROM projects
            WHERE id = ?
            ''',
            (project_id,)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Deleted project: {project['name']} (ID: {project_id})")
        return True
    
    # Project configuration methods
    def save_project_config(self, project_id, config_type, name, content, description=""):
        """
        Save a configuration for a project. If a config of the same type already exists for the project,
        it will be updated instead of creating a new one.
        
        Args:
            project_id (str): Project ID
            config_type (str): Configuration type (database, simulation)
            name (str): Configuration name
            content (str): Configuration content
            description (str, optional): Configuration description
            
        Returns:
            str: The ID of the created or updated configuration
        """
        # Check if project exists
        project = self.get_project(project_id)
        if not project:
            logger.error(f"Project not found: {project_id}")
            raise ValueError(f"Project not found: {project_id}")
        
        # Find all configs of this type for the project
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT id FROM configs
            WHERE project_id = ? AND type = ?
            ''',
            (project_id, config_type)
        )
        
        existing_configs = cursor.fetchall()
        
        if existing_configs:
            # If there are multiple configs, keep only the most recently updated one
            if len(existing_configs) > 1:
                logger.warning(f"Found {len(existing_configs)} {config_type} configs for project {project_id}. Cleaning up duplicates.")
                
                # Get the most recently updated config
                cursor.execute(
                    '''
                    SELECT id FROM configs
                    WHERE project_id = ? AND type = ?
                    ORDER BY updated_at DESC
                    LIMIT 1
                    ''',
                    (project_id, config_type)
                )
                
                latest_config_id = cursor.fetchone()[0]
                
                # Delete all but the most recent config
                cursor.execute(
                    '''
                    DELETE FROM configs
                    WHERE project_id = ? AND type = ? AND id != ?
                    ''',
                    (project_id, config_type, latest_config_id)
                )
                
                conn.commit()
                
                # Use the remaining config as our existing config
                config_id = latest_config_id
            else:
                # Just one config exists, use it
                config_id = existing_configs[0][0]
                
            # Update the existing config
            self.update_config(
                config_id,
                name,
                config_type,
                content,
                description
            )
            
            conn.close()
            return config_id
        else:
            # No config exists, create a new one
            conn.close()
            return self.save_config(name, config_type, content, description, project_id)
    
    def get_project_config(self, project_id, config_type):
        """
        Get a configuration for a project by type.
        
        Args:
            project_id (str): Project ID
            config_type (str): Configuration type (database, simulation)
            
        Returns:
            dict: Configuration data or None if not found
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT id, name, type, content, description, project_id, created_at, updated_at
            FROM configs
            WHERE project_id = ? AND type = ?
            ''',
            (project_id, config_type)
        )
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'name': row[1],
                'type': row[2],
                'content': row[3],
                'description': row[4],
                'project_id': row[5],
                'created_at': row[6],
                'updated_at': row[7]
            }
        return None
    
    def get_project_configs(self, project_id):
        """
        Get all configurations for a project.
        
        Args:
            project_id (str): Project ID
            
        Returns:
            list: List of configuration dictionaries
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT id, name, type, content, description, project_id, created_at, updated_at
            FROM configs
            WHERE project_id = ?
            ORDER BY updated_at DESC
            ''',
            (project_id,)
        )
        
        rows = cursor.fetchall()
        conn.close()
        
        configs = []
        for row in rows:
            configs.append({
                'id': row[0],
                'name': row[1],
                'type': row[2],
                'content': row[3],
                'description': row[4],
                'project_id': row[5],
                'created_at': row[6],
                'updated_at': row[7]
            })
        
        return configs
    
    # Standard configuration methods
    def save_config(self, name, config_type, content, description="", project_id=None):
        """
        Save a new configuration.
        
        Args:
            name (str): Configuration name
            config_type (str): Configuration type (database, simulation)
            content (str): Configuration content
            description (str, optional): Configuration description
            project_id (str, optional): Associated project ID
            
        Returns:
            str: The ID of the created configuration
        """
        config_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            INSERT INTO configs (id, name, type, content, description, project_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (config_id, name, config_type, content, description, project_id, now, now)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Saved config: {name} (ID: {config_id}, Type: {config_type})")
        return config_id
    
    def get_config(self, config_id):
        """
        Get a configuration by ID.
        
        Args:
            config_id (str): Configuration ID
            
        Returns:
            dict: Configuration data or None if not found
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT id, name, type, content, description, project_id, created_at, updated_at
            FROM configs
            WHERE id = ?
            ''',
            (config_id,)
        )
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'name': row[1],
                'type': row[2],
                'content': row[3],
                'description': row[4],
                'project_id': row[5],
                'created_at': row[6],
                'updated_at': row[7]
            }
        return None
    
    def get_all_configs(self, config_type=None):
        """
        Get all configurations, optionally filtered by type.
        
        Args:
            config_type (str, optional): Configuration type (database, simulation)
            
        Returns:
            list: List of configuration dictionaries
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if config_type:
            cursor.execute(
                '''
                SELECT id, name, type, content, description, project_id, created_at, updated_at
                FROM configs
                WHERE type = ?
                ORDER BY updated_at DESC
                ''',
                (config_type,)
            )
        else:
            cursor.execute(
                '''
                SELECT id, name, type, content, description, project_id, created_at, updated_at
                FROM configs
                ORDER BY updated_at DESC
                '''
            )
        
        rows = cursor.fetchall()
        conn.close()
        
        configs = []
        for row in rows:
            configs.append({
                'id': row[0],
                'name': row[1],
                'type': row[2],
                'content': row[3],
                'description': row[4],
                'project_id': row[5],
                'created_at': row[6],
                'updated_at': row[7]
            })
        
        return configs
    
    def update_config(self, config_id, name=None, config_type=None, content=None, description=None):
        """
        Update an existing configuration.
        
        Args:
            config_id (str): Configuration ID
            name (str, optional): New configuration name
            config_type (str, optional): New configuration type
            content (str, optional): New configuration content
            description (str, optional): New configuration description
            
        Returns:
            bool: True if successful, False if configuration not found
        """
        config = self.get_config(config_id)
        if not config:
            return False
        
        now = datetime.now().isoformat()
        
        # Only update provided fields
        updated_name = name if name is not None else config['name']
        updated_type = config_type if config_type is not None else config['type']
        updated_content = content if content is not None else config['content']
        updated_description = description if description is not None else config['description']
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            UPDATE configs
            SET name = ?, type = ?, content = ?, description = ?, updated_at = ?
            WHERE id = ?
            ''',
            (updated_name, updated_type, updated_content, updated_description, now, config_id)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Updated config: {updated_name} (ID: {config_id}, Type: {updated_type})")
        return True
    
    def delete_config(self, config_id):
        """
        Delete a configuration.
        
        Args:
            config_id (str): Configuration ID
            
        Returns:
            bool: True if successful, False if configuration not found
        """
        config = self.get_config(config_id)
        if not config:
            return False
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            DELETE FROM configs
            WHERE id = ?
            ''',
            (config_id,)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Deleted config: {config['name']} (ID: {config_id}, Type: {config['type']})")
        return True
    
    def get_configs_by_type(self, config_type):
        """
        Get all configurations of a specific type.
        
        Args:
            config_type (str): Configuration type
            
        Returns:
            list: List of configuration dictionaries
        """
        return self.get_all_configs(config_type)
    
    def import_from_file(self, file_path, config_type):
        """
        Import a configuration from a file.
        
        Args:
            file_path (str): Path to the configuration file
            config_type (str): Configuration type
            
        Returns:
            str: The ID of the imported configuration
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Extract file name without extension for config name
        file_name = os.path.basename(file_path)
        name, extension = os.path.splitext(file_name)
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Try to validate the YAML content
        try:
            yaml.safe_load(content)
        except Exception as e:
            raise ValueError(f"Invalid YAML in file {file_path}: {e}")
        
        return self.save_config(name, config_type, content)
    
    def export_to_file(self, config_id, output_dir):
        """
        Export a configuration to a file.
        
        Args:
            config_id (str): Configuration ID
            output_dir (str): Directory to save the file
            
        Returns:
            str: Path to the exported file
        """
        config = self.get_config(config_id)
        if not config:
            raise ValueError(f"Configuration not found: {config_id}")
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Create a safe filename from the config name
        safe_name = ''.join(c if c.isalnum() else '_' for c in config['name'])
        file_path = os.path.join(output_dir, f"{safe_name}.yaml")
        
        with open(file_path, 'w') as f:
            f.write(config['content'])
        
        logger.info(f"Exported config: {config['name']} to {file_path}")
        return file_path 