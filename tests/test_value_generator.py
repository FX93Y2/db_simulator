import pytest
from src.data_generator.value_generator import ValueGenerator
from datetime import datetime

class TestValueGenerator:
    @pytest.fixture
    def generator(self):
        return ValueGenerator()

    def test_discrete_distribution(self, generator):
        """Test discrete distribution generation"""
        config = {
            'type': 'distribution',
            'distribution': 'DISC(0.6, 0.2, 0.2)',
            'choices': ['Developer', 'Tester', 'Tech Lead']
        }
        
        results = {role: 0 for role in config['choices']}
        for _ in range(1000):
            value = generator._generate_from_distribution(config)
            results[value] += 1
            
        total = sum(results.values())
        assert 0.55 <= results['Developer'] / total <= 0.65
        assert 0.15 <= results['Tester'] / total <= 0.25
        assert 0.15 <= results['Tech Lead'] / total <= 0.25

    def test_template_generation(self, generator):
        """Test template-based value generation"""
        config = {
            'type': 'template',
            'template': 'Project_{id}'
        }
        
        value = generator._generate_from_template(config, 1)
        assert value == 'Project_1'

    def test_faker_generation(self, generator):
        """Test faker-based value generation"""
        config = {
            'type': 'faker',
            'method': 'name'
        }
        
        value = generator._generate_faker_value(config)
        assert isinstance(value, str)
        assert len(value) > 0