"""
Results retrieval and export routes for DB Simulator API.
Handles simulation results analysis and data export operations.
"""

import csv
import logging
import os
import sqlite3
import sys
from datetime import datetime
from typing import List, Dict, Tuple

# Add parent directory to sys.path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from flask import Blueprint, request
from ..utils.response_helpers import (
    success_response, error_response, validation_error_response,
    handle_exception, require_json_fields, log_api_request
)

# Create Blueprint
results_bp = Blueprint('results', __name__)

# Create logger
logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir))


@results_bp.route('/results/summary', methods=['GET'])
def get_simulation_results():
    """Get summary data about a simulation result database"""
    try:
        database_path = request.args.get('database_path')
        if not database_path:
            return validation_error_response("Missing database_path parameter")

        log_api_request(logger, "Get simulation results", extra_info=f"path: {database_path}")

        resolved_path = _resolve_database_path(database_path)
        if not os.path.exists(resolved_path):
            return error_response(f"Database not found at {resolved_path}", status_code=404)

        summary = _build_database_summary(resolved_path)
        return success_response({"data": summary})

    except Exception as e:
        return handle_exception(e, "retrieving simulation results", logger)


@results_bp.route('/results/tables', methods=['GET'])
def get_database_tables():
    """Get list of tables in a result database"""
    try:
        database_path = request.args.get('database_path')
        if not database_path:
            return validation_error_response("Missing database_path parameter")

        log_api_request(logger, "Get database tables", extra_info=f"path: {database_path}")

        resolved_path = _resolve_database_path(database_path)
        if not os.path.exists(resolved_path):
            return error_response(f"Database not found at {resolved_path}", status_code=404)

        with _open_connection(resolved_path) as conn:
            tables = _list_tables(conn)

        return success_response({"tables": tables})

    except Exception as e:
        return handle_exception(e, "retrieving database tables", logger)


@results_bp.route('/results/table-data', methods=['GET'])
def get_table_data():
    """Get data from a specific table"""
    try:
        # Support both camelCase and snake_case to align with existing UI calls
        database_path = request.args.get('databasePath') or request.args.get('database_path')
        table_name = request.args.get('tableName') or request.args.get('table_name')
        limit = request.args.get('limit', 1000)

        if not database_path or not table_name:
            return validation_error_response("Missing required parameters")

        log_api_request(logger, "Get table data", extra_info=f"table: {table_name}, path: {database_path}")

        resolved_path = _resolve_database_path(database_path)
        if not os.path.exists(resolved_path):
            return error_response(f"Database not found at {resolved_path}", status_code=404)

        limit_value = _coerce_limit(limit)

        with _open_connection(resolved_path) as conn:
            tables = _list_tables(conn)
            if table_name not in tables:
                return validation_error_response(f"Unknown table: {table_name}")

            rows, columns = _fetch_table_rows(conn, table_name, limit_value)

        return success_response({"data": rows, "columns": columns})

    except Exception as e:
        return handle_exception(e, "retrieving table data", logger)


@results_bp.route('/results/export-csv', methods=['POST'])
def export_database_to_csv():
    """Export database tables to CSV files"""
    try:
        log_api_request(logger, "Export database to CSV")

        # Validate request data
        data, validation_error = require_json_fields(request, ['database_path', 'export_path'])
        if validation_error:
            return validation_error

        database_path = data['database_path']
        export_path = data['export_path']
        tables_filter = data.get('tables')  # optional list

        resolved_db_path = _resolve_database_path(database_path)
        if not os.path.exists(resolved_db_path):
            return error_response(f"Database not found at {resolved_db_path}", status_code=404)

        resolved_export_path = _resolve_export_path(export_path)
        os.makedirs(resolved_export_path, exist_ok=True)

        with _open_connection(resolved_db_path) as conn:
            available_tables = _list_tables(conn)
            target_tables = tables_filter or available_tables

            # Validate requested tables
            unknown = [t for t in target_tables if t not in available_tables]
            if unknown:
                return validation_error_response(f"Unknown tables requested: {', '.join(unknown)}")

            exported_files = _export_tables_to_csv(conn, resolved_export_path, target_tables)

        return success_response(
            {"exportPath": resolved_export_path, "files": exported_files},
            message=f"Exported {len(exported_files)} table(s) to {resolved_export_path}"
        )

    except Exception as e:
        return handle_exception(e, "exporting database to CSV", logger)


