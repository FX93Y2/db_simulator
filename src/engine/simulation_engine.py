import yaml
from .entity import Entity
from .relationship import Relationship
from .rule import Rule

class SimulationEngine:
    def __init__(self, config_path):
        with open(config_path, 'r') as config_file:
            self.config = yaml.safe_load(config_file)
        self.entities = {}
        self.relationships = []
        self.rules = []

    def load_config(self):
        for entity_name, entity_config in self.config['entities'].items():
            self.entities[entity_name] = Entity(entity_name, entity_config)
        
        for rel_config in self.config.get('relationships', []):
            self.relationships.append(Relationship(rel_config))
        
        for rule_config in self.config.get('rules', []):
            self.rules.append(Rule(rule_config))

    def run_simulation(self):
        for entity in self.entities.values():
            entity.generate()

        for relationship in self.relationships:
            relationship.apply(self.entities)

        for rule in self.rules:
            rule.apply(self.entities)

    def get_simulated_data(self):
        return {name: entity.instances for name, entity in self.entities.items()}