import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import SplitPane from 'react-split-pane';

// Layout Components
import Header from './components/layout/Header';
import ProjectSidebar from './components/layout/Sidebar';

// Pages
import WelcomePage from './components/pages/WelcomePage';
import ProjectPage from './components/pages/ProjectPage';
import DbConfigEditor from './components/pages/DbConfigEditor';
import SimConfigEditor from './components/pages/SimConfigEditor';
import ResultsViewer from './components/pages/ResultsViewer';

const App = () => {
  // Store sidebar width in state to persist between renders
  const [sidebarWidth, setSidebarWidth] = useState(250);

  // Get saved sidebar width from localStorage on initial load
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth, 10));
    }
  }, []);

  // Save sidebar width to localStorage when it changes
  const handleSidebarResize = (newSize) => {
    // Add min/max constraints for better UX
    const limitedSize = Math.min(Math.max(newSize, 150), 500);
    setSidebarWidth(limitedSize);
    localStorage.setItem('sidebarWidth', limitedSize.toString());
  };

  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <SplitPane
          split="vertical"
          minSize={150}
          maxSize={500}
          defaultSize={sidebarWidth}
          onChange={handleSidebarResize}
          paneStyle={{ overflow: 'auto' }}
        >
          <ProjectSidebar />
          <div className="content-area">
            <Container fluid>
              <Routes>
                {/* Welcome and dashboard */}
                <Route path="/" element={<WelcomePage />} />
                
                {/* Project routes */}
                <Route path="/project/:projectId" element={<ProjectPage />} />
                <Route path="/project/:projectId/:activeTab" element={<ProjectPage />} />
                <Route path="/project/:projectId/results/:resultId" element={<ProjectPage />} />
                
                {/* Standalone configuration routes */}
                <Route path="/db-config" element={<DbConfigEditor />} />
                <Route path="/db-config/:configId" element={<DbConfigEditor />} />
                <Route path="/sim-config" element={<SimConfigEditor />} />
                <Route path="/sim-config/:configId" element={<SimConfigEditor />} />
                
                {/* Results routes */}
                <Route path="/results/:databasePath" element={<ResultsViewer />} />
                
                {/* Default catch-all route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Container>
          </div>
        </SplitPane>
      </div>
    </div>
  );
};

export default App; 