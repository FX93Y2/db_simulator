import logging
import os
from queue import PriorityQueue
from datetime import datetime, timedelta
from .event import Event
from .handlers import event_handlers
from ..config_parser.parser import parse_config
from ..data_generator.entity_generator import generate_initial_entities
from ..database.db_manager import DatabaseManager
from ..utils.distributions import get_distribution

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimulationEngine:
    def __init__(self, config_path):
        self.config = parse_config(config_path)
        self.entities = {}
        self.event_queue = PriorityQueue()
        self.start_time = datetime.strptime(self.config['simulation_parameters']['start_date'], "%Y-%m-%d %H:%M:%S")
        self.end_time = datetime.strptime(self.config['simulation_parameters']['end_date'], "%Y-%m-%d %H:%M:%S")
        self.current_time = self.start_time
        config_file_name = os.path.basename(config_path)
        self.db_manager = DatabaseManager(self.config, config_file_name)
        self.time_unit = self.config['simulation_parameters'].get('time_unit', 'day')

    def run(self):
        self.initialize()
        while not self.event_queue.empty() and self.current_time < self.end_time:
            event = self.event_queue.get()
            self.current_time = event.time
            self.handle_event(event)
        self.db_manager.close()
        logger.info("Simulation completed")

    def initialize(self):
        self.entities = generate_initial_entities(self.config)
        for entity_type, entities in self.entities.items():
            self.db_manager.bulk_insert(entity_type, entities)
        
        # Schedule initial events
        if 'events' in self.config:
            for event_config in self.config['events']:
                if event_config['type'] == 'Assign':
                    for entity_id, entity_data in self.entities[event_config['entity']].items():
                        delay = self.generate_delay(event_config.get('delay', {'distribution': 'constant', 'value': 0}))
                        event_time = entity_data.get('CreatedAt', self.start_time) + timedelta(days=delay)
                        if event_time < self.end_time:
                            self.schedule_event(event_config['name'], event_config['entity'], entity_id, event_time)



    def handle_event(self, event):
        logger.info(f"Handling event: {event}")
        handler = event_handlers.get(event.type)
        if handler:
            entity_id = handler(self, event)
            self.schedule_follow_up_events(event, entity_id)
        else:
            logger.warning(f"No handler found for event type: {event.type}")

    def schedule_follow_up_events(self, event, entity_id):
        event_config = next((e for e in self.config['events'] if e['name'] == event.name), None)
        if event_config and 'follow_up' in event_config:
            for follow_up in event_config['follow_up']:
                delay_config = follow_up.get('delay', {'type': 'constant', 'value': 0})
                delay = self.generate_delay(delay_config)
                params = self.get_event_params(follow_up['event'])
                self.schedule_event(follow_up['event'], event.entity_type, entity_id, delay, params)

    def get_event_params(self, event_name):
        event_config = next((e for e in self.config['events'] if e['name'] == event_name), None)
        if event_config and 'params' in event_config:
            params = event_config['params'].copy()
            if 'assign_to' in params and isinstance(params['assign_to'], dict):
                distribution = get_distribution(params['assign_to'])
                params['assign_to'] = int(distribution())
            return params
        return {}

    def schedule_event(self, event_name, entity_type, entity_id, event_time, params=None):
        event_config = next((e for e in self.config['events'] if e['name'] == event_name), None)
        if event_config:
            event_params = event_config.get('params', {}).copy()
            if params:
                event_params.update(params)
            event = Event(event_config['type'], entity_type, entity_id, event_time, event_name, event_params)
            self.event_queue.put(event)
            logger.info(f"Scheduled event: {event}")
        else:
            logger.warning(f"No configuration found for event: {event_name}")

    def generate_delay(self, delay_config):
        if isinstance(delay_config, (int, float)):
            return delay_config
        distribution = get_distribution(delay_config)
        return distribution()

    def get_timedelta(self, value):
        if self.time_unit == 'day':
            return datetime.timedelta(days=value)
        elif self.time_unit == 'week':
            return datetime.timedelta(weeks=value)
        elif self.time_unit == 'month':
            return datetime.timedelta(days=value * 30)  # Approximation
        else:
            raise ValueError(f"Currently only support day, week and month")