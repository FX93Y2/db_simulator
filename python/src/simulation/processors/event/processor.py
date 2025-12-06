"""
Event step processor for handling event-based simulation steps.

This processor handles event steps that involve resource allocation,
duration processing, and event creation in the database.
"""

import logging
from datetime import timedelta
from typing import Any, Generator, Optional
from sqlalchemy import create_engine, insert
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from ..base import StepProcessor
from ..utils import extract_distribution_config, extract_distribution_config_with_time_unit
from ....distributions import generate_from_distribution
from ....utils.time_units import TimeUnitConverter

logger = logging.getLogger(__name__)


class EventStepProcessor(StepProcessor):
    """
    Processor for event-type steps in the simulation flow.

    Handles resource allocation, event duration, database event creation,
    and resource release upon completion.
    """

    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config, simulator=None, queue_manager=None):
        """Initialize EventStepProcessor with ColumnResolver and QueueManager support."""
        super().__init__(env, engine, resource_manager, entity_manager, event_tracker, config, simulator)

        # Store queue manager reference for queue-aware resource allocation
        self.queue_manager = queue_manager
        # Synthetic ID generator for runs without an event table
        self.synthetic_event_counter = 0
    
    def can_handle(self, step_type: str) -> bool:
        """Check if this processor can handle event steps."""
        return step_type == "event"
    
    def validate_step(self, step: 'Step') -> bool:
        """Validate that the step has proper event configuration."""
        if not super().validate_step(step):
            return False
        return (step.step_type == "event" and 
                step.event_config is not None)
    
    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                entity_table: str, event_flow: str, event_tracker=None) -> Generator[Any, None, Optional[str]]:
        """
        Process an event step with resource allocation and duration.
        
        Args:
            entity_id: Entity ID
            step: Event step configuration
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_flow: Identifier/label of the event flow
            
        Yields:
            SimPy events during processing
            
        Returns:
            Next step ID from the step configuration
        """
        # Use provided event_tracker or fall back to default
        active_event_tracker = event_tracker or self.event_tracker
        
        if not self.validate_step(step):
            self.logger.error(f"Invalid event step configuration for step {step.step_id}")
            return None
        
        self.log_step_start(entity_id, step)
        
        event_config = step.event_config
        event_flow_label = event_flow or getattr(flow, 'event_flow', None) or getattr(flow, 'flow_id', None)
        
        # Create a process-specific engine for isolation
        process_engine = create_engine(
            f"sqlite:///{self.resource_manager.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        session = None
        try:
            session = Session(process_engine)
            # Create event in database (or synthetic placeholder when event table is absent)
            event_id = self._create_event_for_step(
                session, entity_id, step, entity_table, event_flow_label
            )
            
            if event_id is None:
                self.logger.warning(
                    f"Falling back to synthetic event id for step {step.step_id} (entity {entity_id})"
                )
                event_id = self._next_synthetic_event_id(step)

            # Retrieve entity attributes for queue priority calculation (if needed)
            entity_attributes = {}
            session.close()
            session = None

            # Allocate resources if required
            if event_config.resource_requirements:
                requirements_list = self._convert_resource_requirements(
                    event_config.resource_requirements
                )

                try:
                    # Check if any requirement uses a queue
                    uses_queue = any(req.get('queue') for req in requirements_list)

                    if uses_queue and self.queue_manager:
                        # Queue-aware resource allocation
                        yield self.env.process(
                            self.resource_manager.allocate_resources(
                                event_id, requirements_list, event_flow_label,
                                entity_id=entity_id,
                                entity_table=entity_table,
                                entity_attributes=entity_attributes,
                                queue_manager=self.queue_manager
                            )
                        )
                    else:
                        # Standard resource allocation (backward compatible)
                        yield self.env.process(
                            self.resource_manager.allocate_resources(event_id, requirements_list, event_flow_label)
                        )

                    self.logger.debug(f"Resources allocated for event {event_id}")
                except Exception as e:
                    self.logger.warning(f"Resource allocation failed for event {event_id}: {e}")
                    return None
            
            # Process event duration
            duration_minutes = self._calculate_event_duration(event_config)
            start_time = self.env.now
            
            # Wait for the event duration
            yield self.env.timeout(duration_minutes)
            
            end_time = self.env.now
            
            # Record resource allocations in the tracker
            self._record_resource_allocations(
                event_id,
                start_time,
                end_time,
                event_flow_label,
                active_event_tracker,
                entity_id=entity_id,
                event_type=step.step_id
            )
            
            # Increment events processed counter for termination tracking
            if self.simulator:
                self.simulator.initializer.processed_events += 1
            
            # Record event processing
            self._record_event_processing(
                process_engine, event_flow_label, event_id, entity_id,
                start_time, end_time, duration_minutes, active_event_tracker
            )
                
            # Release resources
            self.resource_manager.release_resources(event_id, event_flow_label)
            
            self.logger.debug(
                f"Processed event {event_id} (step {step.step_id}) for entity {entity_id} "
                f"in {duration_minutes/60:.2f} hours"
            )
            
        except Exception as e:
            self.logger.error(f"Error processing event step {step.step_id}: {str(e)}", exc_info=True)
            return None
        finally:
            if session:
                session.close()
            process_engine.dispose()
        
        # Determine next step
        next_step_id = step.next_steps[0] if step.next_steps else None
        self.log_step_end(entity_id, step, next_step_id)
        return next_step_id
    
    def _create_event_for_step(self, session, entity_id: int, step: 'Step', 
                              entity_table: str, event_flow: Optional[str]) -> Optional[int]:
        """
        Create an event record in the database for this step.
        
        Args:
            session: Database session
            entity_id: Entity ID
            step: Step configuration
            entity_table: Name of entity table
            event_flow: Label of event flow
            
        Returns:
            Created event ID or None if failed
        """
        synthetic_id = self._next_synthetic_event_id(step)
        self.logger.debug(
            f"Using synthetic event id {synthetic_id} for step {step.step_id} (flow={event_flow})"
        )
        return synthetic_id

    def _convert_resource_requirements(self, requirements) -> list:
        """Convert resource requirements to the format expected by resource manager."""
        requirements_list = []
        for req in requirements:
            req_dict = {
                'resource_table': req.resource_table,
                'value': req.value,
                'count': req.count
            }
            # Include queue reference if specified
            if hasattr(req, 'queue') and req.queue:
                req_dict['queue'] = req.queue
            requirements_list.append(req_dict)
        return requirements_list
    
    def _calculate_event_duration(self, event_config) -> float:
        """Calculate event duration in minutes from configuration."""
        try:
            # Extract the actual distribution config and time unit from duration field
            dist_config, time_unit = extract_distribution_config_with_time_unit(event_config.duration)
            duration_value = generate_from_distribution(dist_config)
            # Use specified time_unit or fall back to base_time_unit
            time_unit_to_use = time_unit if time_unit is not None else self.config.base_time_unit
            return TimeUnitConverter.to_minutes(duration_value, time_unit_to_use)
        except Exception as e:
            self.logger.warning(f"Error calculating event duration: {str(e)}, using default")
            return 60.0  # Default 1 hour
    
    def _record_event_processing(self, engine, event_flow: Optional[str], event_id: int, 
                                entity_id: int, start_time: float, end_time: float, 
                                duration_minutes: float, event_tracker=None):
        """Record event processing in the event tracker."""
        try:
            # Use provided event_tracker or fall back to default
            active_event_tracker = event_tracker or self.event_tracker
            # Calculate datetime values
            start_datetime = None
            end_datetime = None
            
            # Try to get start_date from config if available
            if self.config and hasattr(self.config, 'start_date') and self.config.start_date:
                start_datetime = self.config.start_date + timedelta(minutes=start_time)
                end_datetime = self.config.start_date + timedelta(minutes=end_time)
            
            event_flow_label = self._get_event_flow_label(event_flow)

            # Record in event tracker if available
            if active_event_tracker:
                with engine.connect() as conn:
                    stmt = insert(active_event_tracker.event_processing).values(
                        event_flow=event_flow_label,
                        event_id=event_id,
                        entity_id=entity_id,
                        start_time=start_time,
                        end_time=end_time,
                        duration=duration_minutes,
                        start_datetime=start_datetime,
                        end_datetime=end_datetime
                    )
                    conn.execute(stmt)
                    conn.commit()
                    
        except Exception as e:
            self.logger.warning(f"Error recording event processing: {str(e)}")
    
    def _record_resource_allocations(self, event_id: int, start_time: float, end_time: float, event_flow: str,
                                     event_tracker=None, entity_id: Optional[int] = None, event_type: Optional[str] = None):
        """Record resource allocations in the event tracker."""
        try:
            active_event_tracker = event_tracker or self.event_tracker
            # Use composite key to handle ID collisions between event tables
            allocation_key = f"{event_flow}_{event_id}" if event_flow else str(event_id)
            if active_event_tracker and allocation_key in self.resource_manager.event_allocations:
                allocated_resources = self.resource_manager.event_allocations[allocation_key]
                for resource in allocated_resources:
                    # Record in the event tracker
                    active_event_tracker.record_resource_allocation(
                        event_flow=event_flow or self._get_event_flow_label(None),
                        event_id=event_id,
                        resource_table=resource.table,
                        resource_id=resource.id,
                        allocation_time=start_time,
                        release_time=end_time,
                        entity_id=entity_id,
                        event_type=event_type
                    )
                self.logger.debug(f"Recorded {len(allocated_resources)} resource allocations for event {event_id}")
        except Exception as e:
            self.logger.warning(f"Error recording resource allocations for event {event_id}: {str(e)}")

    def _next_synthetic_event_id(self, step: 'Step') -> int:
        """Generate a synthetic event ID when no event table is available."""
        self.synthetic_event_counter += 1
        return self.synthetic_event_counter

    def _get_event_flow_label(self, event_flow: Optional[str]) -> str:
        """Provide a non-empty label for logging when no event flow is provided."""
        if event_flow:
            return event_flow
        try:
            fallback_entity_table = self.entity_manager.get_table_by_type('entity')
            return fallback_entity_table or 'event'
        except Exception:
            return 'event'
