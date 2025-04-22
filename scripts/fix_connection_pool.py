#!/usr/bin/env python
"""
Fix script for SQLAlchemy connection pool issues

This script modifies the simulator.py and event_tracker.py files to use NullPool
instead of the default connection pool, which can cause issues with large simulations.
It also implements process-specific database engines for SimPy processes to avoid
"Cannot operate on a closed database" errors.
"""

import os
import re
import shutil
from pathlib import Path

def backup_file(file_path):
    """Create a backup of the file"""
    backup_path = f"{file_path}.bak"
    shutil.copy2(file_path, backup_path)
    print(f"Created backup: {backup_path}")

def fix_simulator_file():
    """Fix the simulator.py file"""
    file_path = Path("src/simulation/simulator.py")
    
    if not file_path.exists():
        print(f"Error: {file_path} not found")
        return False
    
    # Create backup
    backup_file(file_path)
    
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Add import for NullPool if not present
    if "from sqlalchemy.pool import NullPool" not in content:
        content = re.sub(
            r"from sqlalchemy.orm import Session",
            "from sqlalchemy.orm import Session\nfrom sqlalchemy.pool import NullPool",
            content
        )
    
    # Replace engine creation
    content = re.sub(
        r"self\.engine = create_engine\(f\"sqlite:///{db_path}\"\)",
        'self.engine = create_engine(\n'
        '            f"sqlite:///{db_path}?journal_mode=WAL",\n'
        '            poolclass=NullPool,\n'
        '            connect_args={"check_same_thread": False}\n'
        '        )',
        content
    )
    
    # Fix _process_entity_events method to use process-specific engines
    process_entity_events_pattern = r"def _process_entity_events\(self, entity_id: int\):(.*?)def _determine_required_resources"
    process_entity_events_replacement = """def _process_entity_events(self, entity_id: int):
        \"\"\"
        Process all events for an entity in primary key order
        
        Args:
            entity_id: Entity ID
        \"\"\"
        event_sim = self.config.event_simulation
        if not event_sim:
            return
            
        entity_table = event_sim.entity_table
        event_table = event_sim.event_table
        relationship_column = event_sim.relationship_column
        
        # Create a new engine for this process to avoid connection sharing issues
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Get all events for this entity, ordered by primary key
                sql_query = text(f\"\"\"
                    SELECT id FROM {event_table} 
                    WHERE {relationship_column} = {entity_id + 1}
                    ORDER BY id
                \"\"\")
                result = session.execute(sql_query)
                event_ids = [row[0] for row in result]
        except Exception as e:
            logging.error(f"Error fetching events for entity {entity_id}: {str(e)}")
            process_engine.dispose()
            return
        
        # Process each event in order
        for event_id in event_ids:
            try:
                # Get event duration
                duration_minutes = generate_from_distribution(
                    event_sim.event_duration.get('distribution', {})
                ) * 24 * 60  # Convert days to minutes
                
                # Record event start time
                event_start_time = self.env.now
                
                # Allocate resources for this event
                required_resources = self._determine_required_resources(event_id)
                
                if not required_resources:
                    continue
                    
                # Create a dictionary to store resource requests
                resource_requests = {}
                
                # Request all required resources
                for resource_key in required_resources:
                    resource = self.resources.get(resource_key)
                    if resource:
                        # Check if resource is on shift
                        if self._are_work_shifts_enabled():
                            # Calculate the next time when the resource will be available
                            next_available_time = self._wait_until_resource_available(resource_key)
                            
                            # If resource is not currently on shift, yield until they are
                            if next_available_time > self.env.now:
                                yield self.env.timeout(next_available_time - self.env.now)
                        
                        # Request the resource
                        resource_requests[resource_key] = resource.request()
                        yield resource_requests[resource_key]
                
                # All resources acquired, process the event
                processing_start_time = self.env.now
                
                # Check if any resources went off shift during acquisition
                if self._are_work_shifts_enabled():
                    # Calculate the next time when all resources will be available
                    next_available_time = self._calculate_next_available_time(required_resources)
                    
                    # If any resource is not on shift, yield until they are
                    if next_available_time > self.env.now:
                        # Release all resources
                        for resource_key, request in resource_requests.items():
                            resource = self.resources.get(resource_key)
                            if resource:
                                resource.release(request)
                        
                        # Wait until all resources are available
                        yield self.env.timeout(next_available_time - self.env.now)
                        
                        # Re-request all resources
                        resource_requests = {}
                        for resource_key in required_resources:
                            resource = self.resources.get(resource_key)
                            if resource:
                                resource_requests[resource_key] = resource.request()
                                yield resource_requests[resource_key]
                
                # Process the event (simulate work being done)
                remaining_duration = duration_minutes
                
                while remaining_duration > 0:
                    # Check if any resources will go off shift during processing
                    if self._are_work_shifts_enabled():
                        next_shift_change = self._calculate_next_shift_change(required_resources)
                        
                        if next_shift_change is not None and next_shift_change < self.env.now + remaining_duration:
                            # Process until shift change
                            time_until_shift_change = next_shift_change - self.env.now
                            yield self.env.timeout(time_until_shift_change)
                            remaining_duration -= time_until_shift_change
                            
                            # Release all resources
                            for resource_key, request in resource_requests.items():
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource.release(request)
                            
                            # Wait until all resources are available again
                            next_available_time = self._calculate_next_available_time(required_resources)
                            yield self.env.timeout(next_available_time - self.env.now)
                            
                            # Re-request all resources
                            resource_requests = {}
                            for resource_key in required_resources:
                                resource = self.resources.get(resource_key)
                                if resource:
                                    resource_requests[resource_key] = resource.request()
                                    yield resource_requests[resource_key]
                        else:
                            # Process the remaining duration
                            yield self.env.timeout(remaining_duration)
                            remaining_duration = 0
                    else:
                        # Process the remaining duration
                        yield self.env.timeout(remaining_duration)
                        remaining_duration = 0
                
                # Record event completion
                event_end_time = self.env.now
                
                # Release all resources
                for resource_key, request in resource_requests.items():
                    resource = self.resources.get(resource_key)
                    if resource:
                        resource.release(request)
                
                # Record event processing in the database
                try:
                    with Session(process_engine) as session:
                        # Get the entity ID from the database (primary key)
                        sql_query = text(f\"\"\"
                            SELECT id FROM {entity_table} 
                            WHERE id = {entity_id + 1}
                        \"\"\")
                        result = session.execute(sql_query).fetchone()
                        db_entity_id = result[0] if result else None
                        
                        if db_entity_id:
                            # Record event processing
                            self.event_tracker.record_event_processing(
                                event_table=event_table,
                                event_id=event_id,
                                entity_id=db_entity_id,
                                start_time=event_start_time,
                                end_time=event_end_time
                            )
                            
                            # Record resource allocations
                            for resource_key in required_resources:
                                resource_parts = resource_key.split('_')
                                resource_table = resource_parts[0]
                                resource_id = int(resource_parts[1])
                                
                                self.event_tracker.record_resource_allocation(
                                    event_id=event_id,
                                    resource_table=resource_table,
                                    resource_id=resource_id,
                                    allocation_time=processing_start_time,
                                    release_time=event_end_time
                                )
                            
                            # Increment processed events counter
                            self.processed_events += 1
                except Exception as e:
                    logging.error(f"Error recording event {event_id} for entity {entity_id}: {str(e)}")
            except Exception as e:
                logging.error(f"Error processing event {event_id} for entity {entity_id}: {str(e)}")
        
        # Dispose of the process-specific engine
        process_engine.dispose()
        
    def _determine_required_resources"""
    
    content = re.sub(process_entity_events_pattern, process_entity_events_replacement, content, flags=re.DOTALL)
    
    # Fix _determine_required_resources method to use process-specific engines
    determine_required_resources_pattern = r"def _determine_required_resources\(self, event_id: int\) -> List\[str\]:(.*?)def _are_work_shifts_enabled"
    determine_required_resources_replacement = """def _determine_required_resources(self, event_id: int) -> List[str]:
        \"\"\"
        Determine the required resources for an event
        
        Args:
            event_id: Event ID
            
        Returns:
            List of resource keys
        \"\"\"
        event_sim = self.config.event_simulation
        if not event_sim:
            return []
            
        required_resources = []
        
        # Create a process-specific engine to avoid connection sharing issues
        process_engine = create_engine(
            f"sqlite:///{self.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Get the event type to determine specific resource requirements
                event_table = event_sim.event_table
                sql_query = text(f"SELECT type FROM {event_table} WHERE id = {event_id}")
                result = session.execute(sql_query)
                event_type = None
                for row in result:
                    event_type = row[0]
                    break
                    
                # Process each resource requirement
                for resource_req in event_sim.resource_requirements:
                    resource_table = resource_req.resource_table
                    type_column = resource_req.type_column
                    
                    # Get all resources of this type
                    for req in resource_req.requirements:
                        resource_type = req.resource_type
                        
                        # Determine how many resources of this type are needed
                        count = req.count
                        if isinstance(count, dict) and 'distribution' in count:
                            count = int(round(generate_from_distribution(count['distribution'])))
                        else:
                            count = int(count)
                        
                        # Skip if no resources needed
                        if count <= 0:
                            continue
                        
                        # Get available resources of this type
                        sql_query = text(f\"\"\"
                            SELECT id FROM {resource_table} 
                            WHERE {type_column} = '{resource_type}'
                            ORDER BY id
                        \"\"\")
                        result = session.execute(sql_query)
                        resource_ids = [row[0] for row in result]
                        
                        # Add required resources
                        for i in range(min(count, len(resource_ids))):
                            resource_key = f"{resource_table}_{resource_ids[i]}"
                            required_resources.append(resource_key)
        except Exception as e:
            logging.error(f"Error determining required resources for event {event_id}: {str(e)}")
        finally:
            # Dispose of the process-specific engine
            process_engine.dispose()
            
        return required_resources
        
    def _are_work_shifts_enabled"""
    
    content = re.sub(determine_required_resources_pattern, determine_required_resources_replacement, content, flags=re.DOTALL)
    
    # Write the modified content
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"Fixed {file_path}")
    return True

def fix_event_tracker_file():
    """Fix the event_tracker.py file"""
    file_path = Path("src/simulation/event_tracker.py")
    
    if not file_path.exists():
        print(f"Error: {file_path} not found")
        return False
    
    # Create backup
    backup_file(file_path)
    
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Add import for NullPool if not present
    if "from sqlalchemy.pool import NullPool" not in content:
        content = re.sub(
            r"from sqlalchemy import",
            "from sqlalchemy import",
            content
        )
        content = re.sub(
            r"from sqlalchemy import.*?\n",
            "\\g<0>from sqlalchemy.pool import NullPool\n",
            content
        )
    
    # Replace engine creation
    content = re.sub(
        r"self\.engine = create_engine\(f\"sqlite:///{db_path}\"\)",
        'self.engine = create_engine(\n'
        '            f"sqlite:///{db_path}?journal_mode=WAL",\n'
        '            poolclass=NullPool,\n'
        '            connect_args={"check_same_thread": False}\n'
        '        )',
        content
    )
    
    # Write the modified content
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"Fixed {file_path}")
    return True

def update_readme():
    """Update the README.md file with improved troubleshooting information"""
    file_path = Path("README.md")
    
    if not file_path.exists():
        print(f"Error: {file_path} not found")
        return False
    
    # Create backup
    backup_file(file_path)
    
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check if troubleshooting section exists
    if "## Troubleshooting" not in content:
        print("No troubleshooting section found in README.md")
        return False
    
    # Update the SQLAlchemy connection pool errors section
    troubleshooting_pattern = r"### SQLAlchemy Connection Pool Errors(.*?)### Other Common Issues"
    troubleshooting_replacement = """### SQLAlchemy Connection Pool Errors

If you encounter errors like:
```
QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00
```
or
```
Cannot operate on a closed database
```

These errors occur when running large simulations with many parallel processes trying to access the database simultaneously. The default SQLAlchemy connection pool has a limit of 5 connections with 10 overflow connections, and SimPy's concurrent processes can cause database connections to be closed unexpectedly.

#### Solution:

1. Run the provided fix script to automatically apply all necessary changes:

```bash
python scripts/fix_connection_pool.py
```

This script will:
- Modify the SQLAlchemy engine creation to use NullPool instead of the default connection pool
- Enable WAL journal mode for better SQLite concurrency
- Implement process-specific database engines for SimPy processes
- Add proper error handling for database operations

2. If you prefer to make the changes manually, here are the key modifications:

```python
# 1. Import NullPool
from sqlalchemy.pool import NullPool

# 2. Create engine with NullPool and WAL journal mode
self.engine = create_engine(
    f"sqlite:///{db_path}?journal_mode=WAL",
    poolclass=NullPool,
    connect_args={"check_same_thread": False}
)

# 3. For SimPy processes, create process-specific engines
process_engine = create_engine(
    f"sqlite:///{self.db_path}?journal_mode=WAL",
    poolclass=NullPool,
    connect_args={"check_same_thread": False}
)

# 4. Always dispose of process-specific engines when done
try:
    with Session(process_engine) as session:
        # Database operations
        pass
finally:
    process_engine.dispose()
```

3. Ensure database connections are properly closed after use:

```python
# Always use the context manager for database sessions
with Session(self.engine) as session:
    # Database operations
    pass  # Session is automatically closed when the block exits
```

4. For large simulations, consider batching database operations to reduce the number of concurrent connections.

### Other Common Issues"""
    
    content = re.sub(troubleshooting_pattern, troubleshooting_replacement, content, flags=re.DOTALL)
    
    # Write the modified content
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"Updated {file_path}")
    return True

def main():
    """Main function"""
    print("Fixing SQLAlchemy connection pool issues...")
    
    # Create scripts directory if it doesn't exist
    os.makedirs("scripts", exist_ok=True)
    
    # Fix files
    simulator_fixed = fix_simulator_file()
    event_tracker_fixed = fix_event_tracker_file()
    readme_updated = update_readme()
    
    if simulator_fixed and event_tracker_fixed:
        print("\nFix completed successfully!")
        print("\nThe changes made:")
        print("1. Added import for sqlalchemy.pool.NullPool")
        print("2. Modified engine creation to use NullPool and WAL journal mode")
        print("3. Implemented process-specific database engines for SimPy processes")
        print("4. Added proper error handling for database operations")
        print("5. Updated README.md with improved troubleshooting information")
        print("\nThese changes should resolve the connection pool issues and 'Cannot operate on a closed database' errors.")
        print("If you encounter any problems, you can restore the backup files (.bak).")
    else:
        print("\nFix completed with errors. Please check the output above.")

if __name__ == "__main__":
    main() 