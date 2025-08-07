import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

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

  // Sidebar state management
  const [sidebarSizePercentage, setSidebarSizePercentage] = useState(15);
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const savedVisibility = localStorage.getItem('sidebarVisible');
    return savedVisibility !== null ? savedVisibility === 'true' : true;
  });

  // Get saved sidebar width percentage from localStorage on initial load
  useEffect(() => {
    const savedPercentage = localStorage.getItem('sidebarSizePercentage');
    if (savedPercentage) {
      const parsedPercentage = parseInt(savedPercentage, 10);
      // Basic validation for the stored percentage
      if (!isNaN(parsedPercentage) && parsedPercentage >= 10 && parsedPercentage <= 50) {
        setSidebarSizePercentage(parsedPercentage);
      }
    }
  }, []);

  // Save sidebar visibility to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarVisible', sidebarVisible.toString());
  }, [sidebarVisible]);

  // Panel refs to control sizes programmatically
  const sidebarPanelRef = useRef(null);
  const contentPanelRef = useRef(null);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(prev => !prev);
  };

  // Update panel sizes when sidebar visibility changes
  useEffect(() => {
    if (sidebarPanelRef.current) {
      if (sidebarVisible) {
        // Expand sidebar to saved percentage
        sidebarPanelRef.current.resize(sidebarSizePercentage);
      } else {
        // Collapse sidebar to 0
        sidebarPanelRef.current.resize(0);
      }
    }
  }, [sidebarVisible, sidebarSizePercentage]);

  // Save sidebar width percentage to localStorage when layout changes
  // The onLayout prop gives an array of panel sizes in percentages.
  const handleLayoutChange = (sizes) => {
    if (sidebarVisible && sizes[0] && sizes[0] > 0) {
      const newSidebarSize = sizes[0]; // Assuming sidebar is the first panel
      const percentage = Math.round(newSidebarSize);
      setSidebarSizePercentage(percentage);
      localStorage.setItem('sidebarSizePercentage', percentage.toString());
    }
  };

  return (
    <ToastProvider>
      <div className="app-container">
        <Header 
          currentTheme={theme} 
          onToggleTheme={toggleTheme} 
          sidebarVisible={sidebarVisible}
          onToggleSidebar={toggleSidebar}
        />
        <div className="main-content">
          <PanelGroup direction="horizontal" onLayout={handleLayoutChange}>
            <Panel
              ref={sidebarPanelRef}
              defaultSize={sidebarVisible ? sidebarSizePercentage : 0}
              minSize={0}
              maxSize={50}
              order={1}
              className={`sidebar-panel ${sidebarVisible ? 'visible' : 'hidden'}`}
            >
              <ProjectSidebar theme={theme} visible={sidebarVisible} />
            </Panel>
            <PanelResizeHandle className={`main-resize-handle ${sidebarVisible ? 'visible' : 'hidden'}`} />
            <Panel
              ref={contentPanelRef}
              minSize={50}
              order={2}
              className="content-panel"
            >
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
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </ToastProvider>
  );
};

export default App; 