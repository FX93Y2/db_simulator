import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  getProjects, 
  createDefaultProject, 
  deleteProject, 
  updateProject, 
  updateProjectOrder 
} from '../../../../utils/projectApi';
import { createSafeNavigate } from '../../../../utils/navigationHelper';
import { useToastContext } from '../../../../contexts/ToastContext';

export const useProjectManagement = () => {
  const { showSuccess, showError } = useToastContext();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const navigate = useNavigate();
  const safeNavigate = createSafeNavigate(navigate);
  const location = useLocation();

  // Get currently selected project ID from the URL
  const currentProjectId = location.pathname.startsWith('/project/') 
    ? location.pathname.split('/project/')[1].split('/')[0]
    : null;

  // Listen for custom refreshProjects event
  useEffect(() => {
    const handler = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('refreshProjects', handler);
    return () => {
      window.removeEventListener('refreshProjects', handler);
    };
  }, []);

  // Load projects
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000;
    
    const loadProjects = async (isInitialLoad = false) => {
      try {
        if (mounted) {
          if (isInitialLoad || projects.length === 0) {
            setLoading(true);
          } else {
            setIsRefreshing(true);
          }
        }
        
        const projectsResult = await getProjects();
        
        if (projectsResult.success) {
          if (mounted) {
            setProjects(projectsResult.projects || []);
            retryCount = 0;
          }
        } else {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(() => loadProjects(isInitialLoad), retryDelay);
            return;
          }
          
          if (mounted && (isInitialLoad || projects.length === 0)) {
            setProjects([]);
          }
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => loadProjects(isInitialLoad), retryDelay);
          return;
        }
        
        if (mounted && (isInitialLoad || projects.length === 0)) {
          setProjects([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };
    
    const initialLoadDelay = 200;
    const timer = setTimeout(() => loadProjects(true), initialLoadDelay);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [location.pathname, refreshTrigger]);

  // Handle location state changes
  useEffect(() => {
    if (!location.state) return;
    
    if (location.state.refreshProjects) {
      setRefreshTrigger(prev => prev + 1);
    }
    
    window.history.replaceState({}, document.title);
  }, [location.state]);

  const handleOpenProject = (projectId) => {
    safeNavigate(`/project/${projectId}`);
  };

  const handleCreateProject = async (projectName) => {
    if (!projectName.trim()) {
      showError('Please enter a project name');
      return { success: false };
    }

    try {
      const result = await createDefaultProject(projectName.trim());
      
      if (result.success) {
        if (result.project) {
          const newProject = {
            ...result.project,
            display_order: projects.length
          };
          setProjects([...projects, newProject]);
        }
        
        setRefreshTrigger(prev => prev + 1);
        safeNavigate(`/project/${result.project.id}`);
        return { success: true, project: result.project };
      } else {
        showError('Failed to create project: ' + (result.error || 'Unknown error'));
        return { success: false, error: result.error };
      }
    } catch (error) {
      showError('Error creating project');
      return { success: false, error: 'Error creating project' };
    }
  };

  const handleDeleteProject = async (project) => {
    try {
      const result = await deleteProject(project.id);
      
      if (result.success) {
        setProjects(projects.filter(p => p.id !== project.id));
        
        if (project.id === currentProjectId) {
          if (window.__unsavedChangesState) {
            window.__unsavedChangesState.hasUnsavedChanges = false;
          }
          navigate('/');
        }
        
        setRefreshTrigger(prev => prev + 1);
        return { success: true };
      } else {
        showError('Failed to delete project: ' + (result.error || 'Unknown error'));
        return { success: false, error: result.error };
      }
    } catch (error) {
      showError('Error deleting project');
      return { success: false, error: 'Error deleting project' };
    }
  };

  const handleUpdateProject = async (projectId, updates) => {
    try {
      const result = await updateProject(projectId, updates);
      if (result.success) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, ...updates, updated_at: new Date().toISOString() }
              : p
          )
        );
        return { success: true };
      } else {
        showError('Failed to update project');
        return { success: false };
      }
    } catch (error) {
      showError('Error updating project');
      return { success: false };
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(projects);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setProjects(items);
    
    try {
      const projectIds = items.map(project => project.id);
      const response = await updateProjectOrder(projectIds);
      
      if (!response.success) {
        showError('Failed to save project order');
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      showError('Error saving project order');
      setRefreshTrigger(prev => prev + 1);
    }
  };

  return {
    projects,
    loading,
    isRefreshing,
    currentProjectId,
    handleOpenProject,
    handleCreateProject,
    handleDeleteProject,
    handleUpdateProject,
    handleDragEnd
  };
};