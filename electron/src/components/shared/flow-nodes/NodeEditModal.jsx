import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';
import ConfirmationModal from '../ConfirmationModal';
import { useStepHelpers } from './hooks/useStepHelpers';
import EventStepEditor from './editors/EventStepEditor';
import DecideStepEditor from './editors/DecideStepEditor';
import AssignStepEditor from './editors/AssignStepEditor';
import ReleaseStepEditor from './editors/ReleaseStepEditor';

const NodeEditModal = ({ show, onHide, node, onNodeUpdate, onNodeDelete, theme, parsedSchema, resourceDefinitions }) => {
  const [formData, setFormData] = useState({});
  const [resourceRequirements, setResourceRequirements] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastNodeId, setLastNodeId] = useState(null);

  // Use the step helpers hook
  const {
    getDisplayNameFromStepId,
    getStepIdFromDisplayName,
    getAvailableStepNames,
    getAvailableAttributes
  } = useStepHelpers(parsedSchema);

  // Initialize form data when node changes
  useEffect(() => {
    // Only reset form data when node actually changes (new node opened), not during auto-updates
    if (node && node.data.stepConfig && (!lastNodeId || node.id !== lastNodeId)) {
      setLastNodeId(node.id);
      initializeFormData(node.data.stepConfig);
    }
  }, [node, parsedSchema, lastNodeId]);

  // Reset form data whenever modal opens to ensure clean state
  useEffect(() => {
    if (show && node && node.data.stepConfig) {
      initializeFormData(node.data.stepConfig);
    }
  }, [show, node, parsedSchema]);

  const initializeFormData = (stepConfig) => {
    if (stepConfig.step_type === 'event') {
      initializeEventForm(stepConfig);
    } else if (stepConfig.step_type === 'decide') {
      initializeDecideForm(stepConfig);
    } else if (stepConfig.step_type === 'assign') {
      initializeAssignForm(stepConfig);
    } else if (stepConfig.step_type === 'release') {
      initializeReleaseForm(stepConfig);
    }
  };

  const initializeEventForm = (stepConfig) => {
    const eventConfig = stepConfig.event_config || {};
    const duration = eventConfig.duration?.distribution || {};
    
    setFormData({
      name: eventConfig.name || '',
      distribution_type: duration.type || 'normal',
      duration_mean: duration.mean || 1,
      duration_stddev: duration.stddev || 0.1,
      duration_scale: duration.scale || 1,
      duration_min: duration.min || 0,
      duration_max: duration.max || 10,
      duration_values: duration.values ? duration.values.join(', ') : '1, 2, 3',
      duration_weights: duration.weights ? duration.weights.join(', ') : '0.5, 0.3, 0.2'
    });
    
    setResourceRequirements(eventConfig.resource_requirements || []);
  };

  const initializeDecideForm = (stepConfig) => {
    const decideConfig = stepConfig.decide_config || {};
    
    setFormData({
      decision_type: decideConfig.decision_type || 'probability'
    });
    
    // Convert outcomes to use display names instead of step IDs
    const convertedOutcomes = (decideConfig.outcomes || []).map((outcome) => {
      const nextStepId = outcome.next_step_id;
      const nextDisplayName = getDisplayNameFromStepId(nextStepId);
      const condition = outcome.conditions?.[0] || {};
      
      const convertedOutcome = {
        next_event_name: nextDisplayName
      };

      if (condition.if && condition.if.toLowerCase() === 'probability') {
        convertedOutcome.probability = condition.value || 0.5;
      } else {
        // Attribute-based condition
        convertedOutcome.if = condition.if || 'Attribute';
        convertedOutcome.name = condition.name || '';
        convertedOutcome.is = condition.is || '==';
        convertedOutcome.value = condition.value || '';
      }

      return convertedOutcome;
    });
    
    // Ensure at least 2 outcomes with appropriate defaults
    if (convertedOutcomes.length === 0) {
      const isCondition = decideConfig.decision_type === 'condition';
      if (isCondition) {
        setOutcomes([
          { next_event_name: '', if: 'Attribute', name: '', is: '==', value: '' },
          { next_event_name: '', if: 'Attribute', name: '', is: '==', value: '' }
        ]);
      } else {
        setOutcomes([
          { next_event_name: '', probability: 0.5 },
          { next_event_name: '', probability: 0.5 }
        ]);
      }
    } else {
      setOutcomes(convertedOutcomes);
    }
  };

  const initializeAssignForm = (stepConfig) => {
    const assignConfig = stepConfig.assign_config || {};
    
    setFormData({
      module_id: assignConfig.module_id || stepConfig.step_id
    });
    
    // Initialize assignments
    const convertedAssignments = (assignConfig.assignments || []).map((assignment) => ({
      assignment_type: assignment.assignment_type || 'attribute',
      attribute_name: assignment.attribute_name || '',
      value: assignment.value || ''
    }));
    
    // Ensure at least one assignment
    if (convertedAssignments.length === 0) {
      setAssignments([{
        assignment_type: 'attribute',
        attribute_name: '',
        value: ''
      }]);
    } else {
      setAssignments(convertedAssignments);
    }
  };

  const initializeReleaseForm = (stepConfig) => {
    setFormData({
      name: stepConfig.event_config?.name || 'Release'
    });
  };

  // Helper function to handle form data changes
  const handleFormDataChange = (newData) => {
    setFormData({ ...formData, ...newData });
  };

  // Resource requirement handlers
  const handleResourceRequirementChange = (index, field, value) => {
    const updated = [...resourceRequirements];
    updated[index] = { ...updated[index], [field]: value };
    setResourceRequirements(updated);
  };

  const addResourceRequirement = () => {
    const availableResourceTables = Object.keys(resourceDefinitions);
    const defaultResourceTable = availableResourceTables.length > 0 ? availableResourceTables[0] : 'Consultant';
    const defaultResourceType = availableResourceTables.length > 0 && resourceDefinitions[defaultResourceTable]?.resourceTypes?.length > 0
      ? resourceDefinitions[defaultResourceTable].resourceTypes[0]
      : 'Developer';
    
    setResourceRequirements([...resourceRequirements, {
      resource_table: defaultResourceTable,
      value: defaultResourceType,
      count: 1
    }]);
  };

  const removeResourceRequirement = (index) => {
    setResourceRequirements(resourceRequirements.filter((_, i) => i !== index));
  };

  // Outcome handlers
  const handleOutcomeChange = (index, field, value) => {
    const updated = [...outcomes];
    updated[index] = { ...updated[index], [field]: value };
    setOutcomes(updated);
  };

  const addOutcome = () => {
    const isCondition = formData.decision_type === 'condition';
    if (isCondition) {
      setOutcomes([...outcomes, {
        next_event_name: '',
        if: 'Attribute',
        name: '',
        is: '==',
        value: ''
      }]);
    } else {
      setOutcomes([...outcomes, {
        next_event_name: '',
        probability: 0.5
      }]);
    }
  };

  const removeOutcome = (index) => {
    if (outcomes.length > 1) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  // Assignment handlers
  const handleAssignmentChange = (index, field, value) => {
    // Process the value to handle numeric strings properly for YAML
    let processedValue = value;
    if (field === 'value' && value) {
      // Try to convert to number if it's a valid numeric string
      if (/^\d+(\.\d+)?$/.test(value.toString())) {
        processedValue = value.includes('.') ? parseFloat(value) : parseInt(value, 10);
      }
    }
    
    const updated = [...assignments];
    updated[index] = { ...updated[index], [field]: processedValue };
    setAssignments(updated);
  };

  const addAssignment = () => {
    setAssignments([...assignments, {
      assignment_type: 'attribute',
      attribute_name: '',
      value: ''
    }]);
  };

  const removeAssignment = (index) => {
    if (assignments.length > 1) {
      setAssignments(assignments.filter((_, i) => i !== index));
    }
  };

  // Handle node deletion
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    try {
      onNodeDelete([node]); // Pass as array since onNodesDelete expects array
      setShowDeleteConfirm(false);
      onHide();
    } catch (error) {
      console.error('Error deleting node:', error);
      setShowDeleteConfirm(false);
    }
  };

  // Handle save and close
  const handleSaveAndClose = () => {
    if (forceSave()) {
      onHide();
    }
  };

  // Force immediate save without debounce
  const forceSave = () => {
    if (!node) {
      return false; // Don't save if no node
    }
    
    // Validation depends on step type
    const stepType = node.data.stepConfig.step_type;
    if ((stepType === 'event' || stepType === 'release') && !formData.name) {
      return false; // Don't save if basic validation fails for event/release
    }
    if (stepType === 'assign') {
      if (assignments.length === 0) {
        return false; // Don't save if no assignments for assign step
      }
      // Validate all assignments have required fields
      for (const assignment of assignments) {
        if (!assignment.attribute_name || !assignment.value) {
          return false; // Don't save if any assignment is incomplete
        }
      }
    }

    try {
      const updatedStepConfig = buildStepConfig();
      const updatedNode = {
        ...node,
        id: updatedStepConfig.step_id,
        data: {
          ...node.data,
          stepConfig: updatedStepConfig,
          label: generateLabel(node.data.stepConfig.step_type, formData, updatedStepConfig.step_id)
        }
      };

      onNodeUpdate(updatedNode);
      return true;
    } catch (error) {
      console.error('Error saving node:', error);
      return false;
    }
  };

  const buildStepConfig = () => {
    const stepType = node.data.stepConfig.step_type;
    const stepId = generateStepId(stepType, formData);
    const updatedStepConfig = { 
      ...node.data.stepConfig,
      step_id: stepId
    };

    if (stepType === 'event') {
      updatedStepConfig.event_config = buildEventConfig();
    } else if (stepType === 'decide') {
      updatedStepConfig.decide_config = buildDecideConfig(stepId);
    } else if (stepType === 'assign') {
      updatedStepConfig.assign_config = buildAssignConfig(stepId);
      updatedStepConfig.next_steps = [];
    } else if (stepType === 'release') {
      updatedStepConfig.event_config = { name: formData.name };
    }

    return updatedStepConfig;
  };

  const buildEventConfig = () => {
    const distributionConfig = { type: formData.distribution_type };
    
    // Add distribution-specific parameters
    if (formData.distribution_type === 'normal') {
      distributionConfig.mean = parseFloat(formData.duration_mean) || 1;
      distributionConfig.stddev = parseFloat(formData.duration_stddev) || 0.1;
    } else if (formData.distribution_type === 'exponential') {
      distributionConfig.scale = parseFloat(formData.duration_scale) || 1;
    } else if (formData.distribution_type === 'uniform') {
      distributionConfig.min = parseFloat(formData.duration_min) || 0;
      distributionConfig.max = parseFloat(formData.duration_max) || 10;
    } else if (formData.distribution_type === 'choice') {
      try {
        distributionConfig.values = formData.duration_values.split(',').map(v => parseFloat(v.trim()));
        distributionConfig.weights = formData.duration_weights.split(',').map(w => parseFloat(w.trim()));
      } catch (e) {
        distributionConfig.values = [1, 2, 3];
        distributionConfig.weights = [0.5, 0.3, 0.2];
      }
    }
    
    return {
      name: formData.name,
      duration: { distribution: distributionConfig },
      resource_requirements: resourceRequirements
    };
  };

  const buildDecideConfig = (stepId) => {
    // Convert outcomes back to step IDs with proper conditions
    const convertedOutcomes = outcomes.map((outcome, index) => {
      const baseOutcome = {
        outcome_id: `outcome_${index + 1}`,
        next_step_id: getStepIdFromDisplayName(outcome.next_event_name)
      };

      if (formData.decision_type === 'probability') {
        baseOutcome.conditions = [{
          if: 'Probability',
          is: '==',
          value: parseFloat(outcome.probability) || 0.5
        }];
      } else {
        // Condition-based decision
        const condition = {
          if: outcome.if || 'Attribute',
          name: outcome.name || '',
          is: outcome.is || '==',
          value: outcome.value || ''
        };

        baseOutcome.conditions = [condition];
      }

      return baseOutcome;
    });

    return {
      module_id: stepId, // Auto-generated same as step_id
      decision_type: formData.decision_type,
      outcomes: convertedOutcomes
    };
  };

  const buildAssignConfig = (stepId) => {
    return {
      module_id: formData.module_id || stepId,
      assignments: assignments.map((assignment) => ({
        assignment_type: assignment.assignment_type,
        attribute_name: assignment.attribute_name,
        value: assignment.value
      }))
    };
  };

  const generateStepId = (stepType, formData) => {
    if (stepType === 'assign') {
      return formData.module_id || node.data.stepConfig.step_id || `assign_${Date.now()}`;
    } else {
      const name = formData.name;
      if (!name) return `${stepType}_${Date.now()}`;
      return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
  };

  const generateLabel = (stepType, formData, stepId) => {
    if (stepType === 'assign') {
      return 'Assign';
    } else {
      return formData.name || stepId;
    }
  };

  const renderStepEditor = () => {
    if (!node) return null;

    const stepType = node.data.stepConfig?.step_type;
    const availableSteps = getAvailableStepNames();
    const availableAttributes = getAvailableAttributes();

    switch (stepType) {
      case 'event':
        return (
          <EventStepEditor
            formData={formData}
            onFormDataChange={handleFormDataChange}
            resourceRequirements={resourceRequirements}
            onResourceRequirementChange={handleResourceRequirementChange}
            onAddResourceRequirement={addResourceRequirement}
            onRemoveResourceRequirement={removeResourceRequirement}
            resourceDefinitions={resourceDefinitions}
          />
        );
      
      case 'decide':
        return (
          <DecideStepEditor
            formData={formData}
            onFormDataChange={handleFormDataChange}
            outcomes={outcomes}
            onOutcomeChange={handleOutcomeChange}
            onAddOutcome={addOutcome}
            onRemoveOutcome={removeOutcome}
            availableSteps={availableSteps}
            availableAttributes={availableAttributes}
          />
        );
      
      case 'assign':
        return (
          <AssignStepEditor
            formData={formData}
            onFormDataChange={handleFormDataChange}
            assignments={assignments}
            onAssignmentChange={handleAssignmentChange}
            onAddAssignment={addAssignment}
            onRemoveAssignment={removeAssignment}
            availableAttributes={availableAttributes}
          />
        );
      
      case 'release':
        return (
          <ReleaseStepEditor
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit {node?.data.stepConfig?.step_type || 'Step'} Step</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {renderStepEditor()}
        </Modal.Body>
        <Modal.Footer>
          {node && (
            <Button 
              variant="outline-danger" 
              onClick={handleDelete}
              className="me-auto"
            >
              <FiTrash2 className="me-2" /> Delete Step
            </Button>
          )}
          <Button variant="primary" onClick={handleSaveAndClose}>Save & Close</Button>
        </Modal.Footer>
      </Modal>

      <ConfirmationModal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Step"
        message={`Are you sure you want to delete this ${node?.data.stepConfig?.step_type || 'step'}? This action cannot be undone and will remove all connections to this step.`}
        confirmText="Delete Step"
        cancelText="Cancel"
        variant="danger"
        theme={theme}
      />
    </>
  );
};

export default NodeEditModal;