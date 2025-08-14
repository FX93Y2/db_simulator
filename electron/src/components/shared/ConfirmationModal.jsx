import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FiTrash2 } from 'react-icons/fi';

const ConfirmationModal = ({ 
  show, 
  onHide, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // danger, warning, primary, etc.
  icon = null,
  theme = "light" // Keep for API compatibility but rely on CSS theme variables
}) => {
  const handleConfirm = () => {
    onConfirm();
    onHide();
  };

  const getIcon = () => {
    if (icon) return icon;
    
    switch (variant) {
      case 'danger':
        return <FiTrash2 className="me-2" />;
      default:
        return <FiTrash2 className="me-2" />;
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <p>{message}</p>
      </Modal.Body>
      
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={onHide}
        >
          {cancelText}
        </Button>
        <Button 
          variant={variant} 
          onClick={handleConfirm}
          className="d-flex align-items-center"
        >
          {getIcon()}
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmationModal;