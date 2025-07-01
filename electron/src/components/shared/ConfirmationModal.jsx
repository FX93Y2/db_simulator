import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FiAlertTriangle, FiTrash2, FiX } from 'react-icons/fi';

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
  theme = "light"
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
      case 'warning':
        return <FiAlertTriangle className="me-2" />;
      default:
        return <FiAlertTriangle className="me-2" />;
    }
  };

  const getVariantClass = () => {
    switch (variant) {
      case 'danger':
        return 'text-danger';
      case 'warning':
        return 'text-warning';
      case 'primary':
        return 'text-primary';
      default:
        return 'text-danger';
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="sm"
      backdrop="static"
      className="confirmation-modal"
    >
      <Modal.Header 
        closeButton 
        className={theme === 'dark' ? 'bg-dark text-light border-secondary' : 'bg-light border-light'}
      >
        <Modal.Title className={`d-flex align-items-center ${getVariantClass()}`}>
          {getIcon()}
          {title}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className={theme === 'dark' ? 'bg-dark text-light' : 'bg-white'}>
        <div className="d-flex align-items-start">
          <div className={`me-3 ${getVariantClass()}`} style={{ fontSize: '1.5rem' }}>
            <FiAlertTriangle />
          </div>
          <div>
            <p className="mb-0">{message}</p>
          </div>
        </div>
      </Modal.Body>
      
      <Modal.Footer className={theme === 'dark' ? 'bg-dark border-secondary' : 'bg-light border-light'}>
        <Button 
          variant="outline-secondary" 
          onClick={onHide}
          className="d-flex align-items-center"
        >
          <FiX className="me-1" />
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