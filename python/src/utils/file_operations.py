"""
Safe file operations utilities for handling database files.
Specifically designed to handle Windows EBUSY errors and SQLite file locking.
"""
import os
import time
import sqlite3
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def safe_delete_sqlite_file(db_path: str, max_retries: int = 5, base_delay: float = 0.1) -> bool:
    """
    Safely delete a SQLite database file with proper cleanup and retry logic.
    
    Args:
        db_path: Path to the SQLite database file
        max_retries: Maximum number of retry attempts  
        base_delay: Base delay between retries (exponential backoff)
        
    Returns:
        bool: True if deletion successful, False otherwise
    """
    if not os.path.exists(db_path):
        logger.debug(f"Database file does not exist: {db_path}")
        return True
    
    # First, try to cleanup SQLite WAL and SHM files
    _cleanup_sqlite_auxiliary_files(db_path)
    
    for attempt in range(max_retries):
        try:
            # Attempt to delete the main database file
            os.remove(db_path)
            logger.info(f"Successfully deleted database file: {db_path}")
            return True
            
        except OSError as e:
            if "busy" in str(e).lower() or "locked" in str(e).lower():
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"File busy/locked, retrying in {delay:.2f}s (attempt {attempt + 1}/{max_retries}): {e}")
                    time.sleep(delay)
                    
                    # Try additional cleanup before retry
                    _force_sqlite_cleanup(db_path)
                else:
                    logger.error(f"Failed to delete database file after {max_retries} attempts: {e}")
                    return False
            else:
                logger.error(f"Error deleting database file: {e}")
                return False
        except Exception as e:
            logger.error(f"Unexpected error deleting database file: {e}")
            return False
    
    return False

def _cleanup_sqlite_auxiliary_files(db_path: str) -> None:
    """Clean up SQLite WAL and SHM auxiliary files."""
    try:
        # WAL file (Write-Ahead Log)
        wal_path = db_path + "-wal"
        if os.path.exists(wal_path):
            try:
                os.remove(wal_path)
                logger.debug(f"Removed WAL file: {wal_path}")
            except OSError as e:
                logger.debug(f"Could not remove WAL file: {e}")
        
        # SHM file (Shared Memory)
        shm_path = db_path + "-shm"
        if os.path.exists(shm_path):
            try:
                os.remove(shm_path)
                logger.debug(f"Removed SHM file: {shm_path}")
            except OSError as e:
                logger.debug(f"Could not remove SHM file: {e}")
                
    except Exception as e:
        logger.debug(f"Error cleaning auxiliary files: {e}")

def _force_sqlite_cleanup(db_path: str) -> None:
    """Force SQLite cleanup by performing a checkpoint operation."""
    try:
        if os.path.exists(db_path):
            # Connect briefly to force WAL checkpoint
            conn = sqlite3.connect(db_path, timeout=1.0)
            try:
                # Execute checkpoint to merge WAL back to main database
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
                conn.commit()
                logger.debug(f"Performed WAL checkpoint for: {db_path}")
            except sqlite3.Error as e:
                logger.debug(f"Could not perform checkpoint: {e}")
            finally:
                conn.close()
                
    except Exception as e:
        logger.debug(f"Error during force cleanup: {e}")

def ensure_database_closed(engine) -> None:
    """
    Ensure SQLAlchemy engine is properly disposed and connections closed.
    
    Args:
        engine: SQLAlchemy engine instance
    """
    if engine is None:
        return
        
    try:
        # Dispose of the engine and close all connections
        engine.dispose()
        logger.debug("Engine disposed successfully")
        
        # Add small delay to allow OS to release file handles
        time.sleep(0.05)
        
    except Exception as e:
        logger.debug(f"Error disposing engine: {e}")