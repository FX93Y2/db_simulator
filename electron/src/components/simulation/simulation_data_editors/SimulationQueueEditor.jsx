import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import DataTable from '../../shared/DataTable';
import { useSimulationActions } from '../../../stores/simulationConfigStore';

/**
 * Queue editor component for managing simulation queue definitions
 * Supports FIFO, LIFO, LowAttribute, and HighAttribute queue types
 */
const SimulationQueueEditor = ({ projectId }) => {
  const [queues, setQueues] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQueue, setNewQueue] = useState({ name: '', type: 'FIFO', attribute: '' });
  const [error, setError] = useState(null);

  // Use simulation actions for queue management
  const { getQueues, addQueue, updateQueue, removeQueue, syncSimulationToYaml } = useSimulationActions(projectId);

  // Load queues from store
  useEffect(() => {
    const loadedQueues = getQueues();
    setQueues(loadedQueues || []);
  }, [getQueues]);

  // Refresh queues after operations
  const refreshQueues = () => {
    const loadedQueues = getQueues();
    setQueues(loadedQueues || []);
  };

  // Handle adding a new queue
  const handleAddQueue = () => {
    setError(null);

    // Validate queue name
    if (!newQueue.name.trim()) {
      setError('Queue name is required');
      return;
    }

    // Validate attribute for priority queues
    if ((newQueue.type === 'LowAttribute' || newQueue.type === 'HighAttribute') && !newQueue.attribute.trim()) {
      setError(`Queue type '${newQueue.type}' requires an attribute`);
      return;
    }

    // Add queue
    const result = addQueue(
      newQueue.name.trim(),
      newQueue.type,
      newQueue.attribute.trim() || null
    );

    if (result.success) {
      refreshQueues();
      setNewQueue({ name: '', type: 'FIFO', attribute: '' });
      setShowAddForm(false);
      // Sync to YAML
      setTimeout(() => syncSimulationToYaml(), 0);
    } else {
      setError(result.message);
    }
  };

  // Handle removing a queue
  const handleRemoveQueue = (queueName) => {
    const result = removeQueue(queueName);
    if (result.success) {
      refreshQueues();
      // Sync to YAML
      setTimeout(() => syncSimulationToYaml(), 0);
    }
  };

  // Handle starting edit
  const handleStartEdit = (queueName, field, currentValue) => {
    const cellId = `${queueName}-${field}`;
    setEditingCell(cellId);
    setEditValue(currentValue || '');
    setError(null);
  };

  // Handle saving edited value
  const handleSaveEdit = (queue, field) => {
    setError(null);
    const newValue = editValue.trim();

    // Create updated queue object
    let updatedName = queue.name;
    let updatedType = queue.type;
    let updatedAttribute = queue.attribute || null;

    if (field === 'name') {
      if (!newValue) {
        setError('Queue name cannot be empty');
        return;
      }
      updatedName = newValue;
    } else if (field === 'type') {
      updatedType = newValue;
    } else if (field === 'attribute') {
      updatedAttribute = newValue || null;
    }

    // Validate attribute requirement
    if ((updatedType === 'LowAttribute' || updatedType === 'HighAttribute') && !updatedAttribute) {
      setError(`Queue type '${updatedType}' requires an attribute`);
      return;
    }

    // Update queue
    const result = updateQueue(queue.name, updatedName, updatedType, updatedAttribute);

    if (result.success) {
      refreshQueues();
      setEditingCell(null);
      setEditValue('');
      // Sync to YAML
      setTimeout(() => syncSimulationToYaml(), 0);
    } else {
      setError(result.message);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
    setError(null);
  };

  // Handle key press in edit input
  const handleKeyPress = (e, queue, field) => {
    if (e.key === 'Enter') {
      handleSaveEdit(queue, field);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Queue type options
  const queueTypes = ['FIFO', 'LIFO', 'LowAttribute', 'HighAttribute'];

  // Render cell content
  const renderCell = (queue, column) => {
    const cellId = `${queue.name}-${column.key}`;
    const isEditing = editingCell === cellId;

    switch (column.key) {
      case 'name':
        if (isEditing) {
          return (
            <Form.Control
              type="text"
              size="sm"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSaveEdit(queue, 'name')}
              onKeyDown={(e) => handleKeyPress(e, queue, 'name')}
              autoFocus
            />
          );
        }
        return (
          <code
            className="cell-content code-text"
            onClick={() => handleStartEdit(queue.name, 'name', queue.name)}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            title="Click to edit"
          >
            {queue.name}
          </code>
        );

      case 'type':
        if (isEditing) {
          return (
            <Form.Select
              size="sm"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSaveEdit(queue, 'type')}
              onKeyDown={(e) => handleKeyPress(e, queue, 'type')}
              autoFocus
            >
              {queueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Form.Select>
          );
        }
        return (
          <span
            className="cell-content"
            onClick={() => handleStartEdit(queue.name, 'type', queue.type)}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            title="Click to edit"
          >
            {queue.type}
          </span>
        );

      case 'attribute':
        const requiresAttribute = queue.type === 'LowAttribute' || queue.type === 'HighAttribute';
        if (isEditing) {
          return (
            <Form.Control
              type="text"
              size="sm"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSaveEdit(queue, 'attribute')}
              onKeyDown={(e) => handleKeyPress(e, queue, 'attribute')}
              autoFocus
              disabled={!requiresAttribute}
            />
          );
        }
        return (
          <code
            className={`cell-content ${requiresAttribute ? 'code-text' : 'muted-text'}`}
            onClick={() => requiresAttribute && handleStartEdit(queue.name, 'attribute', queue.attribute || '')}
            style={{ cursor: requiresAttribute ? 'pointer' : 'default', textDecoration: requiresAttribute ? 'underline' : 'none' }}
            title={requiresAttribute ? 'Click to edit' : 'Not applicable for this queue type'}
          >
            {queue.attribute || (requiresAttribute ? '(required)' : 'n/a')}
          </code>
        );

      case 'actions':
        return (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-danger"
              onClick={() => handleRemoveQueue(queue.name)}
              title="Delete queue"
            >
              <FiTrash2 size={16} />
            </Button>
          </div>
        );

      default:
        return queue[column.key];
    }
  };

  // Define columns
  const columns = [
    { key: 'name', title: 'Queue Name', className: 'queue-name-col', cellClassName: 'queue-name-col' },
    { key: 'type', title: 'Type', className: 'queue-type-col', cellClassName: 'queue-type-col' },
    { key: 'attribute', title: 'Attribute', className: 'queue-attribute-col', cellClassName: 'queue-attribute-col' },
    { key: 'actions', title: 'Actions', className: 'queue-actions-col', cellClassName: 'queue-actions-col' }
  ];

  return (
    <>
      {error && (
        <div className="alert alert-danger alert-sm mb-3" role="alert">
          {error}
        </div>
      )}

      {/* Add Queue Button */}
      {!showAddForm && (
        <div className="mb-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <FiPlus size={16} className="me-1" />
            Add Queue
          </Button>
        </div>
      )}

      {/* Add Queue Form */}
      {showAddForm && (
        <div className="card mb-3 p-3">
          <h6 className="mb-3">Add New Queue</h6>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label className="small">Queue Name</Form.Label>
              <Form.Control
                type="text"
                size="sm"
                placeholder="e.g., ProcessingQueue"
                value={newQueue.name}
                onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small">Queue Type</Form.Label>
              <Form.Select
                size="sm"
                value={newQueue.type}
                onChange={(e) => setNewQueue({ ...newQueue, type: e.target.value })}
              >
                {queueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {newQueue.type === 'FIFO' && 'First In First Out - Standard queue'}
                {newQueue.type === 'LIFO' && 'Last In First Out - Stack-based queue'}
                {newQueue.type === 'LowAttribute' && 'Priority queue - Lower attribute values processed first'}
                {newQueue.type === 'HighAttribute' && 'Priority queue - Higher attribute values processed first'}
              </Form.Text>
            </Form.Group>
            {(newQueue.type === 'LowAttribute' || newQueue.type === 'HighAttribute') && (
              <Form.Group className="mb-2">
                <Form.Label className="small">Attribute Name</Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="e.g., priority, estimated_hours"
                  value={newQueue.attribute}
                  onChange={(e) => setNewQueue({ ...newQueue, attribute: e.target.value })}
                />
                <Form.Text className="text-muted">
                  Entity attribute to use for priority ordering
                </Form.Text>
              </Form.Group>
            )}
            <div className="d-flex gap-2">
              <Button variant="primary" size="sm" onClick={handleAddQueue}>
                Add
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewQueue({ name: '', type: 'FIFO', attribute: '' });
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </div>
      )}

      {/* Queue List */}
      {queues.length === 0 ? (
        <div className="text-center p-4 text-muted">
          <p>No queues defined.</p>
          <small>Add queues to control entity ordering at resource allocation points.</small>
        </div>
      ) : (
        <div className="queue-table data-table-container">
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <DataTable
              columns={columns}
              data={queues}
              renderCell={renderCell}
              gridColumns="minmax(240px, 2fr) minmax(140px, 1fr) minmax(180px, 1.2fr) 80px"
              className="data-grid-4-col"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default SimulationQueueEditor;
