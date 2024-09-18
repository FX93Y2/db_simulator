import random
from datetime import datetime, timedelta

class Entity:
    def __init__(self, name, config, model_class):
        self.name = name
        self.config = config
        self.model_class = model_class
        self.instances = []
        self.relationships = []

    def generate(self):
        generation_config = self.config.get('generation', {})
        count = generation_config.get('count', 10)  # Default to 10 if not specified
        for _ in range(count):
            self.instances.append(self.generate_instance())

    def generate_instance(self):
        instance_data = {}
        for attr in self.config['attributes']:
            if attr['type'] == 'integer':
                instance_data[attr['name']] = random.randint(1, 1000)
            elif attr['type'] == 'string':
                instance_data[attr['name']] = f"{self.name}_{random.randint(1, 1000)}"
            elif attr['type'] == 'date':
                instance_data[attr['name']] = datetime.now() + timedelta(days=random.randint(-365, 365))
            elif attr['type'] == 'enum':
                instance_data[attr['name']] = random.choice(attr['options'])
        return self.model_class(**instance_data)

    def __str__(self):
        return f"Entity(name={self.name}, instances={len(self.instances)})"

    def __repr__(self):
        return self.__str__()