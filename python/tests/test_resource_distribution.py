
import pytest
from unittest.mock import MagicMock, patch
import sys
import os

# Add python root to path (parent of src)
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.config_parser.sim_parser import ResourceRequirement
from src.simulation.processors.event.processor import EventStepProcessor

class TestResourceDistribution:
    
    @patch('src.simulation.processors.event.processor.generate_from_distribution')
    def test_convert_resource_requirements_string_count(self, mock_generate):

        # Setup
        # Mock generate to return a specific value
        mock_generate.return_value = 2.0
        
        processor = EventStepProcessor(
            env=MagicMock(),
            engine=MagicMock(),
            resource_manager=MagicMock(),
            entity_manager=MagicMock(),
            event_tracker=MagicMock(),
            config=MagicMock()
        )
        
        # Test case: count is a distribution formula string
        reqs = [
            ResourceRequirement(
                resource_table="Doctors",
                value="Cardiologist",
                count="UNIF(2, 2)" # Should trigger distribution logic
            )
        ]
        
        # Execute
        result = processor._convert_resource_requirements(reqs)
        
        # Verify
        assert len(result) == 1
        assert result[0]['count'] == 2
        assert isinstance(result[0]['count'], int)
        
        # Verify extract/generate was called (implicitly by the result being correct based on mock)
        # We can also verify mock calls if we want to be strict
    
    @patch('src.simulation.processors.event.processor.generate_from_distribution')
    def test_convert_resource_requirements_integer_count(self, mock_generate):
        # Setup
        processor = EventStepProcessor(
            env=MagicMock(),
            engine=MagicMock(),
            resource_manager=MagicMock(),
            entity_manager=MagicMock(),
            event_tracker=MagicMock(),
            config=MagicMock()
        )
        
        # Test case: count is already an integer
        reqs = [
            ResourceRequirement(
                resource_table="Nurses",
                value="General",
                count=5
            )
        ]
        
        # Execute
        result = processor._convert_resource_requirements(reqs)
        
        # Verify
        assert len(result) == 1
        assert result[0]['count'] == 5
        # Ensure generate was NOT called
        mock_generate.assert_not_called()

    @patch('src.simulation.processors.event.processor.generate_from_distribution')
    def test_convert_resource_requirements_rounding(self, mock_generate):

        # Setup
        mock_generate.return_value = 3.6
        
        processor = EventStepProcessor(
            env=MagicMock(),
            engine=MagicMock(),
            resource_manager=MagicMock(),
            entity_manager=MagicMock(),
            event_tracker=MagicMock(),
            config=MagicMock()
        )
        
        reqs = [
            ResourceRequirement(
                resource_table="Staff",
                value="Support",
                count="NORM(3, 1)"
            )
        ]
        
        # Execute
        result = processor._convert_resource_requirements(reqs)
        
        # Verify rounding (3.6 -> 4)
        assert result[0]['count'] == 4
