"""
Script to clear all configurations in the config database.
"""

import os
import sys
import logging
from config_storage.config_db import ConfigManager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def clear_all_configurations():
    """Clear all configurations from the database"""
    logger.info("Starting configuration cleanup...")
    
    # Initialize the configuration manager
    config_manager = ConfigManager()
    
    # Get initial counts
    all_configs = config_manager.get_all_configs()
    project_configs = sum(1 for c in all_configs if c['project_id'] is not None)
    standalone_configs = len(all_configs) - project_configs
    
    logger.info(f"Found {len(all_configs)} total configurations:")
    logger.info(f"  - {project_configs} associated with projects")
    logger.info(f"  - {standalone_configs} standalone configurations")
    
    # Clear all configurations
    deleted_count = config_manager.clear_all_configs(include_project_configs=True)
    
    logger.info(f"Successfully deleted {deleted_count} configurations")
    
    # Verify deletion
    remaining = len(config_manager.get_all_configs())
    if remaining > 0:
        logger.warning(f"There are still {remaining} configurations remaining")
    else:
        logger.info("All configurations have been removed")
    
    return deleted_count

if __name__ == "__main__":
    try:
        deleted = clear_all_configurations()
        print(f"\nSuccessfully cleared {deleted} configurations from the database.")
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1) 