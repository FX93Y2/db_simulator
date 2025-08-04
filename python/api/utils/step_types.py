"""
Step type definitions and utilities for DB Simulator API.
Contains information about supported step types for simulation flows.
"""

def get_step_types_info():
    """Get information about supported step types for frontend."""
    return {
        "event": {
            "name": "Process/Event",
            "description": "Process entities with resource requirements and duration",
            "required_config": ["name", "duration"],
            "optional_config": ["resource_requirements"],
            "example": {
                "name": "Requirements Analysis",
                "duration": {
                    "distribution": {"type": "normal", "mean": 3, "stddev": 0.5}
                },
                "resource_requirements": [{
                    "resource_table": "Consultant",
                    "value": "Developer",
                    "count": 1
                }]
            }
        },
        "decide": {
            "name": "Decide",
            "description": "Make probability-based decisions with multiple outcomes",
            "required_config": ["module_id", "decision_type", "outcomes"],
            "optional_config": [],
            "example": {
                "module_id": "implementation_decision",
                "decision_type": "probability",
                "outcomes": [
                    {
                        "outcome_id": "to_testing",
                        "next_step_id": "testing",
                        "conditions": [{"condition_type": "probability", "probability": 0.8}]
                    },
                    {
                        "outcome_id": "rework",
                        "next_step_id": "design",
                        "conditions": [{"condition_type": "probability", "probability": 0.2}]
                    }
                ]
            }
        },
        "assign": {
            "name": "Assign",
            "description": "Assign values to entity attributes",
            "required_config": ["module_id", "assignments"],
            "optional_config": [],
            "example": {
                "module_id": "attribute_assignment",
                "assignments": [
                    {
                        "assignment_type": "direct",
                        "attribute_name": "status",
                        "value": "active"
                    }
                ]
            }
        },
        "release": {
            "name": "Release",
            "description": "Final step to release entity resources and complete flow",
            "required_config": [],
            "optional_config": ["event_config"],
            "example": {
                "event_config": {"name": "Release"}
            }
        }
    }

def generate_step_template(step_type, step_id=None):
    """
    Generate a template for a specific step type.
    
    Args:
        step_type: Type of step to generate template for
        step_id: ID for the step (optional)
        
    Returns:
        dict: Step template or None if step_type is invalid
    """
    step_types_info = get_step_types_info()
    
    if step_type not in step_types_info:
        return None
    
    if step_id is None:
        step_id = f"new_{step_type}_step"
    
    # Generate template based on step type
    template = {
        "step_id": step_id,
        "step_type": step_type
    }
    
    if step_type == 'event':
        template["event_config"] = step_types_info[step_type]["example"].copy()
        template["next_steps"] = []
        
    elif step_type == 'decide':
        template["decide_config"] = step_types_info[step_type]["example"].copy()
        
    elif step_type == 'assign':
        template["assign_config"] = step_types_info[step_type]["example"].copy()
        template["next_steps"] = []
        
    elif step_type == 'release':
        template["event_config"] = step_types_info[step_type]["example"].copy()
    
    return template

def get_valid_step_types():
    """Get list of valid step types."""
    return list(get_step_types_info().keys())