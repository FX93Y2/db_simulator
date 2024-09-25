import logging
from queue import PriorityQueue
import random
from .event import Event
from .handlers import event_handlers
from ..config_parser.parser import parse_config
from ..data_generator.entity_generator import generate_initial_entities
from ..database.db_manager import DatabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimulationEngine:
    def __init__(self, config_path):
        self.config = parse_config(config_path)
        self.entities = {}
        self.event_queue = PriorityQueue()
        self.current_time = 0
        try:
            self.db_manager = DatabaseManager(self.config)
            logger.info("DatabaseManager initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing DatabaseManager: {str(e)}")
            raise

    def run(self):
        self.initialize()
        while not self.event_queue.empty() and self.current_time < self.config['simulation_parameters']['duration']:
            event = self.event_queue.get()
            self.current_time = event.time
            self.handle_event(event)
        self.db_manager.close()

    def initialize(self):
        self.entities = generate_initial_entities(self.config)
        for entity_type, entities in self.entities.items():
            try:
                self.db_manager.bulk_insert(entity_type, entities)
                logger.info(f"Initial entities inserted for {entity_type}")
            except Exception as e:
                logger.error(f"Error inserting initial entities for {entity_type}: {str(e)}")
                raise
        for event in self.config['events']:
            if event['type'] == 'Create':
                self.schedule_event(event['name'], event['entity'], None, 0)

    def handle_event(self, event):
        logger.info(f"Handling event: {event}")
        handler = event_handlers.get(event.type)
        if handler:
            handler(self, event)
        else:
            logger.warning(f"No handler found for event type: {event.type}")
        self.schedule_follow_up_events(event)

    def schedule_event(self, event_name, entity_type, entity_id, delay, params=None):
        event_config = next((e for e in self.config['events'] if e['name'] == event_name), None)
        if event_config:
            event_time = self.current_time + delay
            event = Event(event_config['type'], entity_type, entity_id, event_time, event_name, params)
            self.event_queue.put(event)
            logger.info(f"Scheduled event: {event}")
        else:
            logger.warning(f"No configuration found for event: {event_name}")

    def schedule_follow_up_events(self, event):
        event_config = next((e for e in self.config['events'] if e['name'] == event.name), None)
        if event_config and 'follow_up' in event_config:
            for follow_up in event_config['follow_up']:
                delay = self.generate_delay(follow_up.get('delay', {'distribution': 'constant', 'value': 0}))
                self.schedule_event(follow_up['event'], event.entity_type, event.entity_id, delay)
        else:
            logger.info(f"No follow-up events for: {event.name}")

    def generate_delay(self, delay_config):
        if delay_config['distribution'] == 'constant':
            return delay_config['value']
        elif delay_config['distribution'] == 'uniform':
            return random.uniform(delay_config['min'], delay_config['max'])
        elif delay_config['distribution'] == 'exponential':
            return random.expovariate(1 / delay_config['mean'])
        else:
            raise ValueError(f"Unknown distribution: {delay_config['distribution']}")