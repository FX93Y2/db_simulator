import sys
from pathlib import Path

import pytest

# Ensure the project src directory is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from src.simulation.processors.trigger.processor import TriggerStepProcessor


def _make_processor():
    """Create a trigger processor with minimal dependencies for helper testing."""
    return TriggerStepProcessor(env=None, engine=None, resource_manager=None,
                                entity_manager=None, event_tracker=None, config=None)


def test_resolve_count_accepts_numeric_strings():
    processor = _make_processor()

    assert processor._resolve_count(4) == 4
    assert processor._resolve_count("7") == 7
    assert processor._resolve_count(" 8 ") == 8
    assert processor._resolve_count("3.0") == 3


def test_resolve_count_uses_distribution_for_formulas(monkeypatch):
    processor = _make_processor()

    calls = {}

    def fake_generate(formula):
        calls['formula'] = formula
        return 4.6

    monkeypatch.setattr(
        'src.distributions.generate_from_distribution',
        fake_generate
    )

    assert processor._resolve_count("UNIF(2,5)") == 5
    assert calls['formula'] == "UNIF(2,5)"


def test_resolve_count_rejects_non_numeric_results(monkeypatch):
    processor = _make_processor()

    def fake_generate(_):
        return "not-a-number"

    monkeypatch.setattr(
        'src.distributions.generate_from_distribution',
        fake_generate
    )

    with pytest.raises(ValueError):
        processor._resolve_count("DISC(0.5, 'A', 0.5, 'B')")


def test_resolve_count_disallows_negative_results(monkeypatch):
    processor = _make_processor()

    def fake_generate(_):
        return -1

    monkeypatch.setattr(
        'src.distributions.generate_from_distribution',
        fake_generate
    )

    with pytest.raises(ValueError):
        processor._resolve_count("UNIF(1,2)")
