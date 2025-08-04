import { useState, useCallback } from 'react';

let toastIdCounter = 0;

const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((options) => {
    const id = ++toastIdCounter;
    const toast = {
      id,
      show: true,
      title: options.title || 'Notification',
      message: options.message || '',
      variant: options.variant || 'info',
      autoHide: options.autoHide !== false, // default to true
      delay: options.delay || 4000,
      ...options
    };

    setToasts(prev => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods for different toast types
  const showSuccess = useCallback((message, title = 'Success') => {
    return addToast({ title, message, variant: 'success' });
  }, [addToast]);

  const showError = useCallback((message, title = 'Error') => {
    return addToast({ title, message, variant: 'error', autoHide: false });
  }, [addToast]);

  const showWarning = useCallback((message, title = 'Warning') => {
    return addToast({ title, message, variant: 'warning' });
  }, [addToast]);

  const showInfo = useCallback((message, title = 'Info') => {
    return addToast({ title, message, variant: 'info' });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};

export default useToast;