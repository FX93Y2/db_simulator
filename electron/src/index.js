import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import App from './App';

// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/index.scss';

// Global focus fix for Electron
const installGlobalFocusFix = () => {
  console.log('Installing global focus management fix');
  
  // Track focused element
  let lastFocusedElement = null;
  
  // Handle blur events
  const handleBlur = (e) => {
    lastFocusedElement = e.target;
  };
  
  // Handle focus recovery
  const handleWindowFocus = () => {
    // When window gets focus, attempt to restore focus if it was lost
    if (lastFocusedElement && 
        document.activeElement === document.body) {
      try {
        console.log('Attempting to restore focus to:', 
          lastFocusedElement.tagName, 
          lastFocusedElement.className);
        lastFocusedElement.focus();
      } catch (err) {
        console.error('Error restoring focus:', err);
      }
    }
  };
  
  // Handle mousedown events
  const handleMouseDown = (e) => {
    // Set a flag to check if we need to rescue focus
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'SELECT' || 
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable) {
      window._needsFocusRescue = true;
      
      // Schedule a focus check
      setTimeout(() => {
        if (window._needsFocusRescue && 
            document.activeElement !== e.target) {
          try {
            console.log('Rescuing focus for:', e.target.tagName);
            e.target.focus();
          } catch (err) {
            console.error('Error rescuing focus:', err);
          }
        }
        window._needsFocusRescue = false;
      }, 100);
    }
  };
  
  // Handle focus events
  const handleFocus = () => {
    // Clear the rescue flag when something gets focus
    window._needsFocusRescue = false;
  };
  
  // Add event listeners
  window.addEventListener('blur', handleBlur, true);
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('focus', handleFocus, true);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('blur', handleBlur, true);
    window.removeEventListener('focus', handleWindowFocus);
    document.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('focus', handleFocus, true);
  };
};

// Call the function to install the focus fix
const cleanupFocusFix = installGlobalFocusFix();

// Create root element and render the app
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <Router>
    <App />
  </Router>
); 