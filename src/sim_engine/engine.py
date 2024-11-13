import logging
import os
from queue import PriorityQueue
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Set, Union

from .event import Event
from .handlers import event_handlers
from .resource_manager import ResourceManager
from ..config_parser.parser import parse_config
from ..config_parser.config_enhancer import (
    enhance_config,
    TableType,
    EntityStatus,
    ResourceStatus
)
from ..data_generator.entity_generator import generate_initial_entities
from ..database.db_manager import DatabaseManager
from ..utils.distributions import get_distribution
from .process_flow import ProcessFlow
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TableType:
    RESOURCE = 'resource'
    PROCESS_ENTITY = 'process_entity'
    MAPPING = 'mapping'

class SimulationEngine:
    """Simulation engine with table type awareness"""
    
    def __init__(self, config_path: str):
        # Load and enhance configuration
        raw_config = parse_config(config_path)
        self.config = enhance_config(raw_config)
        
        # Initialize basic attributes
        self.entities = {}
        self.event_queue = PriorityQueue()
        
        # Parse simulation time parameters
        self.start_time = datetime.strptime(
            self.config['simulation_parameters']['start_date'],
            "%Y-%m-%d %H:%M:%S"
        )
        self.end_time = datetime.strptime(
            self.config['simulation_parameters']['end_date'],
            "%Y-%m-%d %H:%M:%S"
        )
        self.current_time = self.start_time
        
        # Initialize database
        config_file_name = os.path.basename(config_path)
        self.db_manager = DatabaseManager(self.config, config_file_name)
        
        # Initialize resource manager if there are resource tables
        self.resource_manager = None
        if self._has_resource_tables():
            self.resource_manager = ResourceManager(self.config)
            
        self.active_processes = {}  
        self.event_dependencies = {}  
        self.event_history = {}  
        self.resource_conflicts = {}  
        self.parallel_processes = {}  
        
        # Initialize statistics dictionary
        self.statistics = {
            'events_processed': 0,
            'process_completions': 0,
            'process_durations': {},  
            'waiting_times': {},      
            'resource_queues': {},    
            'parallel_processes': {},
            'resource_conflicts': {},
            'process_chains': []  
        }
        
        # Initialize process flow
        self.process_flow = ProcessFlow(self.config)
        self.completed_events = {}  
        
    
    def run(self):
        """Run the simulation"""
        try:
            logger.info("Starting simulation...")
            self.initialize()
            
            logger.debug(f"Initial event queue size: {self.event_queue.qsize()}")
            
            # Process events until queue is empty or we reach end time
            while not self.event_queue.empty() and self.current_time <= self.end_time:
                event = self.event_queue.get()
                
                # Skip if event is after simulation end
                if event.time > self.end_time:
                    logger.debug(
                        f"Skipping event {event.name} scheduled for {event.time} "
                        f"(after simulation end {self.end_time})"
                    )
                    continue
                    
                # Update current time and process event
                self.current_time = event.time
                logger.debug(
                    f"Processing event at {self.current_time}: "
                    f"{event.name} for {event.entity_type} {event.entity_id}"
                )
                
                # Handle event
                self.handle_event(event)
                self.statistics['events_processed'] += 1
                
                # Update statistics if it's a completion event
                if event.name.startswith('Complete_'):
                    self.statistics['process_completions'] += 1
                    self._update_process_statistics(event)
                
                logger.debug(
                    f"Events remaining in queue: {self.event_queue.qsize()}"
                )
            
            logger.info(
                f"Simulation completed at {self.current_time}. "
                f"Processed {self.statistics['events_processed']} events, "
                f"{self.statistics['process_completions']} process completions"
            )
                
        except Exception as e:
            logger.error(f"Simulation failed: {str(e)}")
            raise
        

    def _has_resource_tables(self) -> bool:
        """Check if configuration has any resource tables"""
        return any(
            entity.get('type') == TableType.RESOURCE 
            for entity in self.config['entities']
        )

    def initialize(self):
        """Initialize simulation state"""
        try:
            # Generate initial entities
            self.entities = generate_initial_entities(self.config)
            
            # Store entities in database
            for entity_type, entities in self.entities.items():
                self.db_manager.bulk_insert(entity_type, entities)
            
            # Initialize resource manager if exists
            if self.resource_manager:
                self.resource_manager.initialize_resources(self.entities)
            
            # Schedule initial events
            self._schedule_initial_events()
            
            logger.info("Simulation initialization completed successfully")
            
        except Exception as e:
            logger.error(f"Initialization failed: {str(e)}")
            raise

    def _schedule_initial_events(self):
        """Schedule initial events for process entities with dependency handling"""
        if 'events' not in self.config:
            logger.warning("No events found in configuration")
            return

        process_entities = self._get_process_entities()
        
        # Build event dependency graph
        for event_config in self.config['events']:
            event_name = event_config['name']
            self.event_dependencies[event_name] = set()
            
            if 'process_config' in event_config:
                # Add explicit dependencies
                if 'dependencies' in event_config['process_config']:
                    for dep in event_config['process_config']['dependencies']:
                        self.event_dependencies[event_name].add(dep['event'])

        # Schedule only events with no dependencies initially
        for event_config in self.config['events']:
            if event_config['type'] == 'Process':
                event_name = event_config['name']
                entity_type = event_config['entity']
                
                # Skip if entity type is invalid
                if entity_type not in process_entities:
                    logger.warning(f"Event {event_name} references invalid process entity: {entity_type}")
                    continue
                
                # Schedule only if no dependencies or backward compatibility mode
                if not self.event_dependencies[event_name] or len(self.config['events']) == 1:
                    self._schedule_event_for_entities(event_config, entity_type)
                    
    def _schedule_event_for_entities(self, event_config: Dict, entity_type: str):
        """Schedule events for all entities of a given type"""
        for entity_id, entity_data in self.entities[entity_type].items():
            event_time = self._get_valid_event_time(entity_data.get('CreatedAt', self.start_time))
            
            logger.debug(
                f"Scheduling initial event {event_config['name']} for "
                f"{entity_type} {entity_id} at {event_time}"
            )
            
            self.schedule_event(
                event_config['name'],
                entity_type,
                entity_id,
                event_time,
                {}
            )
    def _get_valid_event_time(self, event_time: datetime) -> datetime:
        """Ensure event time is within simulation bounds"""
        if event_time > self.end_time:
            return self.start_time
        elif event_time < self.start_time:
            return self.start_time
        return event_time

    def _get_process_entities(self) -> Set[str]:
        """Get set of process entity table names"""
        return {
            entity['name'] for entity in self.config['entities']
            if entity.get('type') == TableType.PROCESS_ENTITY
        }

    def handle_event(self, event: Event):
        """Enhanced event handling with dependency management"""
        logger.debug(f"Handling event: {event}")
        
        try:
            # Update parallel process tracking
            entity_id = f"{event.entity_type}_{event.entity_id}"
            if entity_id not in self.parallel_processes:
                self.parallel_processes[entity_id] = set()
            
            if not event.name.startswith(('Release_', 'Complete_')):
                self.parallel_processes[entity_id].add(event.name)
                self.statistics['parallel_processes'][entity_id] = max(
                    self.statistics['parallel_processes'].get(entity_id, 0),
                    len(self.parallel_processes[entity_id])
                )
            
            # Handle the event
            handler = event_handlers.get(event.type)
            if not handler:
                logger.warning(f"No handler found for event type: {event.type}")
                return

            # Process the event
            result = handler(self, event)
            
            # Handle completion
            if event.name.startswith('Complete_'):
                self._handle_event_completion(event)
            
            return result
            
        except Exception as e:
            logger.error(f"Error handling event {event}: {str(e)}")
            raise
        
    def _handle_event_completion(self, event: Event):
        """Handle event completion and schedule ready events"""
        entity_id = f"{event.entity_type}_{event.entity_id}"
        event_name = event.name.replace('Complete_', '')
        
        # Update completion tracking
        if entity_id not in self.completed_events:
            self.completed_events[entity_id] = set()
        self.completed_events[entity_id].add(event_name)
        
        # Remove from parallel processes
        if entity_id in self.parallel_processes:
            self.parallel_processes[entity_id].discard(event_name)
        
        # Schedule ready events
        self._schedule_ready_events(event)
        
    def _schedule_ready_events(self, completed_event: Event):
        """Schedule events whose dependencies are now met"""
        entity_id = f"{completed_event.entity_type}_{completed_event.entity_id}"
        completed_name = completed_event.name.replace('Complete_', '')
        
        for event_name, dependencies in self.event_dependencies.items():
            # Skip if already completed or in progress
            if (entity_id in self.completed_events and 
                event_name in self.completed_events[entity_id]):
                continue
                
            if (entity_id in self.parallel_processes and 
                event_name in self.parallel_processes[entity_id]):
                continue
            
            # Check if all dependencies are met
            if dependencies and dependencies.issubset(self.completed_events.get(entity_id, set())):
                event_config = next(
                    (e for e in self.config['events'] if e['name'] == event_name),
                    None
                )
                
                if event_config:
                    delay = self._calculate_event_delay(event_config, completed_event)
                    event_time = completed_event.time + delay
                    
                    self.schedule_event(
                        event_name,
                        completed_event.entity_type,
                        completed_event.entity_id,
                        event_time,
                        {}
                    )

    def schedule_event(
        self,
        event_name: str,
        entity_type: str,
        entity_id: int,
        event_time: datetime,
        params: Optional[Dict] = None
    ):
        """Schedule a new event with table type validation"""
        # Validate entity type
        if event_time > self.end_time:
            logger.debug(
                f"Skipping event {event_name} for {entity_type} {entity_id}: "
                f"time {event_time} is after simulation end {self.end_time}"
            )
            return
        entity_config = next(
            (e for e in self.config['entities'] if e['name'] == entity_type),
            None
        )
        
        if not entity_config:
            raise ValueError(f"Invalid entity type for event: {entity_type}")
            
        if (entity_config['type'] == TableType.RESOURCE and 
            not event_name.startswith(('Release_', 'Complete_'))):
            raise ValueError(f"Cannot schedule process events for resource type: {entity_type}")

        # Determine event type
        if event_name.startswith(('Release_', 'Complete_')):
            event_type = 'Complete'
        else:
            event_config = next(
                (e for e in self.config['events'] if e['name'] == event_name),
                None
            )
            if not event_config:
                raise ValueError(f"No configuration found for event: {event_name}")
            event_type = event_config['type']

        # Create and schedule event
        event = Event(event_type, entity_type, entity_id, event_time, event_name, params or {})
        self.event_queue.put(event)
        logger.debug(
            f"Scheduled event {event_name} for {entity_type} {entity_id} "
            f"at {event_time}. Queue size: {self.event_queue.qsize()}"
        )

    def _process_follow_up_events(self, event: Event, entity_id: int):
        """Process any follow-up events"""
        event_config = next(
            (e for e in self.config.get('events', []) if e['name'] == event.name),
            None
        )
        
        if not event_config or 'follow_up' not in event_config:
            return
            
        for follow_up in event_config['follow_up']:
            delay = self._calculate_delay(follow_up.get('delay', {}))
            event_time = event.time + delay
            
            if event_time < self.end_time:
                self.schedule_event(
                    follow_up['event'],
                    event.entity_type,
                    entity_id,
                    event_time,
                    follow_up.get('params', {})
                )

    def _calculate_delay(self, delay_config: Union[dict, int, float]) -> timedelta:
        """Calculate delay based on configuration"""
        if isinstance(delay_config, (int, float)):
            return timedelta(hours=delay_config)
            
        distribution = get_distribution(delay_config)
        delay_value = distribution()
        
        return timedelta(hours=delay_value)

    def _update_process_statistics(self, event: Event):
        """Update process statistics after completion"""
        process_name = event.name.replace('Complete_', '')
        if process_name not in self.statistics['process_durations']:
            self.statistics['process_durations'][process_name] = []
            
        # Get original process start time from mapping table
        process_info = self.db_manager.get_process_records(process_name)
        if process_info:
            start_time = min(record['start_time'] for record in process_info)
            duration = (event.time - start_time).total_seconds() / 3600  # hours
            self.statistics['process_durations'][process_name].append(duration)

    def _calculate_event_delay(self, event_config: Dict[str, Any], completed_event: Event) -> timedelta:
        """Calculate delay for scheduling dependent events based on configuration"""
        # Get delay from process configuration
        if 'process_config' in event_config:
            delay_config = event_config['process_config'].get('delay')
            if delay_config:
                if isinstance(delay_config, (int, float)):
                    return timedelta(hours=float(delay_config))
                elif isinstance(delay_config, str):
                    from ..utils.distributions import get_distribution
                    delay_dist = get_distribution(delay_config)
                    return timedelta(hours=delay_dist())
                elif isinstance(delay_config, dict):
                    return self._calculate_delay(delay_config)
        
        # Default to immediate scheduling if no delay specified
        return timedelta(hours=0)