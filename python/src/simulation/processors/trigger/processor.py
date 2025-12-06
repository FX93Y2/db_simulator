"""
Trigger step processor for generating related table data during simulation.

This processor handles trigger steps that leverage existing database generators
to create records in related tables with foreign key relationships to entities.
"""

import logging
import numbers
from datetime import timedelta
from typing import Any, Generator, Optional, TYPE_CHECKING, Dict, List
from sqlalchemy import text, inspect

from ..base import StepProcessor

if TYPE_CHECKING:
    from ....config_parser.sim_parser import Step, EventFlow, TriggerConfig
    from ....config_parser.db_parser import DatabaseConfig, Entity

logger = logging.getLogger(__name__)


class TriggerStepProcessor(StepProcessor):
    """
    Processor for trigger-type steps in the simulation flow.

    Handles generation of related table data using database config generators.
    """

    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config, simulator=None):
        """
        Initialize the trigger step processor.

        Args:
            env: SimPy environment
            engine: SQLAlchemy engine
            resource_manager: Resource manager instance
            entity_manager: Entity manager instance
            event_tracker: Event tracker instance
            config: Simulation configuration
            simulator: Reference to the main simulator (for termination checking)
        """
        super().__init__(env, engine, resource_manager, entity_manager, event_tracker, config, simulator)

        # Database config will be set by the factory
        self.db_config: Optional['DatabaseConfig'] = None

    def set_db_config(self, db_config: 'DatabaseConfig'):
        """
        Set the database configuration for accessing generators.

        Args:
            db_config: Database configuration instance
        """
        self.db_config = db_config
        self.logger.debug("Database config set for trigger processor")

    def can_handle(self, step_type: str) -> bool:
        """Check if this processor can handle trigger steps."""
        return step_type.lower() == "trigger"

    def validate_step(self, step: 'Step') -> bool:
        """
        Validate that the step has proper trigger configuration.

        Args:
            step: Step configuration to validate

        Returns:
            True if step is valid, False otherwise
        """
        if not super().validate_step(step):
            return False

        if step.step_type.lower() != "trigger":
            self.logger.error(f"Invalid step type for TriggerStepProcessor: {step.step_type}")
            return False

        if step.trigger_config is None:
            self.logger.error(f"Trigger step {step.step_id} missing trigger_config")
            return False

        trigger_config: 'TriggerConfig' = step.trigger_config

        # Validate target table exists
        if not trigger_config.target_table:
            self.logger.error(f"Trigger step {step.step_id} missing target_table")
            return False

        # Validate count is provided
        if trigger_config.count is None:
            self.logger.error(f"Trigger step {step.step_id} missing count")
            return False

        # Validate target table has generators defined in db_config
        if self.db_config:
            target_entity = next(
                (e for e in self.db_config.entities if e.name == trigger_config.target_table),
                None
            )

            if not target_entity:
                self.logger.error(f"Target table '{trigger_config.target_table}' not found in database config")
                return False

            # Check if target table has generators defined
            has_generators = any(attr.generator for attr in target_entity.attributes)
            if not has_generators:
                self.logger.error(f"Target table '{trigger_config.target_table}' has no generators defined")
                return False

        return True

    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow',
                entity_table: str, event_flow: str, event_tracker=None) -> Generator[Any, None, Optional[str]]:
        """
        Process a trigger step and generate related table data.

        Args:
            entity_id: Entity ID
            step: Trigger step configuration
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_flow: Identifier/label of the event flow

        Yields:
            No SimPy events (trigger is instantaneous)

        Returns:
            Next step ID from next_steps list, or None if flow ends
        """
        if not self.validate_step(step):
            self.logger.error(f"Invalid trigger step configuration for step {step.step_id}")
            return None

        if not self.db_config:
            self.logger.error(f"No database config available for trigger step {step.step_id}")
            return None

        self.log_step_start(entity_id, step)

        trigger_config: 'TriggerConfig' = step.trigger_config

        try:
            # Resolve count (handle both int and distribution formulas)
            count = self._resolve_count(trigger_config.count)
            self.logger.debug(f"Trigger step {step.step_id}: generating {count} records for {trigger_config.target_table}")

            target_entity = self._get_target_entity(trigger_config.target_table)

            # Detect FK column
            fk_column = self._detect_fk_column(trigger_config, entity_table, target_entity)
            if not fk_column:
                self.logger.error(f"Could not determine FK column for trigger step {step.step_id}")
                return None

            # Resolve timestamp columns and values
            timestamp_column, sim_time_column, event_timestamp, sim_minutes = self._resolve_timestamp_fields(
                trigger_config, target_entity, step.step_id
            )

            # Generate records
            generated_ids = self._generate_records(
                target_table=trigger_config.target_table,
                count=count,
                entity_id=entity_id,
                fk_column=fk_column,
                timestamp_column=timestamp_column,
                sim_time_column=sim_time_column,
                event_timestamp=event_timestamp,
                sim_minutes=sim_minutes
            )

            self.logger.info(
                f"Trigger step {step.step_id}: generated {len(generated_ids)} {trigger_config.target_table} "
                f"records for entity {entity_id}"
            )

        except Exception as e:
            self.logger.error(f"Error in trigger step {step.step_id}: {str(e)}", exc_info=True)
            return None

        # Determine next step
        next_step_id = self._determine_next_step(step)

        self.log_step_end(entity_id, step, next_step_id)

        # Trigger processing is instantaneous - yield and return
        yield self.env.timeout(0)
        return next_step_id

    def _resolve_count(self, count: Any) -> int:
        """
        Resolve count to an integer value.

        Args:
            count: Count value (int or distribution formula string)

        Returns:
            Integer count value
        """
        resolved_value: Optional[float] = None

        # Accept direct numeric types
        if isinstance(count, numbers.Number):
            resolved_value = float(count)

        elif isinstance(count, str):
            stripped = count.strip()
            if not stripped:
                raise ValueError("Trigger count cannot be empty")

            # Try integer first to preserve whole-number strings ("3") as-is
            try:
                resolved_value = float(int(stripped))
            except ValueError:
                # Then try parsing as float (handles "3.0")
                try:
                    resolved_value = float(stripped)
                except ValueError:
                    # Fall back to treating the string as a formula
                    try:
                        from ....distributions import generate_from_distribution
                        result = generate_from_distribution(stripped)
                    except Exception as e:
                        self.logger.error(f"Error evaluating count formula '{count}': {e}")
                        raise

                    if not isinstance(result, numbers.Number):
                        raise ValueError(
                            f"Count formula '{count}' did not return a numeric value"
                        )
                    resolved_value = float(result)

        if resolved_value is None:
            raise ValueError(f"Invalid count type: {type(count)}")

        resolved_int = int(round(resolved_value))
        if resolved_int < 0:
            raise ValueError("Trigger count must be non-negative")

        return resolved_int

    def _get_target_entity(self, target_table: str) -> Optional['Entity']:
        """Fetch target entity config from db_config."""
        if not self.db_config:
            return None
        return next((e for e in self.db_config.entities if e.name == target_table), None)

    def _detect_fk_column(self, trigger_config: 'TriggerConfig', entity_table: str, target_entity: Optional['Entity']) -> Optional[str]:
        """
        Detect the foreign key column linking target table to entity table.

        Args:
            trigger_config: Trigger configuration
            entity_table: Name of the entity table

        Returns:
            FK column name or None if not found
        """
        # If explicitly specified, use that
        if trigger_config.fk_column:
            return trigger_config.fk_column

        # Auto-detect from database config
        if not target_entity:
            return None

        # Find attribute with foreign key reference to entity table
        for attr in target_entity.attributes:
            if attr.ref and entity_table in attr.ref:
                return attr.name

        self.logger.warning(
            f"No FK column found for {trigger_config.target_table} -> {entity_table}. "
            "Please specify fk_column explicitly."
        )
        return None

    def _resolve_timestamp_fields(
        self,
        trigger_config: 'TriggerConfig',
        target_entity: Optional['Entity'],
        step_id: str
    ):
        """
        Determine timestamp-related columns and values for generated rows.
        Raises if start_date is missing when a timestamp column is requested.
        """
        if not target_entity:
            return None, None, None, None

        attributes_by_name = {attr.name: attr for attr in target_entity.attributes}

        # Determine timestamp column (explicit or default 'created_at')
        timestamp_column = trigger_config.timestamp_column
        if not timestamp_column and 'created_at' in attributes_by_name:
            ts_attr = attributes_by_name['created_at']
            if getattr(ts_attr, 'type', None) in ('datetime', 'timestamp'):
                timestamp_column = 'created_at'

        if timestamp_column and timestamp_column not in attributes_by_name:
            self.logger.warning(
                f"Trigger step {step_id}: timestamp_column '{timestamp_column}' not found in {target_entity.name}; skipping timestamp injection."
            )
            timestamp_column = None

        # Determine sim time column
        sim_time_column = trigger_config.sim_time_column
        if sim_time_column and sim_time_column not in attributes_by_name:
            self.logger.warning(
                f"Trigger step {step_id}: sim_time_column '{sim_time_column}' not found in {target_entity.name}; skipping sim time injection."
            )
            sim_time_column = None

        event_timestamp = None
        if timestamp_column:
            if not self.config or not getattr(self.config, 'start_date', None):
                raise ValueError(
                    f"Trigger step {step_id} requires simulation start_date to populate timestamp_column '{timestamp_column}'"
                )
            event_timestamp = self.config.start_date + timedelta(minutes=self.env.now)

        sim_minutes = self.env.now if sim_time_column else None
        return timestamp_column, sim_time_column, event_timestamp, sim_minutes

    def _generate_records(
        self,
        target_table: str,
        count: int,
        entity_id: int,
        fk_column: str,
        timestamp_column: Optional[str],
        sim_time_column: Optional[str],
        event_timestamp,
        sim_minutes: Optional[float]
    ) -> List[int]:
        """
        Generate records in target table.

        Args:
            target_table: Name of the target table
            count: Number of records to generate
            entity_id: Entity ID to link to (FK value)
            fk_column: FK column name
            timestamp_column: Optional column to stamp with simulation datetime
            sim_time_column: Optional column to store simulation time in minutes
            event_timestamp: Simulation datetime to insert when timestamp_column is set
            sim_minutes: Simulation time in minutes when sim_time_column is set

        Returns:
            List of generated record IDs
        """
        # Import here to avoid circular imports
        from ....generator.data.attribute_generator import generate_attribute_value
        from ....generator.data.formula.evaluator import FormulaEvaluator
        from sqlalchemy.orm import sessionmaker
        from datetime import datetime

        # Find target entity config
        target_entity = self._get_target_entity(target_table)

        if not target_entity:
            raise ValueError(f"Target entity '{target_table}' not found in database config")

        generated_ids = []

        Session = sessionmaker(bind=self.engine)
        with self.engine.connect() as conn, Session(bind=conn) as session:
            formula_evaluator = FormulaEvaluator(session)
            for i in range(count):
                # Generate attribute values
                row_data = {}

                for attr in target_entity.attributes:
                    # Skip primary key (auto-increment)
                    if attr.type == 'pk':
                        continue

                    # Handle FK column - use entity_id
                    if attr.name == fk_column:
                        row_data[attr.name] = entity_id
                        continue

                    # Handle timestamp column (simulation datetime)
                    if timestamp_column and attr.name == timestamp_column:
                        row_data[attr.name] = event_timestamp
                        continue

                    # Handle simulation time column (minutes)
                    if sim_time_column and attr.name == sim_time_column:
                        row_data[attr.name] = sim_minutes
                        continue

                    # Generate value using configured generator
                    if attr.generator and getattr(attr.generator, "type", None) == "formula":
                        try:
                            context = {fk_column: entity_id}
                            value = formula_evaluator.evaluate(attr.generator.expression, context)
                            row_data[attr.name] = value
                        except Exception as e:
                            self.logger.warning(f"Error evaluating formula for {attr.name}: {e}")
                            row_data[attr.name] = None
                    elif attr.generator:
                        try:
                            # Convert attribute to dict format for generate_attribute_value
                            attr_dict = {
                                'name': attr.name,
                                'generator': {
                                    'type': attr.generator.type,
                                    'method': attr.generator.method,
                                    'template': attr.generator.template,
                                    'formula': attr.generator.formula,
                                    'expression': getattr(attr.generator, 'expression', None)
                                }
                            }
                            value = generate_attribute_value(attr_dict, i)
                            row_data[attr.name] = value
                        except Exception as e:
                            self.logger.warning(f"Error generating value for {attr.name}: {e}")
                            # Use default for datetime, None for others
                            if attr.type == 'datetime':
                                row_data[attr.name] = datetime.now()
                            else:
                                row_data[attr.name] = None
                    else:
                        # No generator - use defaults based on type
                        if attr.type == 'datetime':
                            row_data[attr.name] = datetime.now()
                        else:
                            row_data[attr.name] = None

                # Build INSERT statement
                columns = ', '.join(row_data.keys())
                placeholders = ', '.join([f":{k}" for k in row_data.keys()])
                insert_sql = f"INSERT INTO {target_table} ({columns}) VALUES ({placeholders})"

                # Execute insert
                result = conn.execute(text(insert_sql), row_data)
                conn.commit()

                # Get the inserted row ID (assuming last_insert_rowid for SQLite)
                row_id = result.lastrowid
                generated_ids.append(row_id)

                self.logger.debug(f"Generated {target_table} record {row_id} with FK {fk_column}={entity_id}")

        return generated_ids

    def _determine_next_step(self, step: 'Step') -> Optional[str]:
        """
        Determine the next step ID based on step configuration.

        Args:
            step: Current step configuration

        Returns:
            Next step ID or None if flow ends
        """
        if not step.next_steps:
            return None

        # For trigger steps, typically only one next step
        return step.next_steps[0]
