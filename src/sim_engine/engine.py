import logging
import os
from queue import PriorityQueue
from datetime import datetime, timedelta
from .event import Event
from .handlers import event_handlers
from .resource_manager import ResourceManager
from ..config_parser.parser import parse_config
from ..config_parser.config_enhancer import enhance_config
from ..data_generator.entity_generator import generate_initial_entities
from ..database.db_manager import DatabaseManager
from ..utils.distributions import get_distribution

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimulationEngine:
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
        
        # Initialize resource manager only if process definitions exist
        self.resource_manager = None
        if 'process_definitions' in self.config:
            self.resource_manager = ResourceManager(self.config)

    def initialize(self):
        """Initialize simulation state"""
        try:
            # Generate initial entities
            self.entities = generate_initial_entities(self.config)
            
            # Store entities in database
            for entity_type, entities in self.entities.items():
                self.db_manager.bulk_insert(entity_type, entities)
            
            # Initialize resource manager if it exists
            if self.resource_manager:
                self.resource_manager.initialize_resources(self.entities)
            
            # Schedule initial events
            self._schedule_initial_events()
            
        except Exception as e:
            logger.error(f"Initialization failed: {str(e)}")
            raise

    def _schedule_initial_events(self):
        """Schedule all initial events based on configuration"""
        if 'events' in self.config:
            for event_config in self.config['events']:
                if event_config['type'] == 'Process' and self.resource_manager:
                    self._schedule_process_events(event_config)
                elif event_config['type'] == 'Assign':
                    self._schedule_assign_events(event_config)
        elif 'process_definitions' in self.config:
            # Schedule process events for each entity based on process definitions
            for process in self.config['process_definitions']:
                target_entity = process['target_entity']
                if target_entity in self.entities:
                    for entity_id, entity_data in self.entities[target_entity].items():
                        event_time = entity_data.get('CreatedAt', self.start_time)
                        self.schedule_event(
                            process['name'],
                            target_entity,
                            entity_id,
                            event_time,
                            {}
                        )

    def _schedule_process_events(self, event_config: dict):
        """Schedule process events for entities"""
        target_entity = event_config.get('target_entity')
        if not target_entity or target_entity not in self.entities:
            return
            
        for entity_id, entity_data in self.entities[target_entity].items():
            # Schedule process to start after entity creation
            event_time = entity_data.get('CreatedAt', self.start_time)
            self.schedule_event(
                event_config['name'],
                target_entity,
                entity_id,
                event_time,
                event_config.get('params', {})
            )

    def _schedule_assign_events(self, event_config: dict):
        """Schedule assignment events"""
        entity_type = event_config['entity']
        for entity_id, entity_data in self.entities[entity_type].items():
            event_time = entity_data.get('CreatedAt', self.start_time)
            self.schedule_event(
                event_config['name'],
                entity_type,
                entity_id,
                event_time,
                event_config.get('params', {})
            )

    def run(self):
        """Run the simulation"""
        try:
            self.initialize()
            
            while not self.event_queue.empty() and self.current_time < self.end_time:
                event = self.event_queue.get()
                self.current_time = event.time
                self.handle_event(event)
                
            logger.info(f"Simulation completed. Final time: {self.current_time}")
            
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
            entity_id = handler(self, event)
            if entity_id:
                self._process_follow_up_events(event, entity_id)
        except Exception as e:
            logger.error(f"Error handling event {event}: {str(e)}")
            raise

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

    def schedule_event(
        self,
        event_name: str,
        entity_type: str,
        entity_id: int,
        event_time: datetime,
        params: dict = None
    ):
        """Schedule a new event"""
        # Check for completion/release events first
        if event_name.startswith("Release_") or event_name.startswith("Complete_"):
            # Use "Complete" type for both release and complete events
            event = Event(
                "Complete",
                entity_type,
                entity_id,
                event_time,
                event_name,
                params
            )
            self.event_queue.put(event)
            return

        # Look for event in regular events first
        event_config = next(
            (e for e in self.config.get('events', []) if e['name'] == event_name),
            None
        )
        
        if event_config:
            event = Event(
                event_config['type'],
                entity_type,
                entity_id,
                event_time,
                event_name,
                params
            )
            self.event_queue.put(event)
            return

        # Check process definitions if no regular event found
        if 'process_definitions' in self.config:
            process_config = next(
                (p for p in self.config['process_definitions'] if p['name'] == event_name),
                None
            )
            if process_config:
                event = Event(
                    "Process",
                    entity_type,
                    entity_id,
                    event_time,
                    event_name,
                    params
                )
                self.event_queue.put(event)
                return

        logger.warning(f"No configuration found for event: {event_name}")

    def _calculate_delay(self, delay_config: dict) -> timedelta:
        """Calculate delay based on configuration"""
        if not delay_config:
            return timedelta()
            
        if isinstance(delay_config, (int, float)):
            return timedelta(hours=delay_config)
            
        distribution = get_distribution(delay_config)
        delay_value = distribution()
        
        return timedelta(hours=delay_value)