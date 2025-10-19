"""
Queue management for discrete event simulation.

Implements Arena-style queue disciplines:
- FIFO (First In First Out)
- LIFO (Last In First Out / Stack)
- LowAttribute (Priority queue - lower attribute values first)
- HighAttribute (Priority queue - higher attribute values first)
"""

import logging
import simpy
from typing import Dict, Optional, Any, List
from dataclasses import dataclass
from collections import deque

logger = logging.getLogger(__name__)


@dataclass
class QueueEntry:
    """Wrapper for entities in queues with priority support"""
    entity_id: int
    entity_table: str
    entity_attributes: Dict[str, Any]
    entry_time: float  # Simulation time when entity entered queue
    priority: float = 0.0  # Priority for sorting (used by PriorityStore)


class QueueManager:
    """
    Manages queues for resource allocation points.

    Implements 4 Arena-style queue disciplines:
    - FIFO: Standard first-come-first-served
    - LIFO: Stack-based (last in first out)
    - LowAttribute: Priority queue where lower attribute values get higher priority
    - HighAttribute: Priority queue where higher attribute values get higher priority
    """

    def __init__(self, env: simpy.Environment, queue_definitions: List, db_config=None):
        """
        Initialize the queue manager.

        Args:
            env: SimPy environment
            queue_definitions: List of QueueDefinition objects from configuration
            db_config: Optional database configuration for validation
        """
        self.env = env
        self.db_config = db_config
        self.queues = {}  # queue_name -> queue object (deque, list, or PriorityStore)
        self.queue_configs = {}  # queue_name -> QueueDefinition
        self.queue_stats = {}  # queue_name -> statistics dict

        # Create queues from definitions
        for queue_def in queue_definitions:
            self._create_queue(queue_def)

        logger.info(f"QueueManager initialized with {len(self.queues)} queues")

    def _create_queue(self, queue_def):
        """
        Create a queue based on its type.

        Args:
            queue_def: QueueDefinition object
        """
        queue_name = queue_def.name
        queue_type = queue_def.type

        logger.info(f"Creating queue '{queue_name}' with type '{queue_type}'")

        if queue_type == 'FIFO':
            # Standard FIFO queue using Python deque (efficient for both ends)
            self.queues[queue_name] = deque()
        elif queue_type == 'LIFO':
            # LIFO queue (stack) using Python list
            self.queues[queue_name] = []
        elif queue_type in ['LowAttribute', 'HighAttribute']:
            # Priority queue using SimPy PriorityStore
            # Note: PriorityStore orders by lowest value first, so we'll negate for HighAttribute
            self.queues[queue_name] = simpy.PriorityStore(self.env)
        else:
            logger.error(f"Unknown queue type '{queue_type}', defaulting to FIFO")
            self.queues[queue_name] = deque()

        self.queue_configs[queue_name] = queue_def
        self.queue_stats[queue_name] = {
            'total_entries': 0,
            'total_exits': 0,
            'total_wait_time': 0.0,
            'max_wait_time': 0.0,
            'max_length': 0,
            'wait_times': []  # Track all wait times for detailed statistics
        }

    def get_queue_length(self, queue_name: str) -> int:
        """
        Get current number of entities waiting in queue.

        Args:
            queue_name: Name of the queue

        Returns:
            Current queue length
        """
        if queue_name not in self.queues:
            return 0

        queue = self.queues[queue_name]
        queue_type = self.queue_configs[queue_name].type

        if queue_type in ['FIFO', 'LIFO']:
            return len(queue)
        elif queue_type in ['LowAttribute', 'HighAttribute']:
            return len(queue.items)
        return 0

    def enqueue(self, queue_name: str, entity_id: int, entity_table: str,
                entity_attributes: Dict[str, Any]):
        """
        Add an entity to the queue.

        Args:
            queue_name: Name of the queue
            entity_id: Entity's ID
            entity_table: Table where entity is stored
            entity_attributes: Dict of entity attributes (for priority calculation)
        """
        if queue_name not in self.queues:
            logger.warning(f"Queue '{queue_name}' not found - entity {entity_id} will use implicit queueing")
            return

        entry = QueueEntry(
            entity_id=entity_id,
            entity_table=entity_table,
            entity_attributes=entity_attributes,
            entry_time=self.env.now
        )

        queue_def = self.queue_configs[queue_name]
        queue = self.queues[queue_name]

        if queue_def.type == 'FIFO':
            queue.append(entry)
        elif queue_def.type == 'LIFO':
            queue.append(entry)
        elif queue_def.type == 'LowAttribute':
            # Lower attribute value = higher priority (processed first)
            attr_value = entity_attributes.get(queue_def.attribute, float('inf'))
            entry.priority = float(attr_value)
            queue.put((entry.priority, entry))
        elif queue_def.type == 'HighAttribute':
            # Higher attribute value = higher priority (processed first)
            # Negate value so SimPy's PriorityStore (which uses min-heap) works correctly
            attr_value = entity_attributes.get(queue_def.attribute, 0)
            entry.priority = -float(attr_value)  # Negate for max-heap behavior
            queue.put((entry.priority, entry))

        # Update statistics
        stats = self.queue_stats[queue_name]
        stats['total_entries'] += 1
        current_length = self.get_queue_length(queue_name)
        stats['max_length'] = max(stats['max_length'], current_length)

        logger.debug(
            f"Entity {entity_id} entered queue '{queue_name}' "
            f"(length: {current_length}, priority: {entry.priority if queue_def.type in ['LowAttribute', 'HighAttribute'] else 'N/A'})"
        )

    def dequeue(self, queue_name: str) -> Optional[QueueEntry]:
        """
        Remove and return the next entity from the queue based on queue discipline.

        Args:
            queue_name: Name of the queue

        Returns:
            QueueEntry object or None if queue is empty or doesn't exist
        """
        if queue_name not in self.queues:
            logger.warning(f"Queue '{queue_name}' not found for dequeue operation")
            return None

        queue_def = self.queue_configs[queue_name]
        queue = self.queues[queue_name]
        entry = None

        try:
            if queue_def.type == 'FIFO':
                if queue:
                    entry = queue.popleft()  # Remove from front
            elif queue_def.type == 'LIFO':
                if queue:
                    entry = queue.pop()  # Remove from back (stack)
            elif queue_def.type in ['LowAttribute', 'HighAttribute']:
                if queue.items:
                    # PriorityStore returns (priority, entry) tuple
                    priority, entry = queue.items[0]  # Peek at highest priority
                    queue.get()  # Actually remove it (must be called to update queue)
        except Exception as e:
            logger.error(f"Error dequeuing from '{queue_name}': {e}")
            return None

        if entry:
            # Calculate wait time and update statistics
            wait_time = self.env.now - entry.entry_time
            stats = self.queue_stats[queue_name]
            stats['total_exits'] += 1
            stats['total_wait_time'] += wait_time
            stats['max_wait_time'] = max(stats['max_wait_time'], wait_time)
            stats['wait_times'].append(wait_time)

            logger.debug(
                f"Entity {entry.entity_id} exited queue '{queue_name}' "
                f"(wait time: {wait_time:.2f} {self.env.now.__class__.__name__})"
            )

        return entry

    def peek(self, queue_name: str) -> Optional[QueueEntry]:
        """
        Look at the next entity in queue without removing it.

        Args:
            queue_name: Name of the queue

        Returns:
            QueueEntry object or None if queue is empty
        """
        if queue_name not in self.queues:
            return None

        queue_def = self.queue_configs[queue_name]
        queue = self.queues[queue_name]

        if queue_def.type == 'FIFO':
            return queue[0] if queue else None
        elif queue_def.type == 'LIFO':
            return queue[-1] if queue else None
        elif queue_def.type in ['LowAttribute', 'HighAttribute']:
            if queue.items:
                _, entry = queue.items[0]
                return entry
        return None

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get comprehensive queue statistics for all queues.

        Returns:
            Dict mapping queue names to their statistics
        """
        summary = {}
        for queue_name, stats in self.queue_stats.items():
            avg_wait = (stats['total_wait_time'] / stats['total_exits']
                       if stats['total_exits'] > 0 else 0)

            summary[queue_name] = {
                'queue_type': self.queue_configs[queue_name].type,
                'total_processed': stats['total_exits'],
                'current_length': self.get_queue_length(queue_name),
                'max_length': stats['max_length'],
                'avg_wait_time': round(avg_wait, 2),
                'max_wait_time': round(stats['max_wait_time'], 2),
                'total_wait_time': round(stats['total_wait_time'], 2)
            }

        return summary

    def get_detailed_statistics(self, queue_name: str) -> Dict[str, Any]:
        """
        Get detailed statistics for a specific queue including wait time distribution.

        Args:
            queue_name: Name of the queue

        Returns:
            Detailed statistics dict
        """
        if queue_name not in self.queue_stats:
            return {}

        stats = self.queue_stats[queue_name]
        wait_times = stats['wait_times']

        if not wait_times:
            return {
                'queue_name': queue_name,
                'queue_type': self.queue_configs[queue_name].type,
                'no_data': True
            }

        # Calculate percentiles
        sorted_waits = sorted(wait_times)
        n = len(sorted_waits)

        return {
            'queue_name': queue_name,
            'queue_type': self.queue_configs[queue_name].type,
            'total_processed': stats['total_exits'],
            'avg_wait_time': round(sum(wait_times) / n, 2),
            'min_wait_time': round(min(wait_times), 2),
            'max_wait_time': round(max(wait_times), 2),
            'median_wait_time': round(sorted_waits[n // 2], 2),
            'p90_wait_time': round(sorted_waits[int(n * 0.9)], 2) if n > 10 else round(max(wait_times), 2),
            'p95_wait_time': round(sorted_waits[int(n * 0.95)], 2) if n > 20 else round(max(wait_times), 2),
            'max_queue_length': stats['max_length']
        }
