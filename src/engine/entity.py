import random
from datetime import datetime, timedelta

class Entity:
    def __init__(self, name, config):
        self.name = name
        self.config = config
        self.instances = []

    def generate(self):
        count = self.config['generation']['count']
        for _ in range(count):
            self.instances.append(self.generate_instance())

    def generate_instance(self):
        instance = {}
        for attr in self.config['attributes']:
            if attr['type'] == 'integer':
                instance[attr['name']] = random.randint(1, 1000)
            elif attr['type'] == 'string':
                instance[attr['name']] = f"{self.name}_{random.randint(1, 1000)}"
            elif attr['type'] == 'date':
                instance[attr['name']] = datetime.now() + timedelta(days=random.randint(-365, 365))
            elif attr['type'] == 'enum':
                instance[attr['name']] = random.choice(attr['options'])
        return instance