# Helpers
def _resolve_database_path(database_path: str) -> str:
    """Resolve database path, allowing relative paths from project root."""
    expanded = os.path.expanduser(database_path)
    if os.path.isabs(expanded):
        return expanded

    candidate = os.path.join(PROJECT_ROOT, expanded)
    return candidate if os.path.exists(candidate) else os.path.abspath(expanded)


def _resolve_export_path(export_path: str) -> str:
    """Resolve export path relative to project root when not absolute."""
    expanded = os.path.expanduser(export_path)
    if os.path.isabs(expanded):
        return expanded
    return os.path.join(PROJECT_ROOT, expanded)


def _open_connection(db_path: str) -> sqlite3.Connection:
    """Open a SQLite connection with row factory for dict-like rows."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _list_tables(conn: sqlite3.Connection) -> List[str]:
    """List user tables, skipping SQLite internals."""
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    return [row[0] for row in cursor.fetchall()]


def _get_table_columns(conn: sqlite3.Connection, table_name: str) -> List[Dict[str, str]]:
    """Return column metadata for a table."""
    cursor = conn.execute(f'PRAGMA table_info("{table_name}")')
    columns = []
    for row in cursor.fetchall():
        columns.append({
            "name": row["name"],
            "type": row["type"],
            "notnull": bool(row["notnull"]),
            "default": row["dflt_value"],
            "primary_key": bool(row["pk"])
        })
    return columns


def _get_row_count(conn: sqlite3.Connection, table_name: str) -> int:
    """Return row count for a table."""
    cursor = conn.execute(f'SELECT COUNT(*) as cnt FROM "{table_name}"')
    result = cursor.fetchone()
    return int(result["cnt"]) if result else 0


def _fetch_table_rows(conn: sqlite3.Connection, table_name: str, limit: int) -> Tuple[List[Dict], List[str]]:
    """Fetch up to `limit` rows from a table."""
    cursor = conn.execute(f'SELECT * FROM "{table_name}" LIMIT ?', (limit,))
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description] if cursor.description else []
    data = [dict(row) for row in rows]
    return data, columns


def _build_database_summary(db_path: str) -> Dict:
    """Build a summary of the database: tables, row counts, columns, size, timestamps."""
    with _open_connection(db_path) as conn:
        tables = _list_tables(conn)
        table_summaries = []
        total_rows = 0
        for table in tables:
            row_count = _get_row_count(conn, table)
            total_rows += row_count
            table_summaries.append({
                "name": table,
                "row_count": row_count,
                "columns": _get_table_columns(conn, table)
            })

    stats = os.stat(db_path)
    return {
        "database_path": db_path,
        "size_bytes": stats.st_size,
        "last_modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
        "tables_count": len(tables),
        "total_rows": total_rows,
        "tables": table_summaries
    }


def _coerce_limit(limit_value) -> int:
    """Convert limit to a bounded int."""
    try:
        value = int(limit_value)
    except (TypeError, ValueError):
        value = 1000
    return max(1, min(value, 5000))


def _export_tables_to_csv(conn: sqlite3.Connection, export_dir: str, tables: List[str]) -> List[str]:
    """Export the provided tables to CSV files; returns list of file paths."""
    exported = []
    for table in tables:
        rows, columns = _fetch_table_rows(conn, table, limit=10_000_000)
        file_path = os.path.join(export_dir, f"{table}.csv")
        with open(file_path, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)
        exported.append(file_path)
        logger.info(f"Exported table '{table}' to {file_path} ({len(rows)} rows)")
    return exported
