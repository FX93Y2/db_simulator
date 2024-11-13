from enum import Enum
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime, timedelta

class DependencyType(Enum):
    START_TO_START = "start_after_start"
    START_TO_FINISH = "start_to_finish"
    FINISH_TO_START = "finish_to_start"
    FINISH_TO_FINISH = "finish_to_finish"

class ProcessFlow:
    def __init__(self, config: Dict):
        self.events = {}
        self.dependencies = {}
        self._build_process_network(config['events'])

    def _build_process_network(self, events: List[Dict]):
        """Build the network of process dependencies"""
        for event in events:
            self.events[event['name']] = {
                'config': event,
                'predecessors': set(),
                'successors': set()
            }
            
            # Add explicit dependencies
            if 'dependencies' in event['process_config']:
                for dep in event['process_config']['dependencies']:
                    self.dependencies[(dep['event'], event['name'])] = {
                        'type': DependencyType(dep['type']),
                        'delay': dep.get('delay', 0)
                    }
                    self.events[event['name']]['predecessors'].add(dep['event'])
                    self.events[dep['event']]['successors'].add(event['name'])

            # Add next events as dependencies
            if 'next_events' in event['process_config']:
                for next_event in event['process_config']['next_events']:
                    self.events[event['name']]['successors'].add(next_event['event'])
                    self.events[next_event['event']]['predecessors'].add(event['name'])

    def get_ready_events(self, entity_id: int, completed_events: Set[str]) -> List[str]:
        """Get events that are ready to start based on dependencies"""
        ready_events = []
        
        for event_name, event_info in self.events.items():
            if event_name in completed_events:
                continue
                
            # Check if all dependencies are satisfied
            dependencies_met = True
            for pred in event_info['predecessors']:
                dep_type = self.dependencies.get((pred, event_name), {}).get('type')
                
                if dep_type == DependencyType.FINISH_TO_START:
                    if pred not in completed_events:
                        dependencies_met = False
                        break
                        
            if dependencies_met:
                ready_events.append(event_name)
                
        return ready_events 