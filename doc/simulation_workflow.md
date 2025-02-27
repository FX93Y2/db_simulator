# DB Simulator Workflow

This document explains the workflow of the DB Simulator, a discrete event simulation system with dynamic entity generation.

## Workflow Overview

The DB Simulator implements a discrete event simulation system that models entities (like projects) arriving over time, generating events (like deliverables) that need processing, and consuming resources (like consultants) that may operate on specific work schedules.

## Step 1: CLI Command

The simulation is initiated using the `dynamic-simulate` command:

```bash
python -m src.cli dynamic-simulate config/db_config/demo_db.yaml config/sim_config/event_simulation.yaml
```

This command:
- Takes a database configuration file (`demo_db.yaml`)
- Takes a simulation configuration file (`event_simulation.yaml`)
- Generates a database with only resource tables
- Runs the simulation with dynamic entity generation

## Step 2: Database Generation

During the database generation phase:

```python
def generate_database_for_simulation(db_config_path, sim_config_path, output_dir, db_name):
    # Parse simulation configuration to identify entity and event tables
    sim_config = parse_sim_config(sim_config_path)
    
    dynamic_entity_tables = []
    if sim_config.event_simulation:
        # Add entity table
        if sim_config.event_simulation.entity_table:
            dynamic_entity_tables.append(sim_config.event_simulation.entity_table)
        
        # Add event table
        if sim_config.event_simulation.event_table:
            dynamic_entity_tables.append(sim_config.event_simulation.event_table)
    
    # Generate database, skipping entity and event tables
    return generate_database(db_config_path, output_dir, db_name, dynamic_entity_tables)
```

The system:
1. Only resource tables (like `Consultant`) are pre-populated with data
2. Entity tables (like `Project`) and event tables (like `Deliverable`) are created as empty tables
3. The database is prepared for dynamic entity generation during simulation

## Step 3: Simulation Initialization

Before the simulation starts running:

```python
def run(self) -> Dict[str, Any]:
    """Run the simulation"""
    # Create SimPy environment
    self.env = simpy.Environment()
    
    # Set up resources
    self._setup_resources()
    
    # Pre-generate entity arrivals
    arrival_times = self._pre_generate_entity_arrivals()
    
    # Process pre-generated arrivals
    self.env.process(self._process_pre_generated_arrivals(arrival_times))
    
    # Run the simulation
    self.env.run(until=self.duration_minutes)
    
    # Return results
    return {
        "duration_days": self.duration_days,
        "entities_created": self.entity_counter,
        "processed_events": self.processed_events
    }
```

The system:
1. Parses the simulation configuration
2. Sets up a SimPy environment
3. Creates resource objects for each consultant
4. Pre-generates entity arrival times based on the configured interarrival time distribution
5. Prepares to process entities at their scheduled arrival times

## Step 4: Simulation Run

During the simulation run:

```python
def _process_pre_generated_arrivals(self, arrival_times: List[float]):
    """Process pre-generated entity arrivals"""
    for arrival_time in arrival_times:
        # Wait until the arrival time
        yield self.env.timeout(arrival_time - self.env.now)
        
        # Create a new entity
        with Session(self.engine) as session:
            entity_id = self._create_entity(session, entity_table)
            
            # Record entity arrival
            self.event_tracker.record_entity_arrival(
                entity_table=entity_table,
                entity_id=entity_id,
                sim_time=self.env.now
            )
            
            # Create events for this entity
            event_ids = self._create_events(
                session, 
                entity_id, 
                event_table, 
                relationship_column
            )
            
            # Process events for this entity
            self.env.process(self._process_entity_events(entity_id))
            
            # Increment entity counter
            self.entity_counter += 1
```

For each arrival time:
1. The simulation waits until the scheduled arrival time
2. Creates a new entity (Project) in the database
3. Records the entity arrival in the tracking table
4. Generates multiple events (Deliverables) for that entity
5. Schedules the events for processing
6. Increments the entity counter

The interarrival time configuration is critical as it determines how many entities are created during the simulation. If entities arrive too quickly, they can overwhelm the available resources.

## Step 5: Event Processing

For each event, the simulator:

```python
def _process_entity_events(self, entity_id: int):
    """Process all events for an entity"""
    # Get all events for this entity
    with Session(self.engine) as session:
        sql_query = text(f"""
            SELECT id FROM {event_table} 
            WHERE {relationship_column} = {entity_id + 1}
            ORDER BY id
        """)
        result = session.execute(sql_query)
        event_ids = [row[0] for row in result]
    
    # Process each event in order
    for event_id in event_ids:
        # Get event duration
        duration_minutes = generate_from_distribution(
            event_sim.event_duration.get('distribution', {})
        ) * 24 * 60  # Convert days to minutes
        
        # Determine required resources
        required_resources = self._determine_required_resources(event_id)
        
        # Request all required resources
        for resource_key in required_resources:
            resource = self.resources.get(resource_key)
            if resource:
                # Check if resource is on shift (if enabled)
                if self._are_work_shifts_enabled():
                    next_available_time = self._wait_until_resource_available(resource_key)
                    if next_available_time > self.env.now:
                        yield self.env.timeout(next_available_time - self.env.now)
                
                # Request the resource
                resource_requests[resource_key] = resource.request()
                yield resource_requests[resource_key]
        
        # Process the event (simulate work being done)
        yield self.env.timeout(duration_minutes)
        
        # Release all resources
        for resource_key, request in resource_requests.items():
            resource = self.resources.get(resource_key)
            if resource:
                resource.release(request)
        
        # Record event processing and resource allocations
        self.event_tracker.record_event_processing(...)
        self.event_tracker.record_resource_allocation(...)
        
        # Increment processed events counter
        self.processed_events += 1
```

1. Determines required resources based on configuration:
   ```yaml
   resource_requirements:
     - resource_table: Consultant
       type_column: role
       requirements:
         - resource_type: Developer
           count:
             distribution:
               type: normal
               mean: 2
               min: 1
               max: 3
   ```

2. Checks if resources are on shift (if work shifts are enabled):
   ```yaml
   work_shifts:
     enabled: false  # Set to true to enable work shift restrictions
     shift_patterns:
       - name: "Regular Weekday"
         days: [0, 1, 2, 3, 4]  # Monday to Friday
         start_time: "07:00"
         end_time: "19:00"
   ```

3. Requests and allocates resources
4. Processes the event for the configured duration
5. Releases the resources
6. Records the event processing and resource allocations in the database
7. Increments the processed events counter

## Results Tracking

The simulation results are tracked in several database tables:

1. `sim_entity_arrivals`: Records when entities (Projects) arrive
2. `sim_event_processing`: Records when events (Deliverables) are processed
3. `sim_resource_allocations`: Records resource allocation details
4. `Deliverable_Consultant`: Records consultant assignments to deliverables (main output)

The final simulation results include:
- Duration of the simulation in days
- Number of entities created
- Number of events processed
- Number of resource allocations (records in the bridging table)

## Key Performance Factors

The simulation performance is affected by several key factors:

1. **Entity Arrival Rate**: Controlled by the interarrival time configuration. Shorter interarrival times create more entities but can overwhelm resources.

2. **Work Shift Constraints**: Enabling work shifts significantly reduces event processing capacity (by ~30-50%) but provides more realistic modeling of resource availability.

3. **Resource Requirements**: Each event requires multiple resources, explaining why the number of resource allocations is higher than the number of processed events.

4. **Processing Efficiency**: With optimal configuration, the system can process approximately 50% of generated events in a 90-day simulation. 