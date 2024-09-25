class Event:
    def __init__(self, event_type, entity_type, entity_id, time, name, params=None):
        self.type = event_type
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.time = time
        self.name = name
        self.params = params or {}

    def __lt__(self, other):
        """
        Events are ordered in a priority queue
        """
        return self.time < other.time

    def __str__(self):
        return f"Event(type={self.type}, entity_type={self.entity_type}, entity_id={self.entity_id}, time={self.time}, name={self.name})"

    def __repr__(self):
        return self.__str__()