"""
Decide step processor for handling decision-based simulation steps.

This processor handles decision logic with probability-based and conditional
branching, supporting various decision types inspired by Rockwell Arena.
"""

import logging
import random
from typing import Any, Generator, Optional

from .base import StepProcessor

logger = logging.getLogger(__name__)


class DecideStepProcessor(StepProcessor):
    """
    Processor for decide-type steps in the simulation flow.
    
    Handles decision logic including probability-based branching,
    conditional evaluation, and routing to next steps.
    """
    
    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config):
        """
        Initialize the decide step processor.
        
        Args:
            env: SimPy environment
            engine: SQLAlchemy engine
            resource_manager: Resource manager instance
            entity_manager: Entity manager instance
            event_tracker: Event tracker instance
            config: Simulation configuration
        """
        super().__init__(env, engine, resource_manager, entity_manager, event_tracker, config)
        
        # Entity attribute manager will be set during integration
        self.entity_attribute_manager = None
    
    def set_entity_attribute_manager(self, manager):
        """
        Set the entity attribute manager.
        
        Args:
            manager: EntityAttributeManager instance
        """
        self.entity_attribute_manager = manager
        self.logger.debug("Entity attribute manager set")
    
    def can_handle(self, step_type: str) -> bool:
        """Check if this processor can handle decide steps."""
        return step_type == "decide"
    
    def validate_step(self, step: 'Step') -> bool:
        """Validate that the step has proper decide configuration."""
        if not super().validate_step(step):
            return False
        return (step.step_type == "decide" and 
                step.decide_config is not None and
                step.decide_config.outcomes is not None and
                len(step.decide_config.outcomes) > 0)
    
    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                entity_table: str, event_table: str) -> Generator[Any, None, Optional[str]]:
        """
        Process a decide step and determine the next step based on decision logic.
        
        Args:
            entity_id: Entity ID
            step: Decide step configuration
            flow: Event flow configuration
            entity_table: Name of the entity table
            event_table: Name of the event table
            
        Yields:
            No SimPy events (decision is instantaneous)
            
        Returns:
            Next step ID based on decision outcome
        """
        if not self.validate_step(step):
            self.logger.error(f"Invalid decide step configuration for step {step.step_id}")
            return None
        
        self.log_step_start(entity_id, step)
        
        decide_config = step.decide_config
        
        # Determine next step based on decision type
        next_step_id = self._evaluate_decision(entity_id, decide_config)
        
        if next_step_id:
            self.logger.debug(f"Entity {entity_id} decision at {step.step_id}: chose {next_step_id}")
        else:
            self.logger.warning(f"Entity {entity_id} decision at {step.step_id}: no valid outcome")
        
        self.log_step_end(entity_id, step, next_step_id)
        
        # Decision processing is instantaneous - yield and return
        yield self.env.timeout(0)  # Instantaneous event
        return next_step_id
    
    def _evaluate_decision(self, entity_id: int, decide_config: 'DecideConfig') -> Optional[str]:
        """
        Evaluate the decision and return the next step ID.
        
        Args:
            entity_id: Entity ID for context
            decide_config: Decision configuration
            
        Returns:
            Next step ID or None if no valid outcome
        """
        decision_type = decide_config.decision_type.lower()
        
        if decision_type == "probability":
            return self._evaluate_probability_decision(entity_id, decide_config)
        elif decision_type == "condition":
            return self._evaluate_conditional_decision(entity_id, decide_config)
        else:
            self.logger.error(f"Unsupported decision type: {decision_type}")
            return None
    
    def _evaluate_probability_decision(self, entity_id: int, decide_config: 'DecideConfig') -> Optional[str]:
        """
        Evaluate probability-based decision using proper cumulative distribution.
        
        This method fixes the previous bug where decisions were evaluated sequentially
        instead of using proper probability distribution.
        
        Args:
            entity_id: Entity ID for context
            decide_config: Decision configuration
            
        Returns:
            Next step ID based on probability outcome
        """
        outcomes = decide_config.outcomes
        
        if len(outcomes) == 1:
            # Single outcome - always choose it
            return outcomes[0].next_step_id
        
        if len(outcomes) == 2:
            # Binary decision - use first outcome's probability
            return self._evaluate_binary_probability(outcomes)
        
        # N-way decision - use cumulative probability distribution
        return self._evaluate_nway_probability(entity_id, outcomes)
    
    def _evaluate_binary_probability(self, outcomes) -> str:
        """
        Evaluate binary (2-way) probability decision.
        
        Args:
            outcomes: List of two outcomes
            
        Returns:
            Selected outcome's next step ID
        """
        first_outcome = outcomes[0]
        
        # Get probability from first outcome's conditions
        probability = 0.5  # Default 50/50
        for condition in first_outcome.conditions:
            if condition.condition_type == "probability" and condition.probability is not None:
                probability = condition.probability
                break
        
        # Make decision
        if random.random() <= probability:
            return first_outcome.next_step_id
        else:
            return outcomes[1].next_step_id
    
    def _evaluate_nway_probability(self, entity_id: int, outcomes) -> Optional[str]:
        """
        Evaluate N-way probability decision using cumulative distribution.
        
        This fixes the bug in the original implementation that evaluated
        probabilities sequentially instead of cumulatively.
        
        Args:
            entity_id: Entity ID for context
            outcomes: List of outcomes with probabilities
            
        Returns:
            Selected outcome's next step ID
        """
        # Extract probabilities and normalize them
        probabilities = []
        outcome_ids = []
        
        for outcome in outcomes:
            prob = 0.0
            for condition in outcome.conditions:
                if condition.condition_type == "probability" and condition.probability is not None:
                    prob = condition.probability
                    break
            probabilities.append(prob)
            outcome_ids.append(outcome.next_step_id)
        
        # Normalize probabilities to sum to 1.0
        total_prob = sum(probabilities)
        if total_prob == 0:
            # No probabilities specified - use uniform distribution
            probabilities = [1.0 / len(outcomes)] * len(outcomes)
        elif total_prob != 1.0:
            # Normalize to sum to 1.0
            probabilities = [p / total_prob for p in probabilities]
            self.logger.debug(f"Normalized probabilities for entity {entity_id}: {probabilities}")
        
        # Use cumulative distribution
        random_value = random.random()
        cumulative_prob = 0.0
        
        for i, prob in enumerate(probabilities):
            cumulative_prob += prob
            if random_value <= cumulative_prob:
                return outcome_ids[i]
        
        # Fallback to last outcome (should not happen with proper normalization)
        self.logger.warning(f"Probability fallback for entity {entity_id}, choosing last outcome")
        return outcome_ids[-1]
    
    def _evaluate_conditional_decision(self, entity_id: int, decide_config: 'DecideConfig') -> Optional[str]:
        """
        Evaluate conditional decision based on entity attributes.
        
        Args:
            entity_id: Entity ID for context
            decide_config: Decision configuration
            
        Returns:
            Next step ID based on conditional evaluation
        """
        if self.entity_attribute_manager is None:
            self.logger.error(f"No entity attribute manager available for conditional decision, entity {entity_id}")
            # Fallback to first outcome
            return decide_config.outcomes[0].next_step_id if decide_config.outcomes else None
        
        outcomes = decide_config.outcomes
        
        # Evaluate each outcome's conditions
        for outcome in outcomes:
            if self._evaluate_outcome_conditions(entity_id, outcome.conditions):
                self.logger.debug(f"Entity {entity_id} matched outcome {outcome.outcome_id}, next step: {outcome.next_step_id}")
                return outcome.next_step_id
        
        # No outcome matched - log warning and return None
        self.logger.warning(f"No outcome conditions matched for entity {entity_id} in conditional decision")
        return None
    
    def _evaluate_outcome_conditions(self, entity_id: int, conditions: list) -> bool:
        """
        Evaluate all conditions for an outcome (AND logic).
        
        Args:
            entity_id: Entity ID
            conditions: List of condition objects
            
        Returns:
            True if all conditions are met, False otherwise
        """
        if not conditions:
            return True  # No conditions means always true
        
        for condition in conditions:
            if not self._evaluate_single_condition(entity_id, condition):
                return False  # AND logic - one false condition fails the outcome
        
        return True  # All conditions passed
    
    def _evaluate_single_condition(self, entity_id: int, condition) -> bool:
        """
        Evaluate a single condition.
        
        Args:
            entity_id: Entity ID
            condition: Condition object
            
        Returns:
            True if condition is met, False otherwise
        """
        condition_type = condition.condition_type.lower()
        
        if condition_type == "probability":
            # Handle probability conditions (existing logic)
            return random.random() <= (condition.probability or 0.5)
        
        # Attribute-based conditions
        elif condition_type == "attribute_equals":
            return self._evaluate_attribute_equals(entity_id, condition)
        
        elif condition_type == "attribute_not_equals":
            return self._evaluate_attribute_not_equals(entity_id, condition)
        
        elif condition_type == "attribute_greater_than":
            return self._evaluate_attribute_greater_than(entity_id, condition)
        
        elif condition_type == "attribute_less_than":
            return self._evaluate_attribute_less_than(entity_id, condition)
        
        elif condition_type == "attribute_in":
            return self._evaluate_attribute_in(entity_id, condition)
        
        else:
            self.logger.error(f"Unsupported condition type: {condition_type}")
            return False
    
    def _evaluate_attribute_equals(self, entity_id: int, condition) -> bool:
        """Evaluate attribute_equals condition."""
        if not condition.attribute_name or condition.value is None:
            self.logger.error(f"Invalid attribute_equals condition for entity {entity_id}: missing attribute_name or value")
            return False
        
        attr_value = self.entity_attribute_manager.get_attribute(entity_id, condition.attribute_name)
        result = attr_value == condition.value
        self.logger.debug(f"Entity {entity_id}: {condition.attribute_name} == {condition.value} -> {result} (actual: {attr_value})")
        return result
    
    def _evaluate_attribute_not_equals(self, entity_id: int, condition) -> bool:
        """Evaluate attribute_not_equals condition."""
        if not condition.attribute_name or condition.value is None:
            self.logger.error(f"Invalid attribute_not_equals condition for entity {entity_id}: missing attribute_name or value")
            return False
        
        attr_value = self.entity_attribute_manager.get_attribute(entity_id, condition.attribute_name)
        result = attr_value != condition.value
        self.logger.debug(f"Entity {entity_id}: {condition.attribute_name} != {condition.value} -> {result} (actual: {attr_value})")
        return result
    
    def _evaluate_attribute_greater_than(self, entity_id: int, condition) -> bool:
        """Evaluate attribute_greater_than condition."""
        if not condition.attribute_name or condition.value is None:
            self.logger.error(f"Invalid attribute_greater_than condition for entity {entity_id}: missing attribute_name or value")
            return False
        
        attr_value = self.entity_attribute_manager.get_attribute(entity_id, condition.attribute_name)
        
        # Check if both values are numeric
        if not isinstance(attr_value, (int, float)) or not isinstance(condition.value, (int, float)):
            self.logger.error(f"Non-numeric values in greater_than comparison for entity {entity_id}: {attr_value} > {condition.value}")
            return False
        
        result = attr_value > condition.value
        self.logger.debug(f"Entity {entity_id}: {condition.attribute_name} > {condition.value} -> {result} (actual: {attr_value})")
        return result
    
    def _evaluate_attribute_less_than(self, entity_id: int, condition) -> bool:
        """Evaluate attribute_less_than condition."""
        if not condition.attribute_name or condition.value is None:
            self.logger.error(f"Invalid attribute_less_than condition for entity {entity_id}: missing attribute_name or value")
            return False
        
        attr_value = self.entity_attribute_manager.get_attribute(entity_id, condition.attribute_name)
        
        # Check if both values are numeric
        if not isinstance(attr_value, (int, float)) or not isinstance(condition.value, (int, float)):
            self.logger.error(f"Non-numeric values in less_than comparison for entity {entity_id}: {attr_value} < {condition.value}")
            return False
        
        result = attr_value < condition.value
        self.logger.debug(f"Entity {entity_id}: {condition.attribute_name} < {condition.value} -> {result} (actual: {attr_value})")
        return result
    
    def _evaluate_attribute_in(self, entity_id: int, condition) -> bool:
        """Evaluate attribute_in condition."""
        if not condition.attribute_name or not condition.values:
            self.logger.error(f"Invalid attribute_in condition for entity {entity_id}: missing attribute_name or values")
            return False
        
        attr_value = self.entity_attribute_manager.get_attribute(entity_id, condition.attribute_name)
        result = attr_value in condition.values
        self.logger.debug(f"Entity {entity_id}: {condition.attribute_name} in {condition.values} -> {result} (actual: {attr_value})")
        return result
    
    def get_supported_decision_types(self) -> list:
        """
        Get list of supported decision types.
        
        Returns:
            List of supported decision type strings
        """
        return ["probability", "condition"]
    
    def get_arena_compatibility_status(self) -> dict:
        """
        Get Arena compatibility status for different decision types.
        
        Returns:
            Dictionary mapping Arena features to support status
        """
        return {
            "2-way by chance": "Fully supported",
            "2-way by condition": "Fully supported (requires entity attributes)", 
            "N-way by chance": "Fully supported (fixed cumulative distribution)",
            "N-way by condition": "Fully supported (requires entity attributes)",
            "Supported condition types": [
                "attribute_equals", "attribute_not_equals", 
                "attribute_greater_than", "attribute_less_than", "attribute_in"
            ]
        }