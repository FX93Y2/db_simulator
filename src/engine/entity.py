from datetime import datetime, timedelta
import random

class Entity:
    def __init__(self, name, config, model_class):
        self.name = name
        self.config = config
        self.model_class = model_class
        self.instances = []
        self.relationships = []
        self.id_counter = 1

    def generate(self):
        generation_config = self.config.get('generation', {})
        count = generation_config.get('count', 10)  # Default to 10 if not specified
        for _ in range(count):
            self.instances.append(self.generate_instance())

    def generate_instance(self):
        instance_data = {}
        for attr in self.config['attributes']:
            if attr['name'] == 'id':
                instance_data[attr['name']] = self.id_counter
                self.id_counter += 1
            elif attr['type'] == 'integer':
                if 'foreign_key' in attr:
                    # Skip foreign keys, they'll be set when applying relationships
                    continue
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