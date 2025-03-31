/**
 * Utilities for working with projects
 */

// Function to get all projects
export const getProjects = async () => {
  try {
    console.log("Fetching projects from API...");
    const result = await window.api.getProjects();
    
    if (result.success) {
      console.log(`Successfully loaded ${result.projects?.length || 0} projects`);
    } else {
      console.warn("API returned failure when fetching projects:", result.error || "Unknown error");
    }
    
    return result;
  } catch (error) {
    console.error('Error getting projects:', error);
    return { success: false, error: 'Failed to get projects', errorDetails: error.toString() };
  }
};

// Function to get a specific project
export const getProject = async (projectId) => {
  try {
    const result = await window.api.getProject(projectId);
    return result;
  } catch (error) {
    console.error(`Error getting project ${projectId}:`, error);
    return { success: false, error: 'Failed to get project' };
  }
};

// Function to create a new project
export const createProject = async (projectData) => {
  try {
    const result = await window.api.createProject(projectData);
    return result;
  } catch (error) {
    console.error('Error creating project:', error);
    return { success: false, error: 'Failed to create project' };
  }
};

// Function to update a project
export const updateProject = async (projectId, projectData) => {
  try {
    const result = await window.api.updateProject(projectId, projectData);
    return result;
  } catch (error) {
    console.error(`Error updating project ${projectId}:`, error);
    return { success: false, error: 'Failed to update project' };
  }
};

// Function to delete a project
export const deleteProject = async (projectId) => {
  try {
    const result = await window.api.deleteProject(projectId);
    return result;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    return { success: false, error: 'Failed to delete project' };
  }
};

// Project configuration functions

// Function to get a project's database configuration
export const getProjectDbConfig = async (projectId) => {
  try {
    const result = await window.api.getProjectDbConfig(projectId);
    return result;
  } catch (error) {
    console.error(`Error getting DB config for project ${projectId}:`, error);
    return { success: false, error: 'Failed to get database configuration' };
  }
};

// Function to save a project's database configuration
export const saveProjectDbConfig = async (projectId, configData) => {
  try {
    const result = await window.api.saveProjectDbConfig(projectId, configData);
    return result;
  } catch (error) {
    console.error(`Error saving DB config for project ${projectId}:`, error);
    return { success: false, error: 'Failed to save database configuration' };
  }
};

// Function to get a project's simulation configuration
export const getProjectSimConfig = async (projectId) => {
  try {
    const result = await window.api.getProjectSimConfig(projectId);
    return result;
  } catch (error) {
    console.error(`Error getting simulation config for project ${projectId}:`, error);
    return { success: false, error: 'Failed to get simulation configuration' };
  }
};

// Function to save a project's simulation configuration
export const saveProjectSimConfig = async (projectId, configData) => {
  try {
    const result = await window.api.saveProjectSimConfig(projectId, configData);
    return result;
  } catch (error) {
    console.error(`Error saving simulation config for project ${projectId}:`, error);
    return { success: false, error: 'Failed to save simulation configuration' };
  }
};

// Function to clear all configurations
export const clearAllConfigurations = async (includeProjectConfigs = true) => {
  try {
    console.log(`Clearing all configurations (including project configs: ${includeProjectConfigs})`);
    const result = await window.api.clearConfigs(includeProjectConfigs);
    return result;
  } catch (error) {
    console.error('Error clearing configurations:', error);
    return { success: false, error: 'Failed to clear configurations' };
  }
};

// Helper function to format dates for display
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch (error) {
    return dateString;
  }
};

// Helper function to create a new project with default values
export const createDefaultProject = async (name = 'New Project') => {
  const projectData = {
    name,
    description: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  return await createProject(projectData);
}; 