import React from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { FiPlus } from 'react-icons/fi';

const CreateProjectModal = ({ 
  show, 
  onHide, 
  onCreate, 
  projectName, 
  onProjectNameChange, 
  isCreating 
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onCreate();
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Create New Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Project Name</Form.Label>
          <Form.Control
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter project name"
            autoFocus
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={onCreate}
          disabled={isCreating || !projectName.trim()}
        >
          {isCreating ? <Spinner size="sm" animation="border" className="me-2" /> : <FiPlus className="me-2" />}
          Create Project
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateProjectModal;