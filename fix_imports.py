#!/usr/bin/env python3
"""
Script to fix imports in the codebase.
Replaces 'from python.src...' with relative imports.
"""

import os
import re
import sys
from pathlib import Path

def fix_imports(file_path):
    """Fix imports in a single file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace 'from python.src...' with relative imports
    modified = False
    
    # Replace imports in python/src/simulation/simulator.py
    if 'simulator.py' in str(file_path):
        new_content = re.sub(
            r'from python\.src\.config_parser import', 
            'from ..config_parser import', 
            content
        )
        new_content = re.sub(
            r'from python\.src\.utils\.distribution_utils import', 
            'from ..utils.distribution_utils import', 
            new_content
        )
        if new_content != content:
            modified = True
            content = new_content
    
    # Replace imports in python/src/generator/db_generator.py
    elif 'db_generator.py' in str(file_path):
        new_content = re.sub(
            r'from python\.src\.config_parser import', 
            'from ..config_parser import', 
            content
        )
        if new_content != content:
            modified = True
            content = new_content
    
    # Replace imports in python/src/config_parser/sim_parser.py
    elif 'sim_parser.py' in str(file_path):
        new_content = re.sub(
            r'from python\.src\.config_parser\.db_parser import', 
            'from .db_parser import', 
            content
        )
        if new_content != content:
            modified = True
            content = new_content
    
    # Replace imports in python/api/routes.py
    elif 'routes.py' in str(file_path):
        # Add sys.path.append for python/api/routes.py
        new_content = re.sub(
            r'from python\.src\.generator import generate_database, generate_database_for_simulation', 
            'import sys\nimport os\n\n# Add parent directory to sys.path\nsys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n\nfrom src.generator import generate_database, generate_database_for_simulation', 
            content
        )
        new_content = re.sub(
            r'from python\.src\.simulation\.runner import', 
            'from src.simulation.runner import', 
            new_content
        )
        new_content = re.sub(
            r'from python\.config_storage\.config_db import', 
            'from config_storage.config_db import', 
            new_content
        )
        if new_content != content:
            modified = True
            content = new_content
    
    if modified:
        print(f"Fixing imports in {file_path}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def main():
    """Main function to scan and fix imports."""
    root_dir = Path(__file__).parent
    python_dir = root_dir / 'python'
    
    # Files that need fixing
    target_files = [
        python_dir / 'src' / 'simulation' / 'simulator.py',
        python_dir / 'src' / 'generator' / 'db_generator.py',
        python_dir / 'src' / 'config_parser' / 'sim_parser.py',
        python_dir / 'api' / 'routes.py'
    ]
    
    fixed_count = 0
    for file_path in target_files:
        if file_path.exists():
            if fix_imports(file_path):
                fixed_count += 1
    
    print(f"Fixed imports in {fixed_count} files.")

if __name__ == '__main__':
    main() 