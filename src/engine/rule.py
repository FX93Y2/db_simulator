class Rule:
    def __init__(self, config):
        self.config = config

    def apply(self, entities):
        target_entity = entities[self.config['target']]
        for instance in target_entity.instances:
            exec(self.config['logic'], globals(), {'project': instance})