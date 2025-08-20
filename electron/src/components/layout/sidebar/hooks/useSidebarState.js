import { useState, useEffect } from 'react';

export const useSidebarState = () => {
  const [expandedProjects, setExpandedProjects] = useState({});
  const [isCompact, setIsCompact] = useState(false);
  const [contextMenu, setContextMenu] = useState({ 
    visible: false, 
    x: 0, 
    y: 0, 
    project: null 
  });

  // Check sidebar width and set compact mode
  useEffect(() => {
    const handleResize = () => {
      const sidebar = document.querySelector('.app-sidebar');
      if (sidebar) {
        setIsCompact(sidebar.offsetWidth < 200);
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) {
      resizeObserver.observe(sidebar);
    }

    return () => {
      if (sidebar) {
        resizeObserver.unobserve(sidebar);
      }
      resizeObserver.disconnect();
    };
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  const toggleProjectExpansion = (projectId, loadResults) => {
    setExpandedProjects(prev => {
      const newState = { ...prev };
      const wasExpanded = prev[projectId];
      
      // If toggling to expanded and we need to load results
      if (!wasExpanded && loadResults) {
        loadResults(projectId);
      }
      
      newState[projectId] = !wasExpanded;
      return newState;
    });
  };

  const expandProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: true
    }));
  };

  const handleProjectContextMenu = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      project: project
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, project: null });
  };

  return {
    expandedProjects,
    isCompact,
    contextMenu,
    toggleProjectExpansion,
    expandProject,
    handleProjectContextMenu,
    closeContextMenu
  };
};