import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import yaml from 'yaml';
import useResourceDefinitions from '../../../hooks/shared/useResourceDefinitions';
import { ResourceDataTable } from '../../shared/DataTable';
import { useSimulationActions } from '../../../stores/simulationConfigStore';

const SimulationResourceEditor = ({ yamlContent, onResourceChange, dbConfigContent, projectId }) => {
  const [parsedData, setParsedData] = useState(null);
  const [previousResourceDefinitions, setPreviousResourceDefinitions] = useState({});
  const [editingCell, setEditingCell] = useState(null); // Track which cell is being edited
  const [editValue, setEditValue] = useState(''); // Current edit value
  
  // Use the custom hook to get resource definitions from database config
  const resourceDefinitions = useResourceDefinitions(dbConfigContent);
  
  // Use simulation actions for resource management
  const { updateResourceCapacity, getResourceCapacity, syncSimulationToYaml } = useSimulationActions(projectId);

  // Note: Resource initialization and deletion are now handled at page level in SimConfigEditor

  // Parse YAML content when it changes
  useEffect(() => {
    try {
      if (yamlContent) {
        const parsed = yaml.parse(yamlContent);
        setParsedData(parsed);
      }
    } catch (error) {
      console.error('Error parsing YAML for resource editor:', error);
      setParsedData(null);
    }
  }, [yamlContent]);

  // Handle resource renames (addition/deletion handled at page level)
  useEffect(() => {
    if (Object.keys(previousResourceDefinitions).length > 0 && parsedData && Object.keys(resourceDefinitions).length > 0) {
      const renamedResources = detectResourceRenames(previousResourceDefinitions, resourceDefinitions);
      const renamedResourceTypes = detectResourceTypeRenames(previousResourceDefinitions, resourceDefinitions);
      
      if (renamedResources.length > 0) {
        handleResourceRenames(renamedResources);
      }
      
      if (renamedResourceTypes.length > 0) {
        handleResourceTypeRenames(renamedResourceTypes);
      }
    }
    
    setPreviousResourceDefinitions(resourceDefinitions);
  }, [resourceDefinitions, previousResourceDefinitions, parsedData]);

  // Get current capacity for a resource type (using store)
  const getCurrentCapacity = (resourceName, resourceType) => {
    return getResourceCapacity(resourceName, resourceType);
  };

  // Handle starting edit of a capacity value
  const handleStartEdit = (resourceName, resourceType, currentCapacity) => {
    const cellId = `${resourceName}-${resourceType}`;
    setEditingCell(cellId);
    setEditValue(currentCapacity.toString());
  };

  // Handle saving edited capacity value
  const handleSaveEdit = (resourceName, resourceType) => {
    const newCapacity = parseInt(editValue) || 1;
    updateResourceCapacity(resourceName, resourceType, newCapacity);
    setEditingCell(null);
    setEditValue('');
    
    // Sync to YAML after manual capacity update
    console.log(`[SimulationResourceEditor] Capacity updated for ${resourceName}.${resourceType}: ${newCapacity}`);
    setTimeout(() => {
      syncSimulationToYaml();
    }, 0);
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key press in edit input
  const handleKeyPress = (e, resourceName, resourceType) => {
    if (e.key === 'Enter') {
      handleSaveEdit(resourceName, resourceType);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Format capacity display
  const formatCapacity = (capacity) => {
    if (typeof capacity === 'number') {
      return capacity.toString();
    }
    return capacity?.toString() || '1';
  };

  // Create sections for ResourceDataTable
  const createResourceSections = () => {
    return Object.keys(resourceDefinitions).map(resourceName => {
      const definition = resourceDefinitions[resourceName];
      const data = definition.resourceTypes.map(resourceType => ({
        id: `${resourceName}-${resourceType}`,
        resourceName,
        resourceType,
        capacity: getCurrentCapacity(resourceName, resourceType)
      }));
      
      return {
        title: resourceName,
        data
      };
    });
  };

  // Detect resource renames (keeping existing logic)
  const detectResourceRenames = (oldDefs, newDefs) => {
    const renames = [];
    const oldNames = Object.keys(oldDefs);
    const newNames = Object.keys(newDefs);
    
    oldNames.forEach(oldName => {
      if (!newNames.includes(oldName)) {
        const possibleNewName = newNames.find(newName => 
          !oldNames.includes(newName) &&
          JSON.stringify(oldDefs[oldName]) === JSON.stringify(newDefs[newName])
        );
        
        if (possibleNewName) {
          renames.push({ oldName, newName: possibleNewName });
        }
      }
    });
    
    return renames;
  };

  // Detect resource type renames (keeping existing logic)
  const detectResourceTypeRenames = (oldDefs, newDefs) => {
    const renames = [];
    
    Object.keys(oldDefs).forEach(resourceName => {
      if (newDefs[resourceName]) {
        const oldTypes = oldDefs[resourceName].resourceTypes;
        const newTypes = newDefs[resourceName].resourceTypes;
        
        oldTypes.forEach(oldType => {
          if (!newTypes.includes(oldType)) {
            const possibleNewType = newTypes.find(newType => !oldTypes.includes(newType));
            if (possibleNewType) {
              renames.push({ resourceName, oldType, newType: possibleNewType });
            }
          }
        });
      }
    });
    
    return renames;
  };

  // Handle resource renames (simplified - only direct YAML updates for renames)
  const handleResourceRenames = (renames) => {
    if (!parsedData || renames.length === 0) return;

    let hasChanges = false;
    const updatedData = { ...parsedData };

    renames.forEach(({ oldName, newName }) => {
      if (updatedData.simulation?.resources) {
        const resourceIndex = updatedData.simulation.resources.findIndex(r => r.resource_table === oldName);
        if (resourceIndex >= 0) {
          updatedData.simulation.resources[resourceIndex].resource_table = newName;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      const newYamlContent = yaml.stringify(updatedData);
      if (onResourceChange) {
        onResourceChange(newYamlContent);
      }
    }
  };

  // Handle resource type renames (simplified - only direct YAML updates)
  const handleResourceTypeRenames = (renames) => {
    if (!parsedData || renames.length === 0) return;

    let hasChanges = false;
    const updatedData = { ...parsedData };

    renames.forEach(({ resourceName, oldType, newType }) => {
      if (updatedData.simulation?.resources) {
        const resource = updatedData.simulation.resources.find(r => r.resource_table === resourceName);
        if (resource?.capacities && resource.capacities[oldType]) {
          resource.capacities[newType] = resource.capacities[oldType];
          delete resource.capacities[oldType];
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      const newYamlContent = yaml.stringify(updatedData);
      if (onResourceChange) {
        onResourceChange(newYamlContent);
      }
    }
  };

  const resourceSections = createResourceSections();

  // Define columns for the table
  const columns = [
    { key: 'resourceType', title: 'Resource Type', className: 'resource-type-col' },
    { key: 'capacityType', title: 'Capacity Type', className: 'capacity-type-col' },
    { key: 'capacity', title: 'Capacity', className: 'capacity-col' }
  ];

  // Render cell content
  const renderCell = (item, column) => {
    switch (column.key) {
      case 'resourceType':
        return <code className="cell-content code-text">{item.resourceType}</code>;
      case 'capacityType':
        return (
          <span className="cell-content">
            Fixed Capacity
          </span>
        );
      case 'capacity':
        const cellId = `${item.resourceName}-${item.resourceType}`;
        const isEditing = editingCell === cellId;
        
        if (isEditing) {
          return (
            <Form.Control
              type="number"
              size="sm"
              min="1"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSaveEdit(item.resourceName, item.resourceType)}
              onKeyDown={(e) => handleKeyPress(e, item.resourceName, item.resourceType)}
              autoFocus
              style={{ width: '80px' }}
            />
          );
        }
        
        return (
          <span 
            className="cell-content mono-text"
            onClick={() => handleStartEdit(item.resourceName, item.resourceType, item.capacity)}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            title="Click to edit"
          >
            {formatCapacity(item.capacity)}
          </span>
        );
      default:
        return item[column.key];
    }
  };

  if (Object.keys(resourceDefinitions).length === 0) {
    return (
      <div className="text-center py-4">
        <span className="cell-content muted-text">No resources found in database configuration</span>
      </div>
    );
  }

  return (
    <>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <ResourceDataTable
          sections={resourceSections}
          defaultColumns={columns}
          defaultGridColumns="150px 140px 100px"
          renderCell={renderCell}
          className="data-grid-3-col"
        />
      </div>

    </>
  );
};


export default SimulationResourceEditor;