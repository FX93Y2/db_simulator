class Rule:
    def __init__(self, config):
        self.config = config

    def apply(self, entities):
        target_entity = entities[self.config['target']]
        for instance in target_entity.instances:
            context = {
                'self': instance,
                'entities': entities
            }
            for relationship in entities[self.config['target']].relationships:
                related_entity_name = relationship['to']
                if relationship['type'] == 'one_to_many':
                    foreign_key = relationship['foreign_key'].split('.')[-1]
                    context[related_entity_name] = [
                        related_instance for related_instance in entities[related_entity_name].instances
                        if getattr(related_instance, foreign_key) == instance.id
                    ]
                elif relationship['type'] == 'many_to_one':
                    foreign_key = relationship['foreign_key'].split('.')[-1]
                    related_instance = next(
                        (related_instance for related_instance in entities[related_entity_name].instances
                         if related_instance.id == getattr(instance, foreign_key)),
                        None
                    )
                    context[related_entity_name] = related_instance
                    
            rule_logic = self.config['logic'].replace("['", ".").replace("']", "")
            exec(rule_logic, globals(), context)