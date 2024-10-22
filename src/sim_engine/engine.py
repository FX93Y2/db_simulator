import logging
import os
from queue import PriorityQueue
from datetime import datetime, timedelta
from .event import Event
from .handlers import event_handlers
from ..config_parser.parser import parse_config
from ..data_generator.entity_generator import generate_initial_entities, EntityGenerator
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
        self.time_unit = self.config['simulation_parameters'].get('time_unit', 'day')
        
        config_file_name = os.path.basename(config_path)
        self.db_manager = DatabaseManager(self.config, config_file_name)
        
        # Initialize entity generator and distributions
        self.entity_generator = EntityGenerator(self.config)
        self.distributions = {}
        self._initialize_distributions()

    def _initialize_distributions(self):
        """Initialize all distributions used in the simulation"""
        if 'events' in self.config:
            for event_config in self.config['events']:
                if 'params' in event_config and 'assign_to' in event_config['params']:
                    self.distributions[f"{event_config['name']}_assign"] = get_distribution(
                        event_config['params']['assign_to']
                    )

    def initialize(self):
        """Initialize entities and schedule initial events"""
        # Generate and store initial entities
        self.entities = generate_initial_entities(self.config)
        
        # Bulk insert entities into database
        for entity_type, entities in self.entities.items():
            self.db_manager.bulk_insert(entity_type, entities)
        
        # Schedule initial events with proper timing
        self._schedule_initial_events()

    def _schedule_initial_events(self):
        """Schedule all initial events based on configuration"""
        if 'events' in self.config:
            for event_config in self.config['events']:
                if event_config['type'] == 'Assign':
                    self._schedule_assignment_events(event_config)

    def _schedule_assignment_events(self, event_config):
        """Schedule assignment events with proper timing distribution"""
        entity_type = event_config['entity']
        distribution = self.distributions.get(f"{event_config['name']}_assign")
        
        if not distribution:
            logger.error(f"No distribution found for {event_config['name']}")
            return

        total_simulation_days = (self.end_time - self.start_time).days
        
        for entity_id, entity_data in self.entities[entity_type].items():
            if entity_data.get(event_config['params']['relationship']) is None:
                # Calculate event time using the distribution
                days_offset = distribution() % total_simulation_days
                event_time = self.start_time + timedelta(days=days_offset)
                
                if event_time < self.end_time:
                    # Generate assignment target using same distribution
                    assign_to = max(1, min(10, int(distribution())))
                    
                    params = {
                        'relationship': event_config['params']['relationship'],
                        'assign_to': assign_to
                    }
                    
                    self.schedule_event(
                        event_config['name'],
                        entity_type,
                        entity_id,
                        event_time,
                        params
                    )

    def run(self):
        """Run the simulation"""
        try:
            self.initialize()
            
            while not self.event_queue.empty() and self.current_time < self.end_time:
                event = self.event_queue.get()
                self.current_time = event.time
                self.handle_event(event)
                
            logger.info("Simulation completed successfully")
        except Exception as e:
            logger.error(f"Simulation failed: {str(e)}")
            raise
        finally:
            self.db_manager.close()

    def handle_event(self, event):
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

    def _process_follow_up_events(self, event, entity_id):
        """Process any follow-up events"""
        event_config = next((e for e in self.config['events'] if e['name'] == event.name), None)
        
        if event_config and 'follow_up' in event_config:
            for follow_up in event_config['follow_up']:
                distribution = self.distributions.get(f"{follow_up['event']}_assign")
                if distribution:
                    delay = distribution()
                    event_time = self.current_time + self.get_timedelta(delay)
                    
                    if event_time < self.end_time:
                        self.schedule_event(
                            follow_up['event'],
                            event.entity_type,
                            entity_id,
                            event_time,
                            self._generate_event_params(follow_up['event'])
                        )

    def _generate_event_params(self, event_name):
        """Generate parameters for an event"""
        event_config = next((e for e in self.config['events'] if e['name'] == event_name), None)
        if not event_config or 'params' not in event_config:
            return {}

        params = event_config['params'].copy()
        if 'assign_to' in params:
            distribution = self.distributions.get(f"{event_name}_assign")
            if distribution:
                params['assign_to'] = int(distribution())

        return params

    def schedule_event(self, event_name, entity_type, entity_id, event_time, params=None):
        """Schedule a new event"""
        event_config = next((e for e in self.config['events'] if e['name'] == event_name), None)
        if not event_config:
            logger.warning(f"No configuration found for event: {event_name}")
            return

        event = Event(event_config['type'], entity_type, entity_id, event_time, event_name, params or {})
        self.event_queue.put(event)
        logger.debug(f"Scheduled event: {event}")

    def get_timedelta(self, value):
        """Convert a value to timedelta based on the configured time unit"""
        if self.time_unit == 'day':
            return timedelta(days=value)
        elif self.time_unit == 'week':
            return timedelta(weeks=value)
        elif self.time_unit == 'month':
            return timedelta(days=value * 30)
        else:
            raise ValueError(f"Unsupported time unit: {self.time_unit}")