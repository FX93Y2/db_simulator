import random

class Relationship:
    def __init__(self, config):
        self.config = config

    def apply(self, entities):
        from_entity = entities[self.config['from']]
        to_entity = entities[self.config['to']]
        
        if self.config['type'] == 'one_to_many':
            for to_instance in to_entity.instances:
                from_instance = random.choice(from_entity.instances)
                setattr(to_instance, self.config['foreign_key'].split('.')[-1], from_instance.id)
                if not hasattr(from_instance, self.config['to'] + 's'):
                    setattr(from_instance, self.config['to'] + 's', [])
                getattr(from_instance, self.config['to'] + 's').append(to_instance)