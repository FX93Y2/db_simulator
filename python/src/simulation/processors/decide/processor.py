"""
Decide step processor for handling decision-based simulation steps.

This processor handles decision logic with probability-based and conditional
branching, supporting various decision types inspired by Rockwell Arena.
"""

import logging
import random
from typing import Any, Generator, Optional

from ..base import StepProcessor

logger = logging.getLogger(__name__)


class DecideStepProcessor(StepProcessor):
    """
    Processor for decide-type steps in the simulation flow.
    
    Handles decision logic including probability-based branching,
    conditional evaluation, and routing to next steps.
    """
    
    def __init__(self, env, engine, resource_manager, entity_manager, event_tracker, config, simulator=None):
        """
        Initialize the decide step processor.
        
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
        
        if step.step_type != "decide":
            return False
        
        config = step.decide_config
        if not config:
            self.logger.error(f"Missing decide_config for step {step.step_id}")
            return False
        
        # Validate decision type
        valid_types = ['2way-chance', '2way-condition', 'nway-chance', 'nway-condition']
        if config.decision_type not in valid_types:
            self.logger.error(f"Invalid decision type '{config.decision_type}' for step {step.step_id}. Valid types: {valid_types}")
            return False
        
        # Validate outcome count
        if not config.outcomes:
            self.logger.error(f"No outcomes defined for decide step {step.step_id}")
            return False
        
        outcome_count = len(config.outcomes)
        if config.decision_type.startswith('2way-') and outcome_count != 2:
            self.logger.error(f"2-way decision '{config.decision_type}' requires exactly 2 outcomes, got {outcome_count} for step {step.step_id}")
            return False
        if config.decision_type.startswith('nway-') and outcome_count < 2:
            self.logger.error(f"N-way decision '{config.decision_type}' requires at least 2 outcomes, got {outcome_count} for step {step.step_id}")
            return False
        
        # Validate that all outcomes have next_step_id
        for i, outcome in enumerate(config.outcomes):
            if not outcome.next_step_id:
                self.logger.error(f"Outcome {i} missing next_step_id for decide step {step.step_id}")
                return False
        
        self.logger.debug(f"Validated decide step {step.step_id}: type={config.decision_type}, outcomes={outcome_count}")
        return True
    
    def process(self, entity_id: int, step: 'Step', flow: 'EventFlow', 
                entity_table: str, event_table: str, event_tracker=None) -> Generator[Any, None, Optional[str]]:
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
        decision_type = decide_config.decision_type
        
        if decision_type == "2way-chance":
            return self._evaluate_2way_chance(entity_id, decide_config)
        elif decision_type == "2way-condition":
            return self._evaluate_2way_condition(entity_id, decide_config)
        elif decision_type == "nway-chance":
            return self._evaluate_nway_chance(entity_id, decide_config)
        elif decision_type == "nway-condition":
            return self._evaluate_nway_condition(entity_id, decide_config)
        else:
            self.logger.error(f"Invalid decision type: {decision_type}")
            return None
    
    def _evaluate_2way_chance(self, entity_id: int, decide_config: 'DecideConfig') -> Optional[str]:
        """
        Evaluate 2-way chance decision. Uses first outcome's probability,
        second outcome gets the remaining probability automatically.
        
        Args:
            entity_id: Entity ID for context
            decide_config: Decision configuration (must have exactly 2 outcomes)
            
        Returns:
            Next step ID based on probability outcome
        """
        outcomes = decide_config.outcomes
        if len(outcomes) != 2:
            self.logger.error(f"2-way chance decision requires exactly 2 outcomes, got {len(outcomes)}")
            return None
        
        first_outcome = outcomes[0]
        
        # Get probability from first outcome's conditions
        probability = 0.5  # Default 50/50
        for condition in first_outcome.conditions:
            if condition.if_ and condition.if_.lower() == "probability" and condition.value is not None:
                probability = condition.value
                break
        
        # Make decision: if random <= probability, choose first, else choose second
        if random.random() <= probability:
            self.logger.debug(f"Entity {entity_id}: 2-way chance chose primary outcome ({probability:.1%})")
            return first_outcome.next_step_id
        else:
            self.logger.debug(f"Entity {entity_id}: 2-way chance chose else outcome ({1-probability:.1%})")
            return outcomes[1].next_step_id
    
    def _evaluate_2way_condition(self, entity_id: int, decide_config: 'DecideConfig') -> Optional[str]:
        """
        Evaluate 2-way conditional decision. First outcome has the condition,
        second outcome is the "else" case.
        
        Args:
            entity_id: Entity ID for context
            decide_config: Decision configuration (must have exactly 2 outcomes)
            
        Returns:
            Next step ID based on conditional evaluation
        """
        outcomes = decide_config.outcomes
        if len(outcomes) != 2:
            self.logger.error(f"2-way condition decision requires exactly 2 outcomes, got {len(outcomes)}")
            return None
        
        if self.entity_attribute_manager is None:
            self.logger.error(f"No entity attribute manager available for conditional decision, entity {entity_id}")
            return None
        
        first_outcome = outcomes[0]
        
        # Evaluate first outcome's conditions - if they match, choose it, else choose second
        if self._evaluate_outcome_conditions(entity_id, first_outcome.conditions):
            self.logger.debug(f"Entity {entity_id}: 2-way condition matched primary condition")
            return first_outcome.next_step_id
        else:
            self.logger.debug(f"Entity {entity_id}: 2-way condition fell through to else outcome")
            return outcomes[1].next_step_id
    
    def _evaluate_nway_chance(self, entity_id: int, decide_config: 'DecideConfig') -> Optional[str]:
        """
        Evaluate N-way chance decision using cumulative probability distribution.
        
        Args:
            entity_id: Entity ID for context
            decide_config: Decision configuration (must have 2+ outcomes)
            
        Returns:
            Selected outcome's next step ID
        """
        outcomes = decide_config.outcomes
        if len(outcomes) < 2:
            self.logger.error(f"N-way chance decision requires at least 2 outcomes, got {len(outcomes)}")
            return None
        
        # Extract probabilities and normalize them
        probabilities = []
        outcome_ids = []
        
        for outcome in outcomes:
            prob = 0.0
            for condition in outcome.conditions:
                if condition.if_ and condition.if_.lower() == "probability" and condition.value is not None:
                    prob = condition.value
                    break
            probabilities.append(prob)
            outcome_ids.append(outcome.next_step_id)
        
        # Normalize probabilities to sum to 1.0
        total_prob = sum(probabilities)
        if total_prob == 0:
            # No probabilities specified - use uniform distribution
            probabilities = [1.0 / len(outcomes)] * len(outcomes)
            self.logger.debug(f"Entity {entity_id}: Using uniform distribution for N-way chance")
        elif total_prob != 1.0:
            # Normalize to sum to 1.0
            probabilities = [p / total_prob for p in probabilities]
            self.logger.debug(f"Entity {entity_id}: Normalized N-way probabilities: {probabilities}")
        
        # Use cumulative distribution
        random_value = random.random()
        cumulative_prob = 0.0
        
        for i, prob in enumerate(probabilities):
            cumulative_prob += prob
            if random_value <= cumulative_prob:
                self.logger.debug(f"Entity {entity_id}: N-way chance selected outcome {i} ({prob:.1%})")
                return outcome_ids[i]
        
        # Fallback to last outcome (should not happen with proper normalization)
        self.logger.warning(f"N-way chance probability fallback for entity {entity_id}, choosing last outcome")
        return outcome_ids[-1]
    
    def _evaluate_nway_condition(self, entity_id: int, decide_config: 'DecideConfig') -> Optional[str]:
        """
        Evaluate N-way conditional decision. Evaluates conditions in order,
        returns first matching outcome.
        
        Args:
            entity_id: Entity ID for context
            decide_config: Decision configuration (must have 2+ outcomes)
            
        Returns:
            Next step ID based on conditional evaluation
        """
        outcomes = decide_config.outcomes
        if len(outcomes) < 2:
            self.logger.error(f"N-way condition decision requires at least 2 outcomes, got {len(outcomes)}")
            return None
        
        if self.entity_attribute_manager is None:
            self.logger.error(f"No entity attribute manager available for conditional decision, entity {entity_id}")
            return None
        
        # Evaluate each outcome's conditions in order
        for i, outcome in enumerate(outcomes):
            if self._evaluate_outcome_conditions(entity_id, outcome.conditions):
                self.logger.debug(f"Entity {entity_id}: N-way condition matched outcome {i} ({outcome.outcome_id})")
                return outcome.next_step_id
        
        # No outcome matched - log warning and return None
        self.logger.warning(f"No outcome conditions matched for entity {entity_id} in N-way conditional decision")
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
        Evaluate a single condition using the new if/name/is/value format.
        
        Args:
            entity_id: Entity ID
            condition: Condition object
            
        Returns:
            True if condition is met, False otherwise
        """
        # Validate new format
        if not condition.if_ or not condition.is_ or condition.value is None:
            self.logger.error(f"Invalid condition format for entity {entity_id}: missing required fields (if, is, value)")
            return False
            
        if_type = condition.if_.lower()
        operator = condition.is_
        value = condition.value
        
        if if_type == "probability":
            return self._evaluate_probability_condition(entity_id, operator, value)
        elif if_type == "attribute":
            if not condition.name:
                self.logger.error(f"Invalid attribute condition for entity {entity_id}: missing name field")
                return False
            return self._evaluate_attribute_condition(entity_id, condition.name, operator, value)
        elif if_type == "expression":
            return self._evaluate_expression_condition(entity_id, operator, value)
        else:
            self.logger.error(f"Unsupported if type: {if_type}")
            return False
    
    def _evaluate_probability_condition(self, entity_id: int, operator: str, probability_value: float) -> bool:
        """
        Evaluate probability condition.
        
        Args:
            entity_id: Entity ID
            operator: Comparison operator (should be "==")
            probability_value: Probability threshold
            
        Returns:
            True if random value meets probability condition
        """
        if operator != "==":
            self.logger.error(f"Unsupported probability operator: {operator}")
            return False
            
        random_value = random.random()
        result = random_value <= probability_value
        self.logger.debug(f"Entity {entity_id}: Probability {random_value} <= {probability_value} -> {result}")
        return result
    
    def _evaluate_attribute_condition(self, entity_id: int, attribute_name: str, operator: str, expected_value) -> bool:
        """
        Evaluate attribute condition using operator.
        
        Args:
            entity_id: Entity ID
            attribute_name: Name of the attribute
            operator: Comparison operator ("==", "!=", ">", ">=", "<", "<=", "<>")
            expected_value: Value to compare against
            
        Returns:
            True if condition is met, False otherwise
        """
        if self.entity_attribute_manager is None:
            self.logger.error(f"No entity attribute manager available for attribute condition, entity {entity_id}")
            return False
        
        if not attribute_name or expected_value is None:
            self.logger.error(f"Invalid attribute condition for entity {entity_id}: missing attribute_name or value")
            return False
        
        actual_value = self.entity_attribute_manager.get_attribute(entity_id, attribute_name)
        
        try:
            if operator == "==":
                result = actual_value == expected_value
            elif operator == "!=" or operator == "<>":
                result = actual_value != expected_value
            elif operator == ">":
                # Ensure both values are numeric for comparison
                if not isinstance(actual_value, (int, float)) or not isinstance(expected_value, (int, float)):
                    self.logger.error(f"Non-numeric values in > comparison for entity {entity_id}: {actual_value} > {expected_value}")
                    return False
                result = actual_value > expected_value
            elif operator == ">=":
                if not isinstance(actual_value, (int, float)) or not isinstance(expected_value, (int, float)):
                    self.logger.error(f"Non-numeric values in >= comparison for entity {entity_id}: {actual_value} >= {expected_value}")
                    return False
                result = actual_value >= expected_value
            elif operator == "<":
                if not isinstance(actual_value, (int, float)) or not isinstance(expected_value, (int, float)):
                    self.logger.error(f"Non-numeric values in < comparison for entity {entity_id}: {actual_value} < {expected_value}")
                    return False
                result = actual_value < expected_value
            elif operator == "<=":
                if not isinstance(actual_value, (int, float)) or not isinstance(expected_value, (int, float)):
                    self.logger.error(f"Non-numeric values in <= comparison for entity {entity_id}: {actual_value} <= {expected_value}")
                    return False
                result = actual_value <= expected_value
            else:
                self.logger.error(f"Unsupported operator: {operator}")
                return False
            
            self.logger.debug(f"Entity {entity_id}: {attribute_name} {operator} {expected_value} -> {result} (actual: {actual_value})")
            return result
            
        except Exception as e:
            self.logger.error(f"Error evaluating attribute condition for entity {entity_id}: {e}")
            return False
    
    def _evaluate_expression_condition(self, entity_id: int, operator: str, expression_value: str) -> bool:
        """
        Evaluate expression condition.
        
        Args:
            entity_id: Entity ID
            operator: Comparison operator (==, !=, etc.)
            expression_value: Expression string to evaluate
            
        Returns:
            Boolean result of the condition evaluation
        """
        try:
            # For Step 1: Simple boolean string evaluation
            # TODO: In later steps, this will support SQL queries and helper functions
            if expression_value.lower() == "true":
                actual_value = True
            elif expression_value.lower() == "false":
                actual_value = False
            else:
                self.logger.warning(f"Unknown expression value for entity {entity_id}: {expression_value}, defaulting to False")
                actual_value = False
            
            # Apply the operator (for now just handle ==)
            if operator == "==":
                result = actual_value == True
            elif operator == "!=":
                result = actual_value != True
            else:
                self.logger.error(f"Unsupported operator for expression condition: {operator}")
                return False
            
            self.logger.debug(f"Entity {entity_id}: expression '{expression_value}' {operator} True -> {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"Error evaluating expression condition for entity {entity_id}: {e}")
            return False
    
    def get_supported_decision_types(self) -> list:
        """
        Get list of supported decision types.
        
        Returns:
            List of supported decision type strings
        """
        return ["2way-chance", "2way-condition", "nway-chance", "nway-condition"]
    
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
            "Condition format": "Clean 'if name is value' format",
            "Supported operators": ["==", "!=", ">", ">=", "<", "<=", "<>"],
            "Supported if types": ["Attribute", "Probability"]
        }