"""
Database cleanup and resource management for the simulation engine.

This module handles the cleanup of database connections, resource allocations,
and other system resources to prevent EBUSY errors and resource leaks.
"""

import logging
import time
import sqlite3
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class DatabaseCleanup:
    """
    Handles cleanup of database connections and system resources.
    
    This class manages the proper cleanup of SQLAlchemy engines,
    SQLite connections, and other system resources to prevent
    EBUSY errors on Windows and resource leaks.
    """
    
    def __init__(self, db_path: str):
        """
        Initialize the cleanup handler.
        
        Args:
            db_path: Path to the SQLite database
        """
        self.db_path = db_path
    
    def cleanup_database_connections(self, engine, event_tracker, entity_attribute_manager, resource_manager, queue_manager=None):
        """
        Clean up all database connections to prevent EBUSY errors on Windows.
        This method is called in a finally block to ensure cleanup happens even if simulation fails.

        Args:
            engine: Main SQLAlchemy engine
            event_tracker: Event tracker instance
            entity_attribute_manager: Entity attribute manager instance
            resource_manager: Resource manager instance
            queue_manager: Queue manager instance (optional)
        """
        try:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            logger.info(f"[{timestamp}] [PYTHON] Starting simulator cleanup to prevent EBUSY errors for: {self.db_path}")

            # Dispose QueueManager engine first (if exists)
            if queue_manager and hasattr(queue_manager, 'engine') and queue_manager.engine:
                logger.info(f"[{timestamp}] [PYTHON] Disposing QueueManager engine for: {self.db_path}")
                queue_manager.engine.dispose()
                logger.info(f"[{timestamp}] [PYTHON] QueueManager engine disposed for: {self.db_path}")

            # Dispose EventTracker engine
            if hasattr(event_tracker, 'dispose') and event_tracker:
                logger.info(f"[{timestamp}] [PYTHON] Disposing EventTracker engine for: {self.db_path}")
                event_tracker.dispose()
                logger.info(f"[{timestamp}] [PYTHON] EventTracker engine disposed for: {self.db_path}")

            # Dispose main simulator engine
            if hasattr(engine, 'dispose') and engine:
                logger.info(f"[{timestamp}] [PYTHON] Disposing main simulator engine for: {self.db_path}")
                engine.dispose()
                logger.info(f"[{timestamp}] [PYTHON] Main simulator engine disposed successfully for: {self.db_path}")
            
            # Force SQLite to close all connections and cleanup WAL files
            self._force_sqlite_cleanup(timestamp)
            
            # Clean up entity attributes
            if hasattr(entity_attribute_manager, 'clear_all') and entity_attribute_manager:
                logger.info(f"[{timestamp}] [PYTHON] Clearing entity attribute manager for: {self.db_path}")
                entity_attribute_manager.clear_all()
            
            # Clean up any remaining allocated resources
            self._cleanup_resource_allocations(resource_manager, timestamp)
            
            logger.info(f"[{timestamp}] [PYTHON] Simulator cleanup completed for: {self.db_path}")
            
        except Exception as e:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            logger.warning(f"[{timestamp}] [PYTHON] Error during simulator cleanup for {self.db_path}: {e}")
    
    def _force_sqlite_cleanup(self, timestamp: str):
        """
        Force SQLite to close all connections and cleanup WAL files.
        
        Args:
            timestamp: Current timestamp for logging
        """
        try:
            logger.info(f"[{timestamp}] [PYTHON] Opening connection for WAL checkpoint: {self.db_path}")
            # Connect briefly to force WAL checkpoint and close
            conn = sqlite3.connect(self.db_path, timeout=1.0)
            logger.info(f"[{timestamp}] [PYTHON] Connection opened for WAL checkpoint: {self.db_path}")
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            conn.commit()
            logger.info(f"[{timestamp}] [PYTHON] WAL checkpoint executed for: {self.db_path}")
            conn.close()
            logger.info(f"[{timestamp}] [PYTHON] WAL checkpoint connection closed for: {self.db_path}")
            
            # Small delay to ensure OS releases file handles
            time.sleep(0.2)
            logger.info(f"[{timestamp}] [PYTHON] File handle release delay completed for: {self.db_path}")
            
        except Exception as sqlite_err:
            logger.warning(f"[{timestamp}] [PYTHON] Could not force SQLite cleanup for {self.db_path}: {sqlite_err}")
    
    def _cleanup_resource_allocations(self, resource_manager, timestamp: str):
        """
        Clean up any remaining allocated resources.
        
        Args:
            resource_manager: Resource manager instance
            timestamp: Current timestamp for logging
        """
        if hasattr(resource_manager, 'event_allocations') and resource_manager.event_allocations:
            remaining_allocations = list(resource_manager.event_allocations.keys())
            if remaining_allocations:
                logger.info(f"[{timestamp}] [PYTHON] Cleaning up {len(remaining_allocations)} remaining resource allocations")
                for event_id in remaining_allocations:
                    try:
                        resource_manager.release_resources(event_id)
                    except Exception as e:
                        logger.debug(f"[{timestamp}] [PYTHON] Error releasing resources for event {event_id}: {e}")