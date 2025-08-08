import { useState, useEffect } from 'react';
import { useNodesState, useEdgesState } from 'reactflow';
import { sortAttributes } from '../../components/shared/entity-nodes/EntityNode';

/**
 * Custom hook for managing ReactFlow visual state in ERDiagram
 * Transforms canonical entities to visual nodes and edges
 * Handles foreign key relationship visualization
 */
export const useEntityVisualState = (canonicalEntities, onDiagramChange, generateYAML, projectId) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dbSchema, setDbSchema] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(projectId);

  // Reset state when project changes (backup safety net)
  useEffect(() => {
    if (projectId && currentProjectId && projectId !== currentProjectId) {
      console.log(`[useEntityVisualState] Project change detected: ${currentProjectId} -> ${projectId}, resetting state`);
      setNodes([]);
      setEdges([]);
      setDbSchema(null);
      setCurrentProjectId(projectId);
    }
  }, [projectId, currentProjectId, setNodes, setEdges]);

  // Update visual nodes and edges from canonical entities
  useEffect(() => {
    if (canonicalEntities.length === 0) {
      setNodes([]);
      setEdges([]);
      
      // Always notify parent of empty state when all entities are deleted
      if (onDiagramChange) {
        const emptyYAML = generateYAML(); // This returns "" for empty entities
        onDiagramChange(emptyYAML);
      }
      return;
    }

    // Generate visual nodes
    const visualNodes = canonicalEntities.map(entity => {
      const position = entity.position || { x: 50, y: 50 };
      
      return {
        id: entity.name,
        type: 'entity',
        position: position,
        data: {
          label: entity.name,
          tableType: entity.type || '',
          rows: entity.rows || 100,
          attributes: sortAttributes(entity.attributes || [])
        },
        width: 200,
        height: 100 + (entity.attributes?.length || 0) * 25,
      };
    });

    // Generate visual edges from foreign key relationships
    const visualEdges = [];
    canonicalEntities.forEach(entity => {
      if (entity.attributes) {
        entity.attributes.forEach(attr => {
          if ((attr.type === 'fk' || attr.type === 'event_id' || attr.type === 'entity_id' || attr.type === 'resource_id') && attr.ref) {
            const [targetEntity] = attr.ref.split('.');
            // Only create edge if target entity exists in canonical entities
            if (canonicalEntities.find(e => e.name === targetEntity)) {
              visualEdges.push({
                id: `${entity.name}-${targetEntity}`,
                source: entity.name,
                sourceHandle: 'source-right',
                target: targetEntity,
                targetHandle: 'target-left',
                animated: true,
                type: 'smoothstep',
                style: { stroke: '#3498db' },
                markerEnd: {
                  type: 'arrowclosed',
                  width: 20,
                  height: 20,
                  color: '#3498db',
                },
              });
            }
          }
        });
      }
    });

    setNodes(visualNodes);
    setEdges(visualEdges);
    
    // Update dbSchema to stay in sync with canonicalEntities for connection validation
    setDbSchema({
      entities: canonicalEntities.map(entity => ({
        name: entity.name,
        type: entity.type,
        rows: entity.rows,
        attributes: entity.attributes || []
      }))
    });
    
    // Always notify parent of canvas changes (canvas -> YAML one-way sync)
    if (onDiagramChange) {
      const generatedYAML = generateYAML();
      onDiagramChange(generatedYAML);
    }
  }, [canonicalEntities, onDiagramChange, generateYAML]);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    dbSchema,
    setDbSchema
  };
};