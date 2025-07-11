import React from 'react';
import { Modal, Button } from 'react-bootstrap';

/**
 * Modal to warn users about unsaved changes before navigation
 */
const UnsavedChangesModal = ({ 
  show, 
  onHide, 
  onSave, 
  onDiscard, 
  onCancel,
  title = "Unsaved Changes",
  message = "You have unsaved changes. What would you like to do?"
}) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline-danger" onClick={onDiscard}>
          Discard Changes
        </Button>
        <Button variant="primary" onClick={onSave}>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UnsavedChangesModal;