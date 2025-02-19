import argparse
import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict

from src.generator.db_generator import DatabaseGenerator
from src.models.base import DatabaseManager
from src.models.entities import ModelRegistry

def setup_logging(log_file: Path):
    """Set up logging to both file and console"""
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Setup file handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    
    # Setup console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter('%(message)s'))
    
    # Setup root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

def create_output_dir(output_dir: Path):
    """Create output directory if it doesn't exist"""
    output_dir.mkdir(parents=True, exist_ok=True)

def analyze_fk_distribution(session, model_class, fk_column: str) -> Dict[int, int]:
    """Analyze the distribution of foreign keys"""
    distribution = {}
    for instance in session.query(model_class).all():
        fk_value = getattr(instance, fk_column)
        # Convert bytes to int if needed
        if isinstance(fk_value, bytes):
            fk_value = int.from_bytes(fk_value, byteorder='little')
        distribution[fk_value] = distribution.get(fk_value, 0) + 1
    return distribution

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Generate synthetic database from configuration')
    parser.add_argument(
        '--config',
        type=Path,
        default='config/db_config/demo_db.yaml',
        help='Path to database configuration YAML file'
    )
    parser.add_argument(
        '--output-dir',
        type=Path,
        default='output',
        help='Directory to store output files'
    )
    args = parser.parse_args()
    
    # Create output directory
    create_output_dir(args.output_dir)
    
    # Setup logging
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = args.output_dir / f'db_generator_{timestamp}.log'
    setup_logging(log_file)
    
    logger = logging.getLogger(__name__)
    logger.info("="*80)
    logger.info("Database Generator")
    logger.info("="*80)
    logger.info(f"Configuration file: {args.config}")
    logger.info(f"Output directory: {args.output_dir}")
    
    try:
        # Initialize and run generator
        db_path = args.output_dir / f'synthetic_db_{timestamp}.db'
        logger.info(f"\nGenerating database at: {db_path}")
        
        generator = DatabaseGenerator(args.config, str(db_path))
        generator.generate_all()
        
        # Print summary
        logger.info("\nGeneration Summary:")
        with generator.db as session:
            for model_name, model_class in generator.model_registry.models.items():
                count = session.query(model_class).count()
                logger.info(f"- {model_name}: {count} records")
                
                # Analyze FK distributions for child tables
                for attr_name in dir(model_class):
                    if not attr_name.startswith('_'):
                        attr = getattr(model_class, attr_name)
                        if hasattr(attr, 'property') and hasattr(attr.property, 'columns'):
                            column = attr.property.columns[0]
                            if hasattr(column, 'foreign_keys') and column.foreign_keys:
                                distribution = analyze_fk_distribution(session, model_class, attr_name)
                                logger.info(f"  FK Distribution ({attr_name}):")
                                total = sum(distribution.values())
                                for fk_value, count in sorted(distribution.items()):
                                    percentage = (count / total) * 100
                                    logger.info(f"    - ID {fk_value}: {count} ({percentage:.1f}%)")
        
        logger.info("\nDatabase generation completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during database generation: {e}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main() 