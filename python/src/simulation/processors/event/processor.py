"""
Event step processor for handling event-based simulation steps.

This processor handles event steps that involve resource allocation,
duration processing, and event creation in the database.
"""

import logging
from datetime import timedelta
from typing import Any, Generator, Optional
from sqlalchemy import create_engine, insert, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from ..base import StepProcessor
from ..utils import extract_distribution_config, extract_distribution_config_with_time_unit
from ....distributions import generate_from_distribution
from ....generator.data.attribute_generator import generate_attribute_value
from ....utils.time_units import TimeUnitConverter
from ...utils.column_resolver import ColumnResolver

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

        # Initialize column resolver for strict column resolution
        db_config = getattr(entity_manager, 'db_config', None)
        if not db_config:
            raise ValueError("db_config is required for EventStepProcessor - cannot use hardcoded column names")
        self.column_resolver = ColumnResolver(db_config)

        # Store queue manager reference for queue-aware resource allocation
        self.queue_manager = queue_manager
    
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
                entity_table: str, event_table: str, event_tracker=None) -> Generator[Any, None, Optional[str]]:
        """
        Process an event step with resource allocation and duration.
        
        Args:
            entity_id: Entity ID
            step: Event step configuration
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
            
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
        
        # Create a process-specific engine for isolation
        process_engine = create_engine(
            f"sqlite:///{self.resource_manager.db_path}?journal_mode=WAL",
            poolclass=NullPool,
            connect_args={"check_same_thread": False}
        )
        
        try:
            with Session(process_engine) as session:
                # Create event in database
                event_id = self._create_event_for_step(
                    session, entity_id, step, entity_table, event_table
                )
                
                if event_id is None:
                    self.logger.error(f"Failed to create event for step {step.step_id}")
                    return None

                # Retrieve entity attributes for queue priority calculation (if needed)
                entity_attributes = self._get_entity_attributes(session, entity_table, entity_id)

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
                                    event_id, requirements_list, event_table,
                                    entity_id=entity_id,
                                    entity_table=entity_table,
                                    entity_attributes=entity_attributes,
                                    queue_manager=self.queue_manager
                                )
                            )
                        else:
                            # Standard resource allocation (backward compatible)
                            yield self.env.process(
                                self.resource_manager.allocate_resources(event_id, requirements_list, event_table)
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
                self._record_resource_allocations(event_id, start_time, end_time, event_table, active_event_tracker)
                
                # Increment events processed counter for termination tracking
                if self.simulator:
                    self.simulator.initializer.processed_events += 1
                
                # Record event processing
                self._record_event_processing(
                    process_engine, event_table, event_id, entity_id,
                    start_time, end_time, duration_minutes, active_event_tracker
                )
                
                # Release resources
                self.resource_manager.release_resources(event_id, event_table)
                
                self.logger.debug(
                    f"Processed event {event_id} (step {step.step_id}) for entity {entity_id} "
                    f"in {duration_minutes/60:.2f} hours"
                )
                
        except Exception as e:
            self.logger.error(f"Error processing event step {step.step_id}: {str(e)}", exc_info=True)
            return None
        finally:
            process_engine.dispose()
        
        # Determine next step
        next_step_id = step.next_steps[0] if step.next_steps else None
        self.log_step_end(entity_id, step, next_step_id)
        return next_step_id
    
    def _create_event_for_step(self, session, entity_id: int, step: 'Step', 
                              entity_table: str, event_table: str) -> Optional[int]:
        """
        Create an event record in the database for this step.
        
        Args:
            session: Database session
            entity_id: Entity ID
            step: Step configuration
            entity_table: Name of entity table
            event_table: Name of event table
            
        Returns:
            Created event ID or None if failed
        """
        try:
            # Find relationship column
            relationship_columns = self.entity_manager.find_relationship_columns(
                session, entity_table, event_table
            )
            if not relationship_columns:
                self.logger.error(f"No relationship column found between {entity_table} and {event_table}")
                return None
            
            relationship_column = relationship_columns[0]
            
            # Find event type column
            event_type_column = self.entity_manager.find_event_type_column(session, event_table)
            if not event_type_column:
                self.logger.error(f"Could not find event type column in {event_table}")
                return None
            
            # Get next event ID using resolved primary key column
            pk_column = self.column_resolver.get_primary_key(event_table)
            sql_query = text(f'SELECT MAX("{pk_column}") FROM "{event_table}"')
            result = session.execute(sql_query).fetchone()
            next_id = (result[0] or 0) + 1
            
            # Create event record
            row_data = {
                pk_column: next_id,
                relationship_column: entity_id,
                event_type_column: step.step_id
            }
            
            # Generate additional attributes if needed
            self._generate_event_attributes(session, row_data, event_table, next_id, 
                                          relationship_column, event_type_column)
            
            # Insert event record
            columns = ", ".join(row_data.keys())
            placeholders = ", ".join([f":{col}" for col in row_data.keys()])
            sql_query = text(f"INSERT INTO {event_table} ({columns}) VALUES ({placeholders})")
            
            session.execute(sql_query, row_data)
            session.commit()
            
            self.logger.debug(f"Created event {next_id} of type '{step.step_id}' for entity {entity_id}")
            return next_id
            
        except Exception as e:
            self.logger.error(f"Error creating event for step {step.step_id}: {str(e)}", exc_info=True)
            return None
    
    def _generate_event_attributes(self, session, row_data: dict, event_table: str, 
                                  event_id: int, relationship_column: str, event_type_column: str):
        """Generate additional attributes for the event record."""
        try:
            event_entity_config = self.entity_manager.get_entity_config(event_table)
            if not event_entity_config:
                return
            
            import dataclasses
            
            for attr in event_entity_config.attributes:
                # Skip already set attributes
                if (attr.is_primary_key or 
                    attr.name == relationship_column or 
                    attr.name == event_type_column or
                    attr.name in row_data):
                    continue
                
                # Skip foreign keys for now
                if attr.is_foreign_key:
                    continue
                
                if attr.generator:
                    # Skip simulation_event type generators
                    if attr.generator.type == 'simulation_event':
                        continue
                    
                    gen_dict = dataclasses.asdict(attr.generator)
                    attr_config_dict = {
                        'name': attr.name,
                        'generator': gen_dict
                    }
                    row_data[attr.name] = generate_attribute_value(attr_config_dict, event_id - 1)
                    
        except Exception as e:
            import traceback
            self.logger.warning(f"Error generating event attributes: {str(e)}")
            self.logger.debug(f"Full traceback:\n{traceback.format_exc()}")
    
    def _get_entity_attributes(self, session, entity_table: str, entity_id: int) -> dict:
        """
        Retrieve all attributes for an entity from the database.

        Args:
            session: Database session
            entity_table: Name of the entity table
            entity_id: Entity ID

        Returns:
            Dictionary of entity attributes
        """
        try:
            # Get primary key column name
            pk_column = self.column_resolver.get_primary_key(entity_table)

            # Query entity attributes
            sql_query = text(f'SELECT * FROM "{entity_table}" WHERE "{pk_column}" = :entity_id')
            result = session.execute(sql_query, {'entity_id': entity_id}).fetchone()

            if result:
                return dict(result._mapping)
            else:
                self.logger.warning(f"Entity {entity_id} not found in table {entity_table}")
                return {}
        except Exception as e:
            self.logger.error(f"Error retrieving entity attributes: {e}")
            return {}

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
    
    def _record_event_processing(self, engine, event_table: str, event_id: int, 
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
            
            # Record in event tracker if available
            if active_event_tracker:
                with engine.connect() as conn:
                    stmt = insert(active_event_tracker.event_processing).values(
                        event_table=event_table,
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
    
    def _record_resource_allocations(self, event_id: int, start_time: float, end_time: float, event_table: str, event_tracker=None):
        """Record resource allocations in the event tracker."""
        try:
            active_event_tracker = event_tracker or self.event_tracker
            # Use composite key to handle ID collisions between event tables
            allocation_key = f"{event_table}_{event_id}" if event_table else str(event_id)
            if active_event_tracker and allocation_key in self.resource_manager.event_allocations:
                allocated_resources = self.resource_manager.event_allocations[allocation_key]
                for resource in allocated_resources:
                    # Record in the event tracker
                    active_event_tracker.record_resource_allocation(
                        event_id=event_id,
                        resource_table=resource.table,
                        resource_id=resource.id,
                        allocation_time=start_time,
                        release_time=end_time
                    )
                self.logger.debug(f"Recorded {len(allocated_resources)} resource allocations for event {event_id}")
        except Exception as e:
            self.logger.warning(f"Error recording resource allocations for event {event_id}: {str(e)}")
