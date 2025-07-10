## Run Test

### Original Probabilistic Transition Model
```console
python python/main.py generate-simulate tests/test_config/demo_db.yaml tests/test_config/demo_sim.yaml --output-dir output --name demo_test
```

### New Event Flows Deterministic Model
```console
python python/main.py generate-simulate tests/test_config/demo_db.yaml tests/test_config/demo_sim_with_decide.yaml --output-dir test_output --name event_flows_demo
```
