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

logging.basicConfig(level=logging.INFO)
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
            
        # Track simulation statistics
        self.statistics = {
            'events_processed': 0,
            'process_completions': 0,
            'resource_utilization': {},
            'process_durations': {}
        }

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
        """Schedule initial events for process entities"""
        if 'events' not in self.config:
            return

        process_entities = self._get_process_entities()
        
        for event_config in self.config['events']:
            if event_config['type'] == 'Process':
                entity_type = event_config['entity']
                
                # Validate entity type
                if entity_type not in process_entities:
                    logger.warning(
                        f"Event {event_config['name']} references invalid process "
                        f"entity: {entity_type}"
                    )
                    continue
                
                # Schedule events for each entity instance
                for entity_id, entity_data in self.entities[entity_type].items():
                    event_time = entity_data.get('CreatedAt', self.start_time)
                    self.schedule_event(
                        event_config['name'],
                        entity_type,
                        entity_id,
                        event_time,
                        {}
                    )

    def _get_process_entities(self) -> Set[str]:
        """Get set of process entity table names"""
        return {
            entity['name'] for entity in self.config['entities']
            if entity.get('type') == TableType.PROCESS_ENTITY
        }

    def run(self):
        """Run the simulation"""
        try:
            self.initialize()
            
            while not self.event_queue.empty() and self.current_time < self.end_time:
                # Process next event
                event = self.event_queue.get()
                self.current_time = event.time
                
                # Handle event
                self.handle_event(event)
                self.statistics['events_processed'] += 1
                
                # Update statistics if it's a completion event
                if event.name.startswith('Complete_'):
                    self.statistics['process_completions'] += 1
                    self._update_process_statistics(event)
            
            # Record final resource utilization
            if self.resource_manager:
                self.statistics['resource_utilization'] = \
                    self.resource_manager.get_resource_utilization(
                        self.start_time,
                        self.current_time
                    )
            
            logger.info(
                f"Simulation completed. Processed {self.statistics['events_processed']} "
                f"events, {self.statistics['process_completions']} process completions"
            )
            
        except Exception as e:
            logger.error(f"Simulation failed: {str(e)}")
            raise
            
        finally:
            self.db_manager.close()

    def handle_event(self, event: Event):
        """Handle a single event"""
        logger.debug(f"Handling event: {event}")
        
        handler = event_handlers.get(event.type)
        if not handler:
            logger.warning(f"No handler found for event type: {event.type}")
            return

        try:
            # Get entity type before handling event
            entity_config = next(
                (e for e in self.config['entities'] if e['name'] == event.entity_type),
                None
            )
            
            if not entity_config:
                raise ValueError(f"Invalid entity type: {event.entity_type}")
            
            # Handle the event
            entity_id = handler(self, event)
            if entity_id:
                self._process_follow_up_events(event, entity_id)
                
        except Exception as e:
            logger.error(f"Error handling event {event}: {str(e)}")
            raise

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