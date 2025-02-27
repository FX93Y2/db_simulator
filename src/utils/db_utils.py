"""
Database utility functions
"""

import logging
import sqlite3
import pandas as pd
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

def count_records(connection: sqlite3.Connection, table_name: str) -> int:
    """
    Count the number of records in a table
    
    Args:
        connection: SQLite connection
        table_name: Name of the table
        
    Returns:
        Number of records in the table
    """
    try:
        cursor = connection.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        cursor.close()
        return count
    except Exception as e:
        logger.error(f"Error counting records in {table_name}: {e}")
        return 0
        
def analyze_database(connection: sqlite3.Connection) -> Dict[str, Any]:
    """
    Analyze the database structure and content
    
    Args:
        connection: SQLite connection
        
    Returns:
        Dictionary with analysis results
    """
    result = {
        'tables': {},
        'relationships': []
    }
    
    # Get all tables
    cursor = connection.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    # For each table, get column info and record count
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [
            {
                'name': row[1],
                'type': row[2],
                'is_pk': row[5] == 1
            }
            for row in cursor.fetchall()
        ]
        
        count = count_records(connection, table)
        
        result['tables'][table] = {
            'columns': columns,
            'record_count': count
        }
        
    # Get foreign key relationships
    for table in tables:
        cursor.execute(f"PRAGMA foreign_key_list({table})")
        for row in cursor.fetchall():
            result['relationships'].append({
                'from_table': table,
                'from_column': row[3],
                'to_table': row[2],
                'to_column': row[4]
            })
    
    cursor.close()
    return result
    
def get_table_schema(connection: sqlite3.Connection, table_name: str) -> List[Dict[str, Any]]:
    """
    Get the schema for a table
    
    Args:
        connection: SQLite connection
        table_name: Name of the table
        
    Returns:
        List of column definitions
    """
    cursor = connection.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [
        {
            'name': row[1],
            'type': row[2],
            'not_null': row[3] == 1,
            'default': row[4],
            'is_pk': row[5] == 1
        }
        for row in cursor.fetchall()
    ]
    cursor.close()
    return columns 