import React, { useState } from 'react';
import { Container, Row, Col, Button, Modal, Form, Spinner } from 'react-bootstrap';
import { FiDatabase, FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { createDefaultProject } from '../../utils/projectApi';

const WelcomePage = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpenCreateModal = () => {
    setNewProjectName('');
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      setLoading(true);
      const result = await createDefaultProject(newProjectName.trim());
      
      if (result.success) {
        handleCloseCreateModal();
        // Navigate to the new project
        navigate(`/project/${result.project.id}`);
      } else {
        alert('Failed to create project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="welcome-page">
      <Row className="justify-content-center align-items-center">
        <Col md={8} lg={6} className="text-center">
          <div className="welcome-card">
            <div className="welcome-icon">
              <FiDatabase size={60} />
            </div>
            <h1 className="mt-4">Start Building Your Database</h1>
            <p className="text-muted my-4">
              Create a new project to begin designing your database structure and simulating events.
              Select an existing project from the sidebar or create a new one to get started.
            </p>
            <Button 
              variant="primary" 
              size="lg" 
              onClick={handleOpenCreateModal}
              className="mt-3"
            >
              <FiPlus /> Create New Project
            </Button>
          </div>
        </Col>
      </Row>

      {/* Create Project Modal */}
      <Modal show={showCreateModal} onHide={handleCloseCreateModal}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Project Name</Form.Label>
            <Form.Control
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseCreateModal}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateProject}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" animation="border" className="me-2" /> : <FiPlus className="me-2" />}
            Create Project
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default WelcomePage; 