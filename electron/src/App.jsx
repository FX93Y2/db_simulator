import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';

// Layout Components
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';

// Pages
import Dashboard from './components/pages/Dashboard';
import DbConfigEditor from './components/pages/DbConfigEditor';
import SimConfigEditor from './components/pages/SimConfigEditor';
import ResultsViewer from './components/pages/ResultsViewer';

const App = () => {
  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <Sidebar />
        <div className="content-area">
          <Container fluid>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/db-config" element={<DbConfigEditor />} />
              <Route path="/db-config/:configId" element={<DbConfigEditor />} />
              <Route path="/sim-config" element={<SimConfigEditor />} />
              <Route path="/sim-config/:configId" element={<SimConfigEditor />} />
              <Route path="/results" element={<ResultsViewer />} />
              <Route path="/results/:dbPath" element={<ResultsViewer />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Container>
        </div>
      </div>
    </div>
  );
};

export default App; 