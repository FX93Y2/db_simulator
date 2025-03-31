import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';

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
  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
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
      </div>
    </div>
  );
};

export default App; 