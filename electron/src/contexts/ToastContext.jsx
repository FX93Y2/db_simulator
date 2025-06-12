import React, { createContext, useContext } from 'react';
import useToast from '../hooks/useToast';
import { ToastManager } from '../components/shared/Toast';

const ToastContext = createContext();

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const toastMethods = useToast();

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <ToastManager 
        toasts={toastMethods.toasts} 
        removeToast={toastMethods.removeToast} 
      />
    </ToastContext.Provider>
  );
};

export default ToastContext;