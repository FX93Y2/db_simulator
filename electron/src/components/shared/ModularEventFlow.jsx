import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/diagrams.css';
import useResourceDefinitions from '../../hooks/useResourceDefinitions';
import { nodeTypes } from './flow-nodes/FlowNodeComponents';
import NodeEditModal from './flow-nodes/NodeEditModal';
import { 
  generateSchemaId,
  buildNodesFromFlow,
  buildEdgesFromFlow,
  isUserTyping
} from './flow-nodes/flowUtils';
import {
  handleStepConnection,
  handleEdgeDeletion,
  validateConnection,
  connectionExists
} from './flow-nodes/EventFlowConnectionHandler';

const ModularEventFlow = forwardRef(({ yamlContent, parsedSchema, onDiagramChange, theme, dbConfigContent, projectId }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Canonical step state - this is now the source of truth
  const [canonicalSteps, setCanonicalSteps] = useState([]);
  const [flowSchema, setFlowSchema] = useState(null);
  
  const [schemaId, setSchemaId] = useState(null);
  const [layoutMap, setLayoutMap] = useState({});
  const [initialized, setInitialized] = useState(false);
  const containerRef = useRef(null);
  const currentNodesRef = useRef([]);
  
  // Track if we're updating from internal canvas operations
  const internalUpdateRef = useRef(false);
  
  // Track loading states to fix React hydration issues
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const hasProcessedSchemaRef = useRef(false);
  const localStorageLoadedRef = useRef(false);
  
  // Use the custom hook to get resource definitions from database config
  const resourceDefinitions = useResourceDefinitions(dbConfigContent);

  // Update the ref whenever nodes change (but only after initial load)
  useEffect(() => {
    // Don't update currentNodesRef during initial load to prevent stale positions
    if (!isInitialLoad) {
      currentNodesRef.current = nodes;
      console.log('[ModularEventFlow] 📍 Updated currentNodesRef with', nodes.length, 'nodes (post-initial-load)');
    } else {
      console.log('[ModularEventFlow] ⏳ Skipping currentNodesRef update during initial load');
    }
  }, [nodes, isInitialLoad]);

  // Direct step manipulation methods - Canvas is source of truth
  const addStep = useCallback((stepData) => {
    console.log('[ModularEventFlow] Adding step directly:', stepData);
    
    // Calculate viewport-centered position for new step
    let newPosition;
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      
      // Add some randomness to avoid stacking steps exactly on top of each other
      const offsetX = (canonicalSteps.length % 3 - 1) * 50; // -50, 0, 50
      const offsetY = Math.floor(canonicalSteps.length / 3) * 50; // 0, 50, 100, etc.
      
      newPosition = {
        x: Math.max(50, centerX - 100 + offsetX), // Ensure minimum x of 50
        y: Math.max(50, centerY - 100 + offsetY)  // Ensure minimum y of 50
      };
      
      console.log('[ModularEventFlow] New step positioned at viewport center:', newPosition);
    } else {
      // Fallback to old positioning if container not available
      const maxY = canonicalSteps.reduce((max, step) => {
        const position = layoutMap[step.step_id] || { y: 0 };
        return Math.max(max, position.y);
      }, 0);
      
      newPosition = {
        x: 50 + (canonicalSteps.length % 3) * 300,
        y: maxY + 300
      };
      
      console.log('[ModularEventFlow] New step positioned with fallback method:', newPosition);
    }
    
    // Add to canonical steps
    const newStep = {
      ...stepData,
      position: newPosition
    };
    
    setCanonicalSteps(prev => [...prev, newStep]);
    
    // Update layout map
    setLayoutMap(prev => ({
      ...prev,
      [stepData.step_id]: newPosition
    }));
    
    // Set internal update flag to prevent YAML sync loops
    internalUpdateRef.current = true;
    
    return newStep;
  }, [canonicalSteps, layoutMap]);

  const updateStep = useCallback((stepId, newData) => {
    console.log('[ModularEventFlow] Updating step:', stepId, newData);
    
    // Check if step_id is changing
    const isIdChanging = newData.step_id && newData.step_id !== stepId;
    
    setCanonicalSteps(prev => prev.map(step => 
      step.step_id === stepId 
        ? { 
            ...step, 
            ...newData, 
            position: step.position // Preserve position
          }
        : step
    ));
    
    // If step_id is changing, update the layoutMap key to preserve position
    if (isIdChanging) {
      setLayoutMap(prev => {
        const currentPosition = prev[stepId];
        if (currentPosition) {
          const newLayout = { ...prev };
          // Add position under new step_id
          newLayout[newData.step_id] = currentPosition;
          // Remove old step_id entry
          delete newLayout[stepId];
          console.log('[ModularEventFlow] Updated layoutMap key:', stepId, '->', newData.step_id, 'position:', currentPosition);
          return newLayout;
        }
        return prev;
      });
    }
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, []);

  const deleteStep = useCallback((stepId) => {
    console.log('[ModularEventFlow] Deleting step:', stepId);
    
    // Remove from canonical steps
    setCanonicalSteps(prev => prev.filter(step => step.step_id !== stepId));
    
    // Remove from layout map
    setLayoutMap(prev => {
      const newLayout = { ...prev };
      delete newLayout[stepId];
      return newLayout;
    });
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, []);

  const generateYAML = useCallback(() => {
    console.log('[ModularEventFlow] Generating YAML from canonical steps');
    
    if (!flowSchema || canonicalSteps.length === 0) {
      return null;
    }
    
    const updatedSchema = {
      ...flowSchema,
      event_simulation: {
        ...flowSchema.event_simulation,
        event_flows: [{
          ...flowSchema.event_simulation.event_flows[0],
          steps: canonicalSteps.map(step => {
            const { position, ...stepWithoutPosition } = step;
            return stepWithoutPosition;
          })
        }]
      }
    };
    
    return updatedSchema;
  }, [canonicalSteps, flowSchema]);

  // Utility function to detect step changes
  const detectStepChanges = useCallback((oldSteps, newSteps) => {
    const oldIds = new Set(oldSteps.map(s => s.step_id));
    const newIds = new Set(newSteps.map(s => s.step_id));
    
    const added = newSteps.filter(s => !oldIds.has(s.step_id));
    const deleted = oldSteps.filter(s => !newIds.has(s.step_id));
    const modified = newSteps.filter(s => {
      const oldStep = oldSteps.find(old => old.step_id === s.step_id);
      if (!oldStep) return false;
      
      // Deep comparison of step properties (excluding position)
      const oldClean = { ...oldStep };
      delete oldClean.position;
      const newClean = { ...s };
      delete newClean.position;
      
      return JSON.stringify(oldClean) !== JSON.stringify(newClean);
    });
    
    return { added, deleted, modified };
  }, []);

  // Handle YAML changes from external sources (like YAML editor)
  const handleYAMLChange = useCallback((newSchema) => {
    console.log('[ModularEventFlow] 📝 YAML CHANGE DETECTED');
    console.log('[ModularEventFlow] Current canonical steps count:', canonicalSteps.length);
    console.log('[ModularEventFlow] Current layoutMap keys:', Object.keys(layoutMap));
    console.log('[ModularEventFlow] Current layoutMap data:', layoutMap);
    
    if (!newSchema?.event_simulation?.event_flows) {
      console.log('[ModularEventFlow] No event flows in schema, clearing steps');
      setCanonicalSteps([]);
      return;
    }
    
    const eventFlows = newSchema.event_simulation.event_flows;
    if (eventFlows.length === 0) {
      console.log('[ModularEventFlow] Empty event flows, clearing steps');
      setCanonicalSteps([]);
      return;
    }
    
    // Use first flow for now
    const flow = eventFlows[0];
    const newSteps = flow.steps || [];
    
    if (newSteps.length === 0) {
      console.log('[ModularEventFlow] WARNING: Empty steps detected!');
      
      // Don't clear steps if we currently have steps - this prevents accidental clearing
      if (canonicalSteps.length > 0) {
        console.log('[ModularEventFlow] PREVENTING canvas clear - keeping existing', canonicalSteps.length, 'steps');
        return;
      }
      
      console.log('[ModularEventFlow] No existing steps, clearing canvas');
      setCanonicalSteps([]);
      return;
    }
    
    // Capture current node positions from ReactFlow (highest priority)
    const currentPositions = {};
    currentNodesRef.current.forEach(node => {
      currentPositions[node.id] = node.position;
    });
    console.log('[ModularEventFlow] 📍 Current ReactFlow positions:', currentPositions);
    
    // Also capture positions from existing canonical steps
    const existingPositions = {};
    canonicalSteps.forEach(step => {
      if (step.position) {
        existingPositions[step.step_id] = step.position;
      }
    });
    console.log('[ModularEventFlow] 📄 Existing canonical positions:', existingPositions);
    console.log('[ModularEventFlow] 💾 Available localStorage positions:', layoutMap);
    
    // Detect what changed
    const changes = detectStepChanges(canonicalSteps, newSteps);
    console.log('[ModularEventFlow] Detected changes:', {
      added: changes.added.length,
      deleted: changes.deleted.length,
      modified: changes.modified.length
    });
    
    // Apply changes while preserving positions - FIXED priority logic
    const updatedSteps = newSteps.map((step, index) => {
      const currentPosition = currentPositions[step.step_id];
      const existingPosition = existingPositions[step.step_id];
      const savedPosition = layoutMap[step.step_id];
      
      let finalPosition;
      
      if (isInitialLoad && localStorageLoadedRef.current && savedPosition) {
        // 🔑 CRITICAL FIX: On initial load, localStorage takes absolute priority
        finalPosition = savedPosition;
        console.log('[ModularEventFlow] 🚀 INITIAL LOAD: Using localStorage position for', step.step_id, ':', savedPosition);
      } else if (currentPosition) {
        // During active session, current ReactFlow position takes priority
        finalPosition = currentPosition;
        console.log('[ModularEventFlow] 📍 SESSION: Using current ReactFlow position for', step.step_id, ':', currentPosition);
      } else if (savedPosition) {
        // 🔑 CRITICAL FIX: Prioritize localStorage over canonical positions when ReactFlow is empty (project switching)
        finalPosition = savedPosition;
        console.log('[ModularEventFlow] 💾 PRIORITY: Using localStorage position for', step.step_id, ':', savedPosition);
      } else if (existingPosition) {
        // Use existing canonical position if available
        finalPosition = existingPosition;
        console.log('[ModularEventFlow] 📄 EXISTING: Using existing canonical position for', step.step_id, ':', existingPosition);
      } else {
        // Default grid layout for truly new steps
        finalPosition = {
          x: 100 + (index % 3) * 300,
          y: 100 + Math.floor(index / 3) * 200
        };
        console.log('[ModularEventFlow] ✨ NEW: Assigning default position for new step', step.step_id, ':', finalPosition);
      }
      
      return {
        ...step,
        position: finalPosition
      };
    });
    
    // Only update canonical steps if there are actual differences
    const currentStepsWithoutPosition = canonicalSteps.map(s => {
      const { position, ...stepWithoutPosition } = s;
      return stepWithoutPosition;
    });
    
    const newStepsWithoutPosition = updatedSteps.map(s => {
      const { position, ...stepWithoutPosition } = s;
      return stepWithoutPosition;
    });
    
    if (JSON.stringify(currentStepsWithoutPosition) !== JSON.stringify(newStepsWithoutPosition) ||
        canonicalSteps.length !== updatedSteps.length) {
      console.log('[ModularEventFlow] Updating canonical steps to:', updatedSteps.length, 'steps (structural changes detected)');
      setCanonicalSteps(updatedSteps);
      
      // Clear initial load flag after first successful load
      if (isInitialLoad) {
        console.log('[ModularEventFlow] ✅ Initial load complete, clearing isInitialLoad flag');
        setIsInitialLoad(false);
      }
    } else {
      console.log('[ModularEventFlow] No structural changes detected, keeping existing canonical steps with their positions');
      // Just update the flow schema for compatibility
      setFlowSchema(newSchema);
      
      // Clear initial load flag even if no structural changes
      if (isInitialLoad) {
        console.log('[ModularEventFlow] ✅ Initial load complete (no changes), clearing isInitialLoad flag');
        setIsInitialLoad(false);
      }
      return;
    }
    
    // Update flowSchema for compatibility
    setFlowSchema(newSchema);
    
    // Update layout map with current positions for localStorage persistence
    const newLayoutMap = { ...layoutMap };
    let layoutChanged = false;
    updatedSteps.forEach(step => {
      if (step.position) {
        const existing = newLayoutMap[step.step_id];
        if (!existing || existing.x !== step.position.x || existing.y !== step.position.y) {
          newLayoutMap[step.step_id] = step.position;
          layoutChanged = true;
        }
      }
    });
    
    if (layoutChanged) {
      console.log('[ModularEventFlow] Updating layoutMap with new positions, triggering localStorage save');
      setLayoutMap(newLayoutMap);
    }
    
  }, [canonicalSteps, layoutMap, detectStepChanges]);

  // Use layout effect to ensure container is measured before rendering (COPIED FROM ERDIAGRAM)
  useLayoutEffect(() => {
    if (containerRef.current) {
      console.log('[ModularEventFlow] Container dimensions:', {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
        clientWidth: containerRef.current.clientWidth,
        clientHeight: containerRef.current.clientHeight
      });
      setInitialized(true);
    }
  }, []);


  // Generate stable schema ID (copied from ER Diagram approach)
  useEffect(() => {
    if (yamlContent && typeof yamlContent === 'string') {
      try {
        // Use first 100 characters of YAML content for stable ID (like ER Diagram)
        const yamlPrefix = yamlContent.substring(0, 100).replace(/\s+/g, '');
        let stableId = '';
        
        // Simple hash function to create a stable ID (same as ER Diagram)
        for (let i = 0; i < yamlPrefix.length; i++) {
          stableId += yamlPrefix.charCodeAt(i);
        }
        
        // Use proper project ID for isolation
        const projectIdentifier = projectId || 'default';
        const id = `modular_flow_positions_${projectIdentifier}_${stableId}`;
        
        console.log('[ModularEventFlow] 🔑 PROJECT ID DEBUG:', projectId);
        console.log('[ModularEventFlow] 🔑 PROJECT IDENTIFIER:', projectIdentifier);
        console.log('[ModularEventFlow] 🔑 STABLE ID HASH:', stableId);
        console.log('[ModularEventFlow] Generated stable schema ID:', id);
        console.log('[ModularEventFlow] YAML prefix used:', yamlPrefix.substring(0, 50) + '...');
        
        // Reset loading states when schema ID changes (new project/content)
        if (schemaId && schemaId !== id) {
          console.log('[ModularEventFlow] 🔄 Schema change detected, resetting loading states');
          setIsInitialLoad(true);
          hasProcessedSchemaRef.current = false;
          localStorageLoadedRef.current = false;
        }
        
        setSchemaId(id);
      } catch (error) {
        console.error('[ModularEventFlow] Error generating schema ID:', error);
      }
    } else if (yamlContent && typeof yamlContent !== 'string') {
      console.warn('[ModularEventFlow] yamlContent is not a string, received:', typeof yamlContent);
    }
  }, [yamlContent]);

  // Load layout map from localStorage immediately when schema ID is available
  useEffect(() => {
    if (schemaId) {
      try {
        const saved = localStorage.getItem(schemaId);
        if (saved) {
          const savedPositions = JSON.parse(saved);
          console.log('[ModularEventFlow] ✅ INITIAL LOAD: Loaded', Object.keys(savedPositions).length, 'positions from localStorage for schema:', schemaId);
          console.log('[ModularEventFlow] 📍 Saved positions:', savedPositions);
          
          setLayoutMap(savedPositions);
          localStorageLoadedRef.current = true;
        } else {
          console.log('[ModularEventFlow] ⚠️ INITIAL LOAD: No saved positions found for schema:', schemaId);
          setLayoutMap({});
          localStorageLoadedRef.current = true;
        }
      } catch (err) {
        console.error('[ModularEventFlow] ❌ INITIAL LOAD: Error loading positions from localStorage:', err);
        setLayoutMap({});
        localStorageLoadedRef.current = true;
      }
    }
  }, [schemaId]);

  // Debounced save to localStorage with enhanced debugging
  const debounceRef = useRef();
  const saveLayoutToLocalStorage = useCallback((layout, key) => {
    if (!key) {
      console.warn('[ModularEventFlow] ⚠️ Cannot save - no key provided');
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const jsonData = JSON.stringify(layout);
        localStorage.setItem(key, jsonData);
        console.log('[ModularEventFlow] ✅ Successfully saved to localStorage with key:', key);
        console.log('[ModularEventFlow] 💾 Data saved:', jsonData);
        
        // Verify the save by reading it back
        const verification = localStorage.getItem(key);
        if (verification === jsonData) {
          console.log('[ModularEventFlow] ✅ Save verification successful');
        } else {
          console.error('[ModularEventFlow] ❌ Save verification failed!');
        }
      } catch (err) {
        console.error('[ModularEventFlow] ❌ Error saving layout to localStorage:', err);
      }
    }, 300);
  }, []);

  // Save layout to localStorage with proper debouncing
  useEffect(() => {
    if (schemaId && Object.keys(layoutMap).length > 0) {
      console.log('[ModularEventFlow] 💾 SAVING', Object.keys(layoutMap).length, 'positions to localStorage for schema:', schemaId);
      console.log('[ModularEventFlow] 📍 Positions being saved:', layoutMap);
      saveLayoutToLocalStorage(layoutMap, schemaId);
    } else if (schemaId) {
      console.log('[ModularEventFlow] ⚠️ No positions to save for schema:', schemaId);
    }
  }, [layoutMap, schemaId, saveLayoutToLocalStorage]);

  // Update visual nodes and edges from canonical steps
  useEffect(() => {
    console.log('[ModularEventFlow] Updating visual nodes from canonical steps:', canonicalSteps.length);
    console.log('[ModularEventFlow] Current canonical steps:', canonicalSteps.map(s => s.step_id));
    
    if (canonicalSteps.length === 0) {
      console.log('[ModularEventFlow] WARNING: Setting nodes and edges to empty arrays!');
      setNodes([]);
      setEdges([]);
      return;
    }

    // Build visual nodes directly from canonical steps with their stored positions
    const visualNodes = canonicalSteps.map(step => {
      const nodeType = step.step_type === 'event' ? 'process' :
                      step.step_type === 'decide' ? 'decide' :
                      step.step_type === 'assign' ? 'assign' :
                      step.step_type === 'release' ? 'release' : 'process';
      
      // Use the position stored in the canonical step
      const position = step.position || { x: 100, y: 100 };
      
      return {
        id: step.step_id,
        type: nodeType,
        position: position,
        data: {
          label: step.step_id,
          stepConfig: step,
          theme: theme
        }
      };
    });
    
    // Build edges from canonical steps
    const visualEdges = [];
    canonicalSteps.forEach(step => {
      if (step.step_type === 'decide' && step.decide_config?.outcomes) {
        step.decide_config.outcomes.forEach((outcome, index) => {
          if (outcome.next_step_id) {
            visualEdges.push({
              id: `${step.step_id}-${outcome.next_step_id}`,
              source: step.step_id,
              target: outcome.next_step_id,
              sourceHandle: `outcome-${index}`,
              type: 'smoothstep',
              markerEnd: { type: 'arrowclosed' },
              style: { stroke: '#ed8936', strokeWidth: 2 }
            });
          }
        });
      } else if (step.next_steps && step.next_steps.length > 0) {
        step.next_steps.forEach(nextStepId => {
          visualEdges.push({
            id: `${step.step_id}-${nextStepId}`,
            source: step.step_id,
            target: nextStepId,
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' },
            style: { stroke: '#38a169', strokeWidth: 2 }
          });
        });
      }
    });

    // Always update nodes and edges directly
    console.log('[ModularEventFlow] Updating visual representation with', visualNodes.length, 'nodes and', visualEdges.length, 'edges');
    setNodes(visualNodes);
    setEdges(visualEdges);
    
    // Notify parent of changes if this was an internal update
    if (internalUpdateRef.current && onDiagramChange && flowSchema) {
      const generatedSchema = generateYAML();
      if (generatedSchema) {
        console.log('[ModularEventFlow] Notifying parent of internal changes');
        // Set a timeout to reset the flag after the parent processes the change
        setTimeout(() => {
          console.log('[ModularEventFlow] Resetting internal update flag after timeout');
          internalUpdateRef.current = false;
        }, 200);
        onDiagramChange(generatedSchema);
      } else {
        internalUpdateRef.current = false;
      }
    }
  }, [canonicalSteps, layoutMap, theme, onDiagramChange, generateYAML, flowSchema]);

  // Handle external YAML updates (with guards against double processing)
  useEffect(() => {
    console.log('[ModularEventFlow] 🔄 YAML UPDATE EFFECT TRIGGERED');
    console.log('[ModularEventFlow] internalUpdateRef.current:', internalUpdateRef.current);
    console.log('[ModularEventFlow] parsedSchema exists:', !!parsedSchema);
    console.log('[ModularEventFlow] layoutMap available:', Object.keys(layoutMap).length, 'positions');
    console.log('[ModularEventFlow] isInitialLoad:', isInitialLoad);
    console.log('[ModularEventFlow] localStorageLoadedRef.current:', localStorageLoadedRef.current);
    
    // Always skip if this was triggered by our internal changes
    if (internalUpdateRef.current) {
      console.log('[ModularEventFlow] ⏭️ SKIPPING - internal change in progress');
      return;
    }
    
    // Skip if we're in initial load but localStorage hasn't loaded yet
    if (isInitialLoad && !localStorageLoadedRef.current) {
      console.log('[ModularEventFlow] ⏳ WAITING - initial load but localStorage not ready yet');
      return;
    }
    
    // 🔑 CRITICAL FIX: Skip if we expect localStorage positions but layoutMap hasn't been updated yet
    if (isInitialLoad && localStorageLoadedRef.current && schemaId) {
      const saved = localStorage.getItem(schemaId);
      if (saved && Object.keys(layoutMap).length === 0) {
        console.log('[ModularEventFlow] ⏳ WAITING - localStorage has positions but layoutMap not yet populated');
        return;
      }
    }
    
    if (parsedSchema) {
      console.log('[ModularEventFlow] ▶️ PROCESSING external YAML update');
      handleYAMLChange(parsedSchema);
    }
  }, [parsedSchema, handleYAMLChange, layoutMap, isInitialLoad]);

  // Memoized imperative methods to prevent recreation on every render
  const imperativeMethods = useMemo(() => ({
    addStep,
    updateStep,
    deleteStep,
    generateYAML,
    handleYAMLChange,
    getCanonicalSteps: () => canonicalSteps
  }), [addStep, updateStep, deleteStep, generateYAML, handleYAMLChange, canonicalSteps]);
  
  // Expose methods to parent components
  useImperativeHandle(ref, () => imperativeMethods, [imperativeMethods]);

  const onConnect = useCallback((params) => {
    console.log('[ModularEventFlow] Connection attempt:', params);
    
    // Validate connection
    if (!validateConnection(params, canonicalSteps)) {
      console.warn('[ModularEventFlow] Invalid connection attempt');
      return;
    }
    
    // Check if connection already exists
    if (connectionExists(params, canonicalSteps)) {
      console.log('[ModularEventFlow] Connection already exists, ignoring');
      return;
    }
    
    // Add visual edge
    const newEdge = {
      ...params,
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' },
      style: { stroke: '#38a169', strokeWidth: 2 }
    };
    setEdges((eds) => addEdge(newEdge, eds));

    // Use the enhanced connection handler
    handleStepConnection(
      params, 
      canonicalSteps, 
      (newSteps) => {
        // Update canonical steps
        setCanonicalSteps(newSteps);
        
        // Set flag to prevent circular update
        internalUpdateRef.current = true;
      }
    );
    
  }, [canonicalSteps]);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  const onNodeDoubleClick = useCallback((_event, node) => {
    setSelectedNode(node);
    setShowEditModal(true);
  }, []);

  // Handle keyboard shortcuts
  const onKeyDown = useCallback((event) => {
    // Don't handle keyboard shortcuts if user is typing in an input field
    if (isUserTyping()) {
      return; // Let the input field handle the keyboard event
    }
    
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
      onNodesDelete([selectedNode]);
      setSelectedNode(null);
    }
  }, [selectedNode, onNodesDelete]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  const handleNodeUpdate = useCallback((updatedNode) => {
    const oldNodeId = selectedNode?.id;
    const newNodeId = updatedNode.id;
    
    console.log('[ModularEventFlow] Handling node update:', oldNodeId, '->', newNodeId);
    
    // Update canonical steps with new node data
    setCanonicalSteps(prev => {
      let updatedSteps = prev.map(step => {
        if (step.step_id === oldNodeId) {
          return {
            ...updatedNode.data.stepConfig,
            position: step.position // Preserve position
          };
        }
        return step;
      });
      
      // Update references to this step in other steps if ID changed
      if (oldNodeId !== newNodeId) {
        updatedSteps = updatedSteps.map(step => {
          let updatedStep = { ...step };
          
          // Update next_steps references
          if (step.next_steps) {
            updatedStep.next_steps = step.next_steps.map(id => id === oldNodeId ? newNodeId : id);
          }
          
          // Update decide outcomes references
          if (step.decide_config?.outcomes) {
            updatedStep.decide_config = {
              ...step.decide_config,
              outcomes: step.decide_config.outcomes.map(outcome => ({
                ...outcome,
                next_step_id: outcome.next_step_id === oldNodeId ? newNodeId : outcome.next_step_id
              }))
            };
          }
          
          return updatedStep;
        });
        
        // Update layout map key if step ID changed
        setLayoutMap(prev => {
          const currentPosition = prev[oldNodeId];
          if (currentPosition) {
            const newLayout = { ...prev };
            newLayout[newNodeId] = currentPosition;
            delete newLayout[oldNodeId];
            return newLayout;
          }
          return prev;
        });
      }
      
      return updatedSteps;
    });
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, [selectedNode]);

  // Handle node drag end - update canonical steps positions immediately
  const onNodeDragStop = useCallback((_event, node) => {
    console.log('[ModularEventFlow] 👍 DRAG END:', node.id, 'to position:', node.position);
    
    // Update the position in canonical steps immediately
    setCanonicalSteps(prev => prev.map(step => 
      step.step_id === node.id 
        ? { ...step, position: node.position }
        : step
    ));
    
    // Also update the visual nodes to reflect the change
    setNodes(nds => nds.map(n => 
      n.id === node.id ? { ...n, position: node.position } : n
    ));
    
    // Update layout map for immediate localStorage save (triggers the debounced save effect)
    setLayoutMap(prev => {
      const newLayoutMap = {
        ...prev,
        [node.id]: { ...node.position }
      };
      console.log('[ModularEventFlow] 📍 Updated layoutMap for', node.id, ', total positions:', Object.keys(newLayoutMap).length);
      console.log('[ModularEventFlow] 🚀 This will trigger localStorage save effect');
      return newLayoutMap;
    });
  }, []);

  const onNodesDelete = useCallback((deletedNodes) => {
    const deletedIds = deletedNodes.map(n => n.id);
    console.log('[ModularEventFlow] Deleting nodes:', deletedIds);
    
    // Update canonical steps - remove deleted steps and clean up references
    setCanonicalSteps(prev => {
      // Remove deleted steps
      let remainingSteps = prev.filter(step => !deletedIds.includes(step.step_id));
      
      // Clean up references in remaining steps
      remainingSteps = remainingSteps.map(step => {
        let updatedStep = { ...step };
        
        if (step.next_steps) {
          updatedStep.next_steps = step.next_steps.filter(id => !deletedIds.includes(id));
        }
        
        if (step.decide_config?.outcomes) {
          // Remove outcomes that reference deleted steps entirely
          updatedStep.decide_config = {
            ...step.decide_config,
            outcomes: step.decide_config.outcomes.filter(outcome => 
              !deletedIds.includes(outcome.next_step_id)
            )
          };
          
          // Rebalance probabilities for remaining outcomes
          if (updatedStep.decide_config.outcomes.length > 0) {
            const equalProbability = 1 / updatedStep.decide_config.outcomes.length;
            updatedStep.decide_config.outcomes.forEach(outcome => {
              outcome.conditions.forEach(condition => {
                if (condition.if && condition.if.toLowerCase() === 'probability') {
                  condition.value = equalProbability;
                }
              });
            });
          }
        }
        
        return updatedStep;
      });
      
      return remainingSteps;
    });
    
    // Remove deleted node positions from layoutMap
    setLayoutMap(prev => {
      const newLayout = { ...prev };
      deletedIds.forEach(id => {
        delete newLayout[id];
      });
      return newLayout;
    });
    
    // Set internal update flag
    internalUpdateRef.current = true;
  }, []);

  // Handle edge deletion with automatic connection removal
  const onEdgesDelete = useCallback((deletedEdges) => {
    console.log('[ModularEventFlow] Edge deletion:', deletedEdges);
    
    if (canonicalSteps && deletedEdges.length > 0) {
      handleEdgeDeletion(
        deletedEdges,
        canonicalSteps,
        (newSteps) => {
          // Update canonical steps
          setCanonicalSteps(newSteps);
          
          // Set flag to prevent circular update
          internalUpdateRef.current = true;
        }
      );
    }
  }, [canonicalSteps]);

  // If not initialized, just show the container to get dimensions (COPIED FROM ERDIAGRAM)
  if (!initialized) {
    return (
      <div 
        ref={containerRef} 
        className="modular-event-flow event-flow-container" 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: '4px',
          overflow: 'hidden'
        }} 
      />
    );
  }

  return (
    <div ref={containerRef} className="modular-event-flow event-flow-container" style={{ width: '100%', height: '100%' }}>
      {initialized && (
        <div id="modular-event-flow-wrapper" style={{ width: '100%', height: '100%' }}>
          <ReactFlow
          id="modular-event-flow-instance" 
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={[20, 20]}
          fitView
          attributionPosition="bottom-right"
          nodesDraggable={true}
          elementsSelectable={true}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background 
            key="modular-event-flow-background"
            variant="dots" 
            gap={12} 
            size={1}
          />
          <Controls />
          <MiniMap />
        </ReactFlow>
        </div>
      )}

      <NodeEditModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        node={selectedNode}
        onNodeUpdate={handleNodeUpdate}
        onNodeDelete={onNodesDelete}
        theme={theme}
        parsedSchema={parsedSchema}
        resourceDefinitions={resourceDefinitions}
      />
    </div>
  );
});

ModularEventFlow.displayName = 'ModularEventFlow';

export default ModularEventFlow;