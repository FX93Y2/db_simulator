import React, { useEffect, useRef } from 'react';
import { Card, Button } from 'react-bootstrap';
import { FiX } from 'react-icons/fi';

// Simple code block component without syntax highlighting for now
const CodeBlock = ({ children }) => (
  <div className="code-example">
    <pre>
      <code>{children}</code>
    </pre>
  </div>
);

const GuideOverlay = ({ visible, activeSection, onClose, theme = 'light' }) => {
  const overlayRef = useRef(null);

  // Documentation sections as simple objects (extracted from original ConfigurationGuide)
  const documentationSections = [
    {
      id: 'introduction',
      title: 'Introduction',
      content: (
        <div>
          <p className="lead">
            Welcome to the Database Simulator Configuration Guide. This tool uses YAML configuration files to define both your database schema and simulation logic.
          </p>
          <p>The configuration is split into two main parts:</p>
          <ul>
            <li><strong>Entities Section:</strong> Defines the database schema, including tables, columns, and data generation rules</li>
            <li><strong>Simulation Section:</strong> Defines the simulation logic, including timing, resource allocation, and process flows</li>
          </ul>
          <div className="alert alert-info">
            <strong>Tip:</strong> Use the search bar in the sidebar to quickly find specific configuration options, or navigate through the sections using the navigation links.
          </div>
        </div>
      )
    },
    {
      id: 'entities',
      title: 'Entities',
      content: (
        <div>
          <p>The <code>entities</code> section defines the tables in your simulated database. Each entity represents a table with its columns (attributes) and data generation rules.</p>
          <CodeBlock>{`entities:
  - name: Consultant
    type: resource
    rows: 30
    attributes:
      - name: id
        type: pk
      - name: role
        type: resource_type
        generator:
          type: distribution
          distribution:
            type: choice
            values: ["Developer", "Tester"]
            weights: [0.7, 0.3]`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'entity-properties',
      title: 'Entity Properties',
      content: (
        <div>
          <h3>Entity Properties</h3>
          <p>Each entity has the following properties:</p>
          
          <h4><code>name</code></h4>
          <p>The name of the table (e.g., "Consultant", "Project").</p>
          
          <h4><code>type</code></h4>
          <p>Defines the entity type and its role in the simulation:</p>
          <ul>
            <li><strong>resource:</strong> A table of resources that can be assigned to tasks. Must have a fixed row count.</li>
            <li><strong>entity:</strong> A primary table in the simulation (e.g., projects, customers).</li>
            <li><strong>event:</strong> A table that records events occurring over time.</li>
          </ul>
          
          <h4><code>rows</code></h4>
          <p>The number of rows to generate for this table:</p>
          <ul>
            <li><strong>Number:</strong> Fixed number of rows (required for resource tables)</li>
            <li><strong>"n/a":</strong> Dynamic row count based on simulation events</li>
          </ul>
          
          <CodeBlock>{`- name: Consultant
  type: resource    # Resource table
  rows: 30         # Fixed 30 consultants

- name: Project
  type: entity     # Main entity
  rows: n/a        # Dynamic based on simulation`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'attributes',
      title: 'Attributes',
      content: (
        <div>
          <h3>Attributes (Table Columns)</h3>
          <p>Attributes define the columns of each table. Each attribute has a name, type, and optional generator.</p>
          
          <h4>Special Column Types</h4>
          <ul>
            <li><strong>pk:</strong> Primary Key - unique identifier for each row</li>
            <li><strong>fk:</strong> Foreign Key - references another table (requires <code>ref</code> property)</li>
            <li><strong>resource_type:</strong> Categorizes resources (used in resource_capacities)</li>
            <li><strong>event_type:</strong> Categorizes events (used in event_flows)</li>
            <li><strong>resource_id:</strong> References a resource table</li>
            <li><strong>entity_id:</strong> References an entity table</li>
            <li><strong>event_id:</strong> References an event table</li>
          </ul>
          
          <h4>Common Data Types</h4>
          <ul>
            <li><strong>string:</strong> Text data</li>
            <li><strong>datetime:</strong> Date and time values</li>
            <li><strong>integer:</strong> Whole numbers</li>
            <li><strong>float:</strong> Decimal numbers</li>
          </ul>
          
          <CodeBlock>{`attributes:
  - name: id
    type: pk                    # Primary key
  - name: department_id
    type: fk                    # Foreign key
    ref: Department.id          # References Department table
  - name: role
    type: resource_type         # Special type for resources
  - name: email
    type: string               # Regular string column`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'data-generators',
      title: 'Data Generators',
      content: (
        <div>
          <h3>Data Generators</h3>
          <p>Generators create realistic data for each column. There are three main types:</p>
          
          <h4>1. Faker Generator</h4>
          <p>Generates realistic fake data using predefined methods:</p>
          <CodeBlock>{`generator:
  type: faker
  method: name        # Generates random names
  
# Other faker methods:
# method: email       # Random email addresses
# method: company     # Company names
# method: address     # Street addresses`}</CodeBlock>
          
          <h4>2. Template Generator</h4>
          <p>Creates data from a string template with placeholders:</p>
          <CodeBlock>{`generator:
  type: template
  template: "Department_{id}"    # Creates "Department_1", "Department_2", etc.
  
# Other examples:
# template: "Project_{id}"
# template: "User_{id}_{name}"`}</CodeBlock>
          
          <h4>3. Distribution Generator</h4>
          <p>Assigns values based on probability distributions:</p>
          <CodeBlock>{`generator:
  type: distribution
  distribution:
    type: choice
    values: ["Developer", "Tester", "Manager"]
    weights: [0.6, 0.3, 0.1]     # 60% Developer, 30% Tester, 10% Manager`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'simulation-settings',
      title: 'Simulation Settings',
      content: (
        <div>
          <h3>Simulation Settings</h3>
          <p>The <code>simulation</code> section controls the overall simulation environment and timing.</p>
          
          <h4><code>duration_days</code></h4>
          <p>The total length of the simulation in days. This determines how long the simulation will run.</p>
          
          <h4><code>start_date</code></h4>
          <p>The simulation's starting date in YYYY-MM-DD format. All events will be scheduled relative to this date.</p>
          
          <h4><code>random_seed</code></h4>
          <p>A seed for the random number generator to ensure reproducible results. Using the same seed will produce identical simulation runs.</p>
          
          <CodeBlock>{`simulation:
  duration_days: 60        # Run simulation for 60 days
  start_date: 2024-06-01   # Start on June 1st, 2024
  random_seed: 42          # Seed for reproducible results`}</CodeBlock>
          
          <div className="alert alert-info">
            <strong>Tip:</strong> Use different random seeds to explore various simulation scenarios, or keep the same seed for consistent testing.
          </div>
        </div>
      )
    },
    // Add the rest of the sections... I'll include the key ones for demo
    {
      id: 'event-simulation',
      title: 'Event Simulation',
      content: (
        <div>
          <h3>Event Simulation</h3>
          <p>
            The <code>event_simulation</code> section defines the core logic of your process simulation. It controls how entities arrive, how resources are allocated, and how events flow through your process.
          </p>
          <p>This section contains several main subsections:</p>
          <ul>
            <li><strong>Entity Arrival:</strong> Controls when new entities enter the system</li>
            <li><strong>Resource Capacities:</strong> Defines available work capacity for different resource types</li>
            <li><strong>Event Flows:</strong> Defines the process flow using step-based configuration</li>
            <li><strong>Step Types:</strong> Different types of steps (event, decide, release)</li>
            <li><strong>Decide Modules:</strong> Advanced decision logic with probability and conditions</li>
          </ul>
        </div>
      )
    }
  ];

  // Find the active section content
  const activeContent = documentationSections.find(section => section.id === activeSection);

  // Handle click outside to close overlay
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling on the body when overlay is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [visible, onClose]);

  if (!visible || !activeContent) {
    return null;
  }

  return (
    <div className="guide-overlay-backdrop">
      <div 
        ref={overlayRef}
        className={`guide-overlay-card ${visible ? 'slide-in' : 'slide-out'}`}
      >
        <div className="guide-overlay-header">
          <h2 className="guide-overlay-title">{activeContent.title}</h2>
          <Button
            variant="link"
            className="guide-overlay-close"
            onClick={onClose}
            title="Close guide"
          >
            <FiX />
          </Button>
        </div>
        
        <div className="guide-overlay-content">
          {activeContent.content}
        </div>
      </div>
    </div>
  );
};

export default GuideOverlay;