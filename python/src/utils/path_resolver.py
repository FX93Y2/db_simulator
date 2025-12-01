"""
Shared utilities for resolving project paths (output directories, project root).

Centralizes logic for:
- honoring DB_SIMULATOR_OUTPUT_DIR when set
- resolving relative paths against project root
- appending project-specific subdirectories
- ensuring writability with optional temp fallback
"""

import logging
import os
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)


def resolve_project_root() -> str:
    """
    Resolve the project root by walking up from this file and looking
    for the expected structure (python/ and electron/ siblings).
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # src/utils/path_resolver.py -> utils -> src -> python
    python_dir = os.path.dirname(os.path.dirname(current_dir))
    project_dir = os.path.dirname(python_dir)

    if os.path.isdir(os.path.join(project_dir, "python")) and os.path.isdir(
        os.path.join(project_dir, "electron")
    ):
        return project_dir

    # Fallback: go two levels up from python/src/utils
    return os.path.abspath(os.path.join(python_dir, os.pardir))


def resolve_output_dir(
    output_dir: Optional[str] = None,
    project_id: Optional[str] = None,
    require_writable: bool = True,
) -> str:
    """
    Resolve an output directory with consistent rules.

    Resolution order:
    1. DB_SIMULATOR_OUTPUT_DIR env var (honored first)
    2. Provided output_dir (absolute kept; relative anchored at project root)
    3. Default to project_root/output
    2 and 3 are for testing

    If project_id is provided, append it.
    When require_writable=True, will fallback to a temp directory if unwritable.
    """
    env_dir = os.environ.get("DB_SIMULATOR_OUTPUT_DIR")
    base_dir = env_dir if env_dir else output_dir

    if not base_dir:
        project_root = resolve_project_root()
        base_dir = os.path.join(project_root, "output")

    # Anchor relative paths at project root for consistency
    if not os.path.isabs(base_dir):
        project_root = resolve_project_root()
        base_dir = os.path.abspath(os.path.join(project_root, base_dir))

    final_dir = os.path.join(base_dir, project_id) if project_id else base_dir

    try:
        os.makedirs(final_dir, exist_ok=True)
        if require_writable and not os.access(final_dir, os.W_OK):
            raise PermissionError(f"Output directory not writable: {final_dir}")
    except Exception as e:
        logger.warning(f"Falling back to temp output dir due to: {e}")
        temp_base = os.path.join(tempfile.gettempdir(), "db_simulator", "output")
        final_dir = os.path.join(temp_base, project_id) if project_id else temp_base
        os.makedirs(final_dir, exist_ok=True)

    logger.info(f"Resolved output directory: {final_dir}")
    return final_dir
