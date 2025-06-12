import React, { useState, useEffect } from 'react';
import { Toast as BootstrapToast, ToastContainer } from 'react-bootstrap';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

const Toast = ({
  show,
  onClose,
  title,
  message,
  variant = 'info', // 'success', 'error', 'warning', 'info'
  autoHide = true,
  delay = 4000
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <FiCheckCircle className="text-success me-2" />;
      case 'error':
        return <FiAlertCircle className="text-danger me-2" />;
      case 'warning':
        return <FiAlertCircle className="text-warning me-2" />;
      default:
        return <FiInfo className="text-info me-2" />;
    }
  };

  const getHeaderClass = () => {
    switch (variant) {
      case 'success':
        return 'bg-success text-white';
      case 'error':
        return 'bg-danger text-white';
      case 'warning':
        return 'bg-warning text-dark';
      default:
        return 'bg-info text-white';
    }
  };

  return (
    <BootstrapToast
      show={show}
      onClose={onClose}
      autohide={autoHide}
      delay={delay}
      className="toast-notification"
    >
      <BootstrapToast.Header className={getHeaderClass()} closeButton={false}>
        {getIcon()}
        <strong className="me-auto">{title}</strong>
        <button
          type="button"
          className="btn-close btn-close-white ms-2"
          aria-label="Close"
          onClick={onClose}
        >
          <FiX />
        </button>
      </BootstrapToast.Header>
      <BootstrapToast.Body>
        {message}
      </BootstrapToast.Body>
    </BootstrapToast>
  );
};

// Toast Manager Component
export const ToastManager = ({ toasts, removeToast }) => {
  return (
    <ToastContainer
      position="top-center"
      className="p-3"
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999
      }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          show={toast.show}
          onClose={() => removeToast(toast.id)}
          title={toast.title}
          message={toast.message}
          variant={toast.variant}
          autoHide={toast.autoHide}
          delay={toast.delay}
        />
      ))}
    </ToastContainer>
  );
};

export default Toast;