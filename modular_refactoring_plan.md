# Modular Refactoring Plan for Simulation Engine

## Current Architecture Analysis

### Current Issues
1. **Monolithic Step Processing**: All step types (event, decide, release) are handled within the main `simulator.py` file
2. **Mixed Responsibilities**: The simulator class handles both orchestration and specific step logic
3. **Limited Extensibility**: Adding new step types requires modifying core simulator code
4. **Code Duplication**: Similar patterns repeated across different step types

### Current Step Processing Flow
```
EventSimulator._process_step()
├── if step_type == "event" → _process_event_step()
├── elif step_type == "decide" → _process_decide_step()  
└── elif step_type == "release" → [minimal inline logic]
```

## Proposed Modular Architecture

### Design Principles
1. **Single Responsibility**: Each step type has its own class with focused responsibilities
2. **Polymorphism**: Common interface for all step processors
3. **Extensibility**: Easy to add new step types without modifying existing code
4. **Testability**: Each step type can be unit tested independently

### New Architecture Overview
```
EventSimulator
├── StepProcessorFactory
│   ├── EventStepProcessor
│   ├── DecideStepProcessor
│   └── ReleaseStepProcessor
└── ResourceManager (unchanged)
```

### Abstract Base Class Design
```python
class StepProcessor(ABC):
    @abstractmethod
    def process(self, entity_id: int, step: Step, flow: EventFlow, 
                entity_table: str, event_table: str) -> Generator[Any, None, Optional[str]]:
        """Process a step and return the next step ID if applicable"""
        pass
    
    @abstractmethod
    def can_handle(self, step_type: str) -> bool:
        """Check if this processor can handle the given step type"""
        pass
```

### Specific Step Processor Classes

#### 1. EventStepProcessor
- **Responsibilities**: Event processing, resource allocation, duration handling
- **Current Code Location**: `simulator.py:410-497`
- **Enhancements**: 
  - Improved resource lifecycle management
  - Better error handling and logging
  - Configurable resource retention options

#### 2. DecideStepProcessor  
- **Responsibilities**: Decision logic, probability evaluation, next step determination
- **Current Code Location**: `simulator.py:499-520`
- **Enhancements**:
  - Fix N-way probability distribution bug
  - Add conditional evaluation framework
  - Support for Arena-standard decision types

#### 3. ReleaseStepProcessor
- **Responsibilities**: Resource cleanup, entity completion, lifecycle termination
- **Current Code Location**: `simulator.py:402-408` (minimal)
- **Enhancements**:
  - Active resource release capability
  - Configurable release strategies
  - Proper lifecycle completion handling

### Factory Pattern Implementation
```python
class StepProcessorFactory:
    def __init__(self, env, engine, resource_manager, entity_manager):
        self.processors = [
            EventStepProcessor(env, engine, resource_manager, entity_manager),
            DecideStepProcessor(env, engine, resource_manager, entity_manager),
            ReleaseStepProcessor(env, engine, resource_manager, entity_manager)
        ]
    
    def get_processor(self, step_type: str) -> StepProcessor:
        for processor in self.processors:
            if processor.can_handle(step_type):
                return processor
        raise ValueError(f"No processor found for step type: {step_type}")
```

## Implementation Plan

### Phase 1: Foundation
1. Create abstract `StepProcessor` base class
2. Create `StepProcessorFactory` 
3. Update simulator to use factory pattern

### Phase 2: Step Processor Implementation
1. Implement `EventStepProcessor` with existing logic
2. Implement `DecideStepProcessor` with bug fixes
3. Implement `ReleaseStepProcessor` with enhanced functionality

### Phase 3: Integration and Testing
1. Refactor main simulator to use modular processors
2. Add comprehensive unit tests for each processor
3. Test end-to-end functionality

### Phase 4: Enhancements
1. Fix decide module N-way probability bug
2. Add conditional evaluation framework
3. Enhance release step with active resource management

## File Structure Changes

### New Files to Create
```
/src/simulation/step_processors/
├── __init__.py
├── base.py                    # Abstract StepProcessor class
├── factory.py                 # StepProcessorFactory  
├── event_processor.py         # EventStepProcessor
├── decide_processor.py        # DecideStepProcessor
└── release_processor.py       # ReleaseStepProcessor
```

### Modified Files
```
/src/simulation/simulator.py   # Refactor to use step processors
/src/simulation/__init__.py    # Add new exports
```

## Benefits of This Architecture

1. **Maintainability**: Each step type is self-contained and easier to modify
2. **Extensibility**: New step types can be added without touching existing code
3. **Testability**: Each processor can be unit tested independently
4. **Code Quality**: Better separation of concerns and reduced complexity
5. **Performance**: Potential for step-specific optimizations
6. **Documentation**: Clearer code structure and responsibilities

## Migration Strategy

1. **Backward Compatibility**: Existing YAML configurations will work unchanged
2. **Gradual Migration**: Old methods will be deprecated but remain functional
3. **Testing**: Comprehensive test suite to ensure no regression
4. **Documentation**: Update architecture documentation and examples

This modular design will transform the simulation engine from a monolithic structure to a flexible, extensible system that's easier to maintain and enhance.