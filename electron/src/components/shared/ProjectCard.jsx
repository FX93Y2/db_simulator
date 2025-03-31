import React from 'react';
import { Button } from 'react-bootstrap';
import { FiEdit2, FiPlay, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const ProjectCard = ({ 
  id, 
  name, 
  description, 
  type, 
  lastUpdated, 
  onDelete 
}) => {
  const navigate = useNavigate();
  
  const handleEdit = () => {
    if (type === 'database') {
      navigate(`/db-config/${id}`);
    } else if (type === 'simulation') {
      navigate(`/sim-config/${id}`);
    }
  };
  
  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  return (
    <div className="project-card">
      <div className="project-card__header">
        <h4>{name}</h4>
        <div className="project-card__actions">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={handleEdit}
          >
            <FiEdit2 />
          </Button>
          {type === 'simulation' && (
            <Button 
              variant="outline-success" 
              size="sm"
            >
              <FiPlay />
            </Button>
          )}
          <Button 
            variant="outline-danger" 
            size="sm" 
            onClick={handleDelete}
          >
            <FiTrash2 />
          </Button>
        </div>
      </div>
      <div className="project-card__info mb-2">
        {description || `A ${type} configuration`}
      </div>
      <div className="project-card__info text-muted">
        <small>Last updated: {formatDate(lastUpdated)}</small>
      </div>
    </div>
  );
};

export default ProjectCard; 