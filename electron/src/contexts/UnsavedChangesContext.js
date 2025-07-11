import React, { createContext, useContext, useState } from 'react';

const UnsavedChangesContext = createContext();

export const UnsavedChangesProvider = ({ children }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [checkUnsavedChanges, setCheckUnsavedChanges] = useState(null);

  return (
    <UnsavedChangesContext.Provider value={{
      hasUnsavedChanges,
      setHasUnsavedChanges,
      checkUnsavedChanges,
      setCheckUnsavedChanges
    }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChangesContext = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChangesContext must be used within UnsavedChangesProvider');
  }
  return context;
};