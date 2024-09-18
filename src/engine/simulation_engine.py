import yaml
from .entity import Entity
from .relationship import Relationship
from .rule import Rule
from ..generators.schema_generator import SchemaGenerator

class SimulationEngine:
    def __init__(self, config_path):
        with open(config_path, 'r') as config_file:
            self.config = yaml.safe_load(config_file)
        self.entities = {}
        self.relationships = []
        self.rules = []
        self.schema_generator = SchemaGenerator(self.config)
        self.Base, self.models = self.schema_generator.generate_models()

    def load_config(self):
        print("Loading entities...")
        for entity_name, entity_config in self.config.get('entities', {}).items():
            print(f"  Creating entity: {entity_name}")
            model_class = self.models[entity_name]
            self.entities[entity_name] = Entity(entity_name, entity_config, model_class)
        
        print("\nLoading relationships...")
        relationships = self.config.get('relationships', [])
        if not isinstance(relationships, list):
            print(f"Error: 'relationships' should be a list, but got: {type(relationships)}")
            print(f"Relationships content: {relationships}")
            return

        for rel_config in relationships:
            if not isinstance(rel_config, dict):
                print(f"Error: Each relationship should be a dictionary, but got: {type(rel_config)}")
                print(f"Relationship content: {rel_config}")
                continue

            if 'from' not in rel_config or 'to' not in rel_config:
                print(f"Error: Relationship is missing 'from' or 'to' key: {rel_config}")
                continue

            print(f"  Creating relationship: {rel_config['from']} -> {rel_config['to']}")
            relationship = Relationship(rel_config)
            self.relationships.append(relationship)
            self.entities[rel_config['from']].relationships.append(rel_config)
            self.entities[rel_config['to']].relationships.append(rel_config)
        
        print("\nLoading rules...")
        for rule_config in self.config.get('rules', []):
            print(f"  Creating rule: {rule_config.get('name', 'Unnamed')}")
            self.rules.append(Rule(rule_config))

    def run_simulation(self):
        print("\nGenerating entities...")
        for entity_name, entity in self.entities.items():
            print(f"  Generating instances for: {entity_name}")
            entity.generate()
            print(f"    Generated {len(entity.instances)} instances")

        print("\nApplying relationships...")
        for relationship in self.relationships:
            print(f"  Applying relationship: {relationship.config['from']} -> {relationship.config['to']}")
            relationship.apply(self.entities)

        print("\nApplying rules...")
        for rule in self.rules:
            print(f"  Applying rule: {rule.config.get('name', 'Unnamed')}")
            rule.apply(self.entities)

    def get_simulated_data(self):
        return {name: entity.instances for name, entity in self.entities.items()}