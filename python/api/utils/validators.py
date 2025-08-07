"""
Validation utilities for DB Simulator API.
Contains validation functions for configurations and data structures.
"""

import yaml
import logging

logger = logging.getLogger(__name__)

def validate_event_flows_structure(config_data):
    """
    Validate event_flows configuration structure.
    
    Args:
        config_data: Parsed YAML configuration data
        
    Returns:
        dict: {"valid": bool, "error": str, "details": list}
    """
    try:
        # Check if event_simulation section exists
        if 'event_simulation' not in config_data:
            return {"valid": False, "error": "Missing event_simulation section"}
        
        event_simulation = config_data['event_simulation']
        
        # Check if event_flows section exists
        if 'event_flows' not in event_simulation:
            # event_flows is optional, so this is valid
            return {"valid": True}
        
        event_flows = event_simulation['event_flows']
        
        if not isinstance(event_flows, list):
            return {"valid": False, "error": "event_flows must be a list"}
        
        details = []
        
        # Validate each flow
        for i, flow in enumerate(event_flows):
            if not isinstance(flow, dict):
                return {"valid": False, "error": f"Flow {i} must be a dictionary"}
            
            # Check required flow fields
            required_flow_fields = ['flow_id', 'steps']
            for field in required_flow_fields:
                if field not in flow:
                    return {"valid": False, "error": f"Flow {i} missing required field: {field}"}
            
            # Validate steps
            steps = flow['steps']
            if not isinstance(steps, list):
                return {"valid": False, "error": f"Flow {i} steps must be a list"}
            
            step_ids = set()
            for j, step in enumerate(steps):
                if not isinstance(step, dict):
                    return {"valid": False, "error": f"Flow {i} step {j} must be a dictionary"}
                
                # Check required step fields
                required_step_fields = ['step_id', 'step_type']
                for field in required_step_fields:
                    if field not in step:
                        return {"valid": False, "error": f"Flow {i} step {j} missing required field: {field}"}
                
                step_id = step['step_id']
                step_type = step['step_type']
                
                # Check for duplicate step IDs
                if step_id in step_ids:
                    return {"valid": False, "error": f"Flow {i} has duplicate step_id: {step_id}"}
                step_ids.add(step_id)
                
                # Validate step type
                valid_step_types = ['event', 'decide', 'release', 'assign', 'create']
                if step_type not in valid_step_types:
                    return {"valid": False, "error": f"Flow {i} step {step_id} has invalid step_type: {step_type}"}
                
                # Validate step configuration based on type
                validation_error = _validate_step_config(step, step_id, i)
                if validation_error:
                    return {"valid": False, "error": validation_error}
                
                details.append(f"Flow {i} step {step_id} ({step_type}) validated successfully")
            
            # Validate entry points exist (Create modules should be present for entity generation)
            entry_point_types = ['create']
            entry_points = [step for step in steps if step.get('step_type') in entry_point_types]
            if not entry_points:
                details.append(f"Flow {i} warning: No entry point modules found (Create, etc.). Entities may not be generated.")
            else:
                details.append(f"Flow {i} has {len(entry_points)} entry point module(s)")
        
        return {"valid": True, "details": details}
        
    except Exception as e:
        return {"valid": False, "error": f"Validation error: {str(e)}"}

def _validate_step_config(step, step_id, flow_index):
    """
    Validate step configuration based on step type.
    
    Returns:
        str: Error message if validation fails, None if valid
    """
    step_type = step['step_type']
    
    if step_type == 'event':
        if 'event_config' not in step:
            return f"Flow {flow_index} event step {step_id} missing event_config"
        
        event_config = step['event_config']
        if 'name' not in event_config:
            return f"Flow {flow_index} event step {step_id} missing event_config.name"
        
        if 'duration' not in event_config:
            return f"Flow {flow_index} event step {step_id} missing event_config.duration"
    
    elif step_type == 'decide':
        if 'decide_config' not in step:
            return f"Flow {flow_index} decide step {step_id} missing decide_config"
        
        decide_config = step['decide_config']
        required_decide_fields = ['module_id', 'decision_type', 'outcomes']
        for field in required_decide_fields:
            if field not in decide_config:
                return f"Flow {flow_index} decide step {step_id} missing decide_config.{field}"
        
        # Validate outcomes
        outcomes = decide_config['outcomes']
        if not isinstance(outcomes, list) or len(outcomes) < 2:
            return f"Flow {flow_index} decide step {step_id} must have at least 2 outcomes"
        
        for k, outcome in enumerate(outcomes):
            if 'outcome_id' not in outcome or 'next_step_id' not in outcome:
                return f"Flow {flow_index} decide step {step_id} outcome {k} missing required fields"
    
    elif step_type == 'assign':
        if 'assign_config' not in step:
            return f"Flow {flow_index} assign step {step_id} missing assign_config"
        
        assign_config = step['assign_config']
        required_assign_fields = ['module_id', 'assignments']
        for field in required_assign_fields:
            if field not in assign_config:
                return f"Flow {flow_index} assign step {step_id} missing assign_config.{field}"
        
        # Validate assignments
        assignments = assign_config['assignments']
        if not isinstance(assignments, list) or len(assignments) == 0:
            return f"Flow {flow_index} assign step {step_id} must have at least 1 assignment"
        
        for k, assignment in enumerate(assignments):
            if 'assignment_type' not in assignment or 'attribute_name' not in assignment or 'value' not in assignment:
                return f"Flow {flow_index} assign step {step_id} assignment {k} missing required fields"
    
    elif step_type == 'release':
        # Release steps are typically minimal, just verify structure
        pass
    
    elif step_type == 'create':
        if 'create_config' not in step:
            return f"Flow {flow_index} create step {step_id} missing create_config"
        
        create_config = step['create_config']
        required_create_fields = ['entity_table', 'interarrival_time']
        for field in required_create_fields:
            if field not in create_config:
                return f"Flow {flow_index} create step {step_id} missing create_config.{field}"
        
        # Validate interarrival_time has distribution
        interarrival_time = create_config['interarrival_time']
        if not isinstance(interarrival_time, dict) or 'distribution' not in interarrival_time:
            return f"Flow {flow_index} create step {step_id} interarrival_time must have distribution config"
    
    return None

def validate_yaml_content(content):
    """
    Validate YAML content.
    
    Args:
        content: YAML content string
        
    Returns:
        dict: {"valid": bool, "error": str, "parsed": object}
    """
    try:
        parsed_yaml = yaml.safe_load(content)
        if parsed_yaml is None:
            return {"valid": False, "error": "Invalid or empty YAML content", "parsed": None}
        return {"valid": True, "error": None, "parsed": parsed_yaml}
    except yaml.YAMLError as e:
        return {"valid": False, "error": f"Invalid YAML: {str(e)}", "parsed": None}
    except Exception as e:
        return {"valid": False, "error": f"Validation error: {str(e)}", "parsed": None}