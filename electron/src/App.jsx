import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';

// Layout Components
import Header from './components/layout/Header';
import ProjectSidebar from './components/layout/Sidebar';

// Pages
import ConfigurationGuide from './components/pages/ConfigurationGuide';
import ProjectPage from './components/pages/ProjectPage';
import DbConfigEditor from './components/pages/DbConfigEditor';
import SimConfigEditor from './components/pages/SimConfigEditor';
import ResultsViewer from './components/pages/ResultsViewer';

// Toast Context
import { ToastProvider } from './contexts/ToastContext';
import useResizableGrid from './hooks/shared/useResizableGrid';

const App = () => {
  // Theme state management - initialize from localStorage or default to 'dark'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  // Effect to apply theme class to body
  useEffect(() => {
    // Remove any conflicting theme classes
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    
    // Keep body overflow hidden for app-like behavior
    document.body.style.overflow = 'hidden';
    
    // Save theme preference to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Signal when React is ready to help with loading screen transition
  useEffect(() => {
    const timer = setTimeout(() => {
      // Signal that React app is fully rendered
      document.body.classList.add('react-ready');
      
      // Use the global function to hide loading screen
      if (window.hideLoadingScreen) {
        window.hideLoadingScreen();
      }
    }, 500); // Small delay to ensure content is rendered
    
    return () => clearTimeout(timer);
  }, []);

  // Function to toggle theme
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Sidebar visibility state
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const savedVisibility = localStorage.getItem('sidebarVisible');
    return savedVisibility !== null ? savedVisibility === 'true' : true;
  });

  // Save sidebar visibility to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarVisible', sidebarVisible.toString());
  }, [sidebarVisible]);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(prev => !prev);
  };

  // Sidebar resize functionality
  const { handleMouseDown: handleSidebarResize } = useResizableGrid({
    minWidthPercent: 10,
    maxWidthPercent: 40,
    defaultWidthPercent: 15,
    cssVariable: '--sidebar-width',
    storageKey: 'app-sidebar-width'
  });

  return (
    <ToastProvider>
      <div className={`app-grid-container ${!sidebarVisible ? 'sidebar-collapsed' : ''}`}>
        {/* Header Panel */}
        <div className="grid-header">
          <Header 
            currentTheme={theme} 
            onToggleTheme={toggleTheme} 
            sidebarVisible={sidebarVisible}
            onToggleSidebar={toggleSidebar}
          />
        </div>
        
        {/* Sidebar Panel */}
        <div className="grid-sidebar">
          <ProjectSidebar theme={theme} visible={sidebarVisible} />
        </div>
        
        {/* Sidebar Resize Handle */}
        {sidebarVisible && (
          <div 
            className="grid-sidebar-handle"
            onMouseDown={handleSidebarResize}
            title="Drag to resize sidebar"
          />
        )}
        
        {/* Content Panel */}
        <div className="grid-content">
          <div className="content-area">
            <Container fluid className="p-0 h-100">
              <Routes>
              {/* Welcome and dashboard */}
              <Route path="/" element={<ConfigurationGuide />} />
              
              {/* Project routes */}
              <Route path="/project/:projectId" element={<ProjectPage theme={theme} />} />
              <Route path="/project/:projectId/:activeTab" element={<ProjectPage theme={theme} />} />
              <Route path="/project/:projectId/results/:resultId" element={<ProjectPage theme={theme} />} />
              
              {/* Standalone configuration routes */}
              <Route path="/db-config" element={<DbConfigEditor theme={theme} />} />
              <Route path="/db-config/:configId" element={<DbConfigEditor theme={theme} />} />
              <Route path="/sim-config" element={<SimConfigEditor theme={theme} />} />
              <Route path="/sim-config/:configId" element={<SimConfigEditor theme={theme} />} />
              
              {/* Results routes */}
              <Route path="/results/:databasePath" element={<ResultsViewer />} />
              
              {/* Default catch-all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Container>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
};

export default App; 