import os
import logging
import ctypes
from datetime import datetime, timezone, timedelta
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
                    try:
                        # Attempt to recover the timestamp from internal ctypes structure
                        # Structure typically is: self._raw (pointer) -> contents -> value (union) -> double_val
                        if hasattr(self, '_raw') and self._raw:
                            # access structure contents
                            raw_struct = self._raw.contents
                            # Check if it has 'value' field (MiniRacerValue union)
                            if hasattr(raw_struct, 'value'):
                                val = raw_struct.value
                                if hasattr(val, 'double_val'):
                                    ts = val.double_val
                                    
                                    # Manually convert timestamp (ms) to datetime
                                    # This bypasses the platform limitation of fromtimestamp() on Windows
                                    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
                                    fixed_dt = epoch + timedelta(milliseconds=ts)
                                    
                                    logger.debug(f"Recovered pre-1970 date from OSError: {fixed_dt}")
                                    return fixed_dt
                                    
                    except Exception as recovery_error:
                        logger.warning(f"Failed to recover date from OSError: {recovery_error}")

                    # Fallback: Return error message instead of None if recovery failed
                    logger.warning(
                        "Caught OSError [Errno 22] in ValueHandle.to_python and failed to recover date."
                    )
                    return "Error: Invalid Date (Pre-1970 handling failed)"
                raise
        
        # Apply patch
        _value_handle.ValueHandle.to_python = patched_to_python
    else:
        logger.info("py_mini_racer already patched")
