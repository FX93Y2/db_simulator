import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FiHome, 
  FiDatabase, 
  FiActivity, 
  FiBarChart2
} from 'react-icons/fi';

const Sidebar = () => {
  return (
    <div className="app-sidebar">
      <nav>
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FiHome /> Dashboard
        </NavLink>
        <NavLink 
          to="/db-config" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FiDatabase /> Database Configuration
        </NavLink>
        <NavLink 
          to="/sim-config" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FiActivity /> Simulation Configuration
        </NavLink>
        <NavLink 
          to="/results" 
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <FiBarChart2 /> Results Visualization
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar; 