"""
Base configuration parser classes and utilities.
"""

import yaml
import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Union, Optional, Type, TypeVar, Generic
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, is_dataclass, fields, MISSING

logger = logging.getLogger(__name__)

class ConfigValidationError(Exception):
    """Error raised when configuration validation fails"""
    pass

class BaseConfigParser(ABC):
    """Base class for configuration parsers"""
    
    @staticmethod
    def load_yaml(config_path: Union[str, Path]) -> Dict[str, Any]:
        """
        Load a YAML configuration file.
        
        Args:
            config_path: Path to the YAML configuration file
            
        Returns:
            Parsed YAML data as a dictionary
            
        Raises:
            FileNotFoundError: If the configuration file doesn't exist
            yaml.YAMLError: If the YAML file is invalid
        """
        config_path = Path(config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
            
        with open(config_path, 'r') as f:
            try:
                return yaml.safe_load(f)
            except yaml.YAMLError as e:
                logger.error(f"Error parsing YAML file: {e}")
                raise
    
    @classmethod
    @abstractmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> Any:
        """
        Create a configuration object from a dictionary.
        
        Args:
            config_dict: Dictionary containing configuration data
            
        Returns:
            Configuration object
        """
        pass
    
    @classmethod
    def from_yaml(cls, config_path: Union[str, Path]) -> Any:
        """
        Create a configuration object from a YAML file.
        
        Args:
            config_path: Path to the YAML configuration file
            
        Returns:
            Configuration object
        """
        config_dict = cls.load_yaml(config_path)
        return cls.from_dict(config_dict)
        
    @abstractmethod
    def validate(self) -> None:
        """
        Validate the configuration.
        
        Raises:
            ConfigValidationError: If validation fails
        """
        pass

T = TypeVar('T')

class BaseConfigParserGeneric(Generic[T]):
    """
    Base class for configuration parsers
    
    This class provides common functionality for parsing configuration files
    and validating their contents against expected schemas.
    """
    
    @classmethod
    def parse(cls, config_path: Union[str, Path]) -> T:
        """
        Parse a configuration file and return a structured configuration object
        
        Args:
            config_path: Path to the configuration file
            
        Returns:
            Structured configuration object
            
        Raises:
            ConfigValidationError: If the configuration fails validation
            FileNotFoundError: If the configuration file does not exist
            yaml.YAMLError: If there's an error parsing the YAML file
        """
        try:
            # Handle both string and Path objects
            if isinstance(config_path, str):
                config_path = Path(config_path)
                
            # Check if file exists
            if not config_path.exists():
                raise FileNotFoundError(f"Configuration file not found: {config_path}")
                
            # Load YAML file
            with open(config_path, 'r') as f:
                config_dict = yaml.safe_load(f)
                
            # Validate the configuration
            return cls._validate_and_parse(config_dict)
            
        except FileNotFoundError as e:
            logger.error(f"Configuration file not found: {config_path}")
            raise
        except yaml.YAMLError as e:
            logger.error(f"Error parsing YAML file {config_path}: {e}")
            raise
        except ConfigValidationError as e:
            logger.error(f"Configuration validation error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error parsing configuration: {e}")
            raise
    
    @classmethod
    def _validate_and_parse(cls, config_dict: Dict) -> T:
        """
        Validate the configuration dictionary and convert it to a structured object
        
        Args:
            config_dict: Configuration dictionary loaded from YAML
            
        Returns:
            Structured configuration object
            
        Raises:
            ConfigValidationError: If the configuration fails validation
        """
        # This method should be implemented by subclasses
        raise NotImplementedError("Subclasses must implement _validate_and_parse method")
        
    @staticmethod
    def _validate_required_fields(config_dict: Dict, required_fields: List[str], context: str = ""):
        """
        Validate that all required fields are present in the configuration
        
        Args:
            config_dict: Configuration dictionary
            required_fields: List of required field names
            context: Context string for error messages
            
        Raises:
            ConfigValidationError: If any required fields are missing
        """
        missing_fields = [field for field in required_fields if field not in config_dict]
        if missing_fields:
            fields_str = ", ".join(missing_fields)
            context_str = f" in {context}" if context else ""
            raise ConfigValidationError(f"Missing required fields{context_str}: {fields_str}")
            
    @staticmethod
    def create_dataclass_instance(dataclass_type: Type, data_dict: Dict, context: str = "") -> Any:
        """
        Create an instance of a dataclass from a dictionary
        
        Args:
            dataclass_type: The dataclass type to create
            data_dict: Dictionary containing the data
            context: Context string for error messages
            
        Returns:
            Instance of the dataclass
            
        Raises:
            ConfigValidationError: If there's an error creating the dataclass instance
        """
        if not is_dataclass(dataclass_type):
            raise ConfigValidationError(f"{dataclass_type.__name__} is not a dataclass")
            
        try:
            # Get field definitions from the dataclass
            dc_fields = {f.name: f for f in fields(dataclass_type)}
            
            # Prepare arguments for the dataclass constructor
            kwargs = {}
            
            for name, field_def in dc_fields.items():
                # Skip if field has default value and not in data_dict
                if (field_def.default is not MISSING or field_def.default_factory is not MISSING) and name not in data_dict:
                    continue
                    
                # If field is in data_dict, use that value
                if name in data_dict:
                    value = data_dict[name]
                    # If field type is another dataclass and value is a dict,
                    # recursively create an instance of the field type
                    if is_dataclass(field_def.type) and isinstance(value, dict):
                        kwargs[name] = BaseConfigParserGeneric.create_dataclass_instance(
                            field_def.type, value, f"{context}.{name}" if context else name
                        )
                    else:
                        kwargs[name] = value
                else:
                    # Field is required but not in data_dict
                    field_context = f"{context}.{name}" if context else name
                    raise ConfigValidationError(f"Missing required field: {field_context}")
                    
            # Create and return the dataclass instance
            return dataclass_type(**kwargs)
            
        except ConfigValidationError:
            # Re-raise validation errors
            raise
        except Exception as e:
            field_context = f" in {context}" if context else ""
            raise ConfigValidationError(f"Error creating {dataclass_type.__name__}{field_context}: {e}") 