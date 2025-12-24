
import os
import logging
from py_mini_racer import _value_handle

logger = logging.getLogger(__name__)

def apply_patch():
    """
    Apply monkeypatch to py_mini_racer to handle Windows OSError on pre-1970 dates.
    """
    if not hasattr(_value_handle.ValueHandle, '_original_to_python'):
        logger.info("Applying py_mini_racer monkeypatch for Windows OSError [Errno 22]")
        
        # Save original method
        _value_handle.ValueHandle._original_to_python = _value_handle.ValueHandle.to_python
        
        def patched_to_python(self):
            try:
                return self._original_to_python()
            except OSError as e:
                # Check for [Errno 22] Invalid argument which happens on Windows for pre-1970 dates
                if e.errno == 22:
                    logger.warning(
                        "Caught OSError [Errno 22] in ValueHandle.to_python. "
                        "This usually indicates a date value that Python on Windows cannot handle (e.g. pre-1970). "
                        "Returning None as fallback."
                    )
                    return None
                raise
        
        # Apply patch
        _value_handle.ValueHandle.to_python = patched_to_python
    else:
        logger.info("py_mini_racer already patched")
