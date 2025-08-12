import React, { useState, useCallback } from 'react';
import { Nav, Form } from 'react-bootstrap';
import { FiSearch, FiBook, FiDatabase, FiSettings, FiUsers, FiClock, FiGitBranch, FiTarget, FiMonitor, FiPlay, FiFolder, FiEdit3 } from 'react-icons/fi';

const NavigationSidebar = ({ theme = 'light', visible = true, onSectionSelect, activeSection }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Navigation items with their corresponding sections
  const navigationItems = [
    { id: 'introduction', label: 'Introduction', icon: FiBook },
    { id: 'entities', label: 'Entities', icon: FiDatabase, children: [
      { id: 'entity-properties', label: 'Entity Properties' },
      { id: 'attributes', label: 'Attributes' },
      { id: 'data-generators', label: 'Data Generators' }
    ]},
    { id: 'simulation-settings', label: 'Simulation Settings', icon: FiClock },
    { id: 'event-simulation', label: 'Event Simulation', icon: FiSettings, children: [
      { id: 'entity-arrival', label: 'Entity Arrival' },
      { id: 'resource-capacities', label: 'Resource Capacities' },
      { id: 'event-flows', label: 'Event Flows' },
      { id: 'step-types', label: 'Step Types' },
      { id: 'decide-modules', label: 'Decide Modules' }
    ]}
  ];

  // Filter navigation items based on search term
  const filteredNavigationItems = navigationItems.filter((item) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    // Check main item
    if (item.label.toLowerCase().includes(searchLower) || 
        item.id.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Check children
    if (item.children) {
      return item.children.some(child => 
        child.label.toLowerCase().includes(searchLower) ||
        child.id.toLowerCase().includes(searchLower)
      );
    }
    
    return false;
  });

  // Handle navigation click
  const handleNavClick = useCallback((sectionId) => {
    if (onSectionSelect) {
      onSectionSelect(sectionId);
    }
  }, [onSectionSelect]);

  // Render navigation item
  const renderNavItem = (item, level = 0) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id}>
        <Nav.Link
          className={`nav-item-custom ${isActive ? 'active' : ''} level-${level}`}
          onClick={() => handleNavClick(item.id)}
        >
          {Icon && <Icon className="me-2" />}
          {item.label}
        </Nav.Link>
        {hasChildren && (
          <div className="nav-children">
            {item.children.map(child => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`navigation-sidebar ${visible ? 'visible' : 'hidden'}`}>
      <div className="sidebar-header">
        <h5 className="sidebar-title">Configuration Guide</h5>
      </div>
      
      <div className="sidebar-content">
        {/* Search Section */}
        <div className="search-section mb-3">
          <Form.Group>
            <div className="search-input-wrapper">
              <FiSearch className="search-icon" />
              <Form.Control
                type="text"
                placeholder="Search documentation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                size="sm"
              />
            </div>
          </Form.Group>
        </div>

        <div className="nav-header">
          <h6><FiBook className="me-2" />Topics</h6>
        </div>
        
        <Nav className="flex-column">
          {filteredNavigationItems.map(item => renderNavItem(item))}
        </Nav>
        
        {filteredNavigationItems.length === 0 && searchTerm && (
          <div className="no-results">
            <div className="text-center py-3 text-muted">
              <FiSearch size={24} className="mb-2" />
              <p className="mb-0">No results found</p>
              <small>Try adjusting your search terms</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationSidebar;