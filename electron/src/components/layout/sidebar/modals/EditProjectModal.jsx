import React from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';

const EditProjectModal = ({ 
  show, 
  onHide, 
  onUpdate, 
  project,
  projectName, 
  onProjectNameChange, 
  isUpdating 
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onUpdate();
    }
  };

  const handleUpdate = () => {
    if (!projectName.trim() || projectName === project?.name) {
      onHide();
      return;
    }
    onUpdate();
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Edit Project Name</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label>Project Name</Form.Label>
            <Form.Control
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              disabled={isUpdating}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={isUpdating}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? <Spinner animation="border" size="sm" /> : 'Save'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditProjectModal;