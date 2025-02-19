from typing import Any, Dict, Optional

def generate_from_template(template: str, context: Dict[str, Any], size: Optional[int] = None) -> Any:
    """Generate data using a template string and context variables"""
    if size is None:
        return template.format(**context)
    
    return [
        template.format(**{**context, 'id': i + 1})
        for i in range(size)
    ]