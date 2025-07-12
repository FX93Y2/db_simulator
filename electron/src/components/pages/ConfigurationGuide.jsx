import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Form, Card, Nav } from 'react-bootstrap';
import { FiSearch, FiBook, FiDatabase, FiSettings, FiUsers, FiClock, FiGitBranch, FiTarget, FiMonitor, FiPlay, FiFolder, FiEdit3 } from 'react-icons/fi';

const ConfigurationGuide = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState('introduction');
  const mainContentRef = useRef(null);
  const sectionRefs = useRef({});

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

  // Simple code block component without syntax highlighting for now
  const CodeBlock = ({ children }) => (
    <div className="code-example">
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );

  // Documentation sections as simple objects
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
            <li><strong>event_type:</strong> Categorizes events (used in event_sequence)</li>
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
          
          <CodeBlock>{`event_simulation:
  entity_arrival:
    # Controls how often new projects arrive
  resource_capacities:
    # Defines consultant availability
  event_flows:
    # Defines process flows using step-based configuration
    - flow_id: project_development
      initial_step: requirements
      steps:
        # Individual steps with event, decide, or release types`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'entity-arrival',
      title: 'Entity Arrival',
      content: (
        <div>
          <h3>Entity Arrival</h3>
          <p>Controls how often new entities (e.g., projects, customers) are created and enter the simulation.</p>
          
          <h4><code>interarrival_time</code></h4>
          <p>Defines the time between entity arrivals using statistical distributions:</p>
          
          <h5>Exponential Distribution</h5>
          <p>Most commonly used for arrival processes. The <code>scale</code> parameter represents the average time between arrivals.</p>
          
          <h4><code>max_entities</code></h4>
          <p>The maximum number of entities to create during the simulation:</p>
          <ul>
            <li><strong>Number:</strong> Fixed maximum (e.g., 100)</li>
            <li><strong>"n/a":</strong> Unlimited - entities keep arriving based on the distribution</li>
          </ul>
          
          <CodeBlock>{`entity_arrival:
  interarrival_time:
    distribution:
      type: exponential
      scale: 5              # Average 5 days between arrivals
  max_entities: n/a         # Unlimited arrivals
  
# Alternative with fixed limit:
entity_arrival:
  interarrival_time:
    distribution:
      type: exponential
      scale: 2              # Average 2 days between arrivals
  max_entities: 50          # Maximum 50 entities`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'resource-capacities',
      title: 'Resource Capacities',
      content: (
        <div>
          <h3>Resource Capacities</h3>
          <p>
            Defines the work capacity for different resource types. The top-level key must match a resource table name from your entities section.
          </p>
          
          <h4>Structure</h4>
          <p>Each resource table has <code>capacity_rules</code> that define capacity for each resource type:</p>
          
          <h4>Capacity Types</h4>
          
          <h5>1. Fixed Value</h5>
          <p>A simple integer representing constant capacity:</p>
          <CodeBlock>{`resource_capacities:
  Consultant:
    capacity_rules:
      - resource_type: Developer
        capacity: 2           # Each developer can handle 2 concurrent tasks`}</CodeBlock>
          
          <h5>2. Statistical Distribution</h5>
          <p>Capacity varies based on a probability distribution:</p>
          <CodeBlock>{`resource_capacities:
  Consultant:
    capacity_rules:
      - resource_type: Developer
        capacity:
          distribution:
            type: normal
            mean: 2           # Average capacity of 2
            stddev: 0.5       # Standard deviation
            min: 1            # Minimum capacity
            max: 4            # Maximum capacity`}</CodeBlock>
          
          <h5>3. Choice Distribution</h5>
          <p>Capacity chosen from specific values with weights:</p>
          <CodeBlock>{`resource_capacities:
  Consultant:
    capacity_rules:
      - resource_type: Developer
        capacity:
          distribution:
            type: choice
            values: [1, 2, 3]     # Possible capacity values
            weights: [0.2, 0.6, 0.2]  # 20% have capacity 1, 60% have 2, 20% have 3`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'event-flows',
      title: 'Event Flows',
      content: (
        <div>
          <h3>Event Flows</h3>
          <p>Defines the process flow using a modern step-based configuration system. Each flow contains a sequence of steps that entities follow through the simulation.</p>
          
          <h4>Flow Structure</h4>
          <p>Each event flow has:</p>
          <ul>
            <li><strong>flow_id:</strong> Unique identifier for the flow</li>
            <li><strong>initial_step:</strong> The first step entities enter</li>
            <li><strong>steps:</strong> List of all steps in the flow</li>
          </ul>
          
          <CodeBlock>{`event_flows:
  - flow_id: project_development
    initial_step: requirements
    steps:
      - step_id: requirements
        step_type: event
        event_config:
          name: Requirements
          duration:
            distribution:
              type: normal
              mean: 3
              stddev: 0.5
          resource_requirements:
            - resource_table: Consultant
              value: Developer
              count: 1
        next_steps: [design]
      
      - step_id: design
        step_type: event
        event_config:
          name: Design
          duration:
            distribution:
              type: normal
              mean: 5
              stddev: 1
          resource_requirements:
            - resource_table: Consultant
              value: Developer
              count: 2
        next_steps: [implementation]
      
      - step_id: implementation_decision
        step_type: decide
        decide_config:
          module_id: implementation_decision
          decision_type: probability
          outcomes:
            - outcome_id: to_testing
              next_step_id: testing
              conditions:
                - condition_type: probability
                  probability: 0.8
            - outcome_id: rework
              next_step_id: design
              conditions:
                - condition_type: probability
                  probability: 0.2`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'step-types',
      title: 'Step Types',
      content: (
        <div>
          <h3>Step Types</h3>
          <p>The modern event flow system supports three types of steps:</p>
          
          <h4>1. Event Steps</h4>
          <p>Represent actual work or activities that consume time and resources:</p>
          <CodeBlock>{`- step_id: design
  step_type: event
  event_config:
    name: Design Phase
    duration:
      distribution:
        type: normal
        mean: 5
        stddev: 1
    resource_requirements:
      - resource_table: Consultant
        value: Developer
        count: 2
  next_steps: [implementation]`}</CodeBlock>
          
          <h4>2. Decide Steps</h4>
          <p>Handle decision logic and probability-based routing:</p>
          <CodeBlock>{`- step_id: quality_check
  step_type: decide
  decide_config:
    module_id: quality_decision
    decision_type: probability
    outcomes:
      - outcome_id: pass
        next_step_id: deployment
        conditions:
          - condition_type: probability
            probability: 0.85
      - outcome_id: fail
        next_step_id: rework
        conditions:
          - condition_type: probability
            probability: 0.15`}</CodeBlock>
          
          <h4>3. Release Steps</h4>
          <p>Mark the completion of an entity and release all allocated resources:</p>
          <CodeBlock>{`- step_id: project_complete
  step_type: release
  event_config:
    name: Project Completion`}</CodeBlock>
        </div>
      )
    },
    {
      id: 'decide-modules',
      title: 'Decide Modules',
      content: (
        <div>
          <h3>Decide Modules</h3>
          <p>Decide modules provide advanced decision logic for routing entities through different paths in your process flow.</p>
          
          <h4>Decision Types</h4>
          
          <h5>Probability Decisions</h5>
          <p>Route entities based on probability distributions. Supports both binary (2-way) and N-way decisions:</p>
          
          <h6>2-way by chance</h6>
          <CodeBlock>{`decide_config:
  module_id: pass_fail_check
  decision_type: probability
  outcomes:
    - outcome_id: pass
      next_step_id: continue_process
      conditions:
        - condition_type: probability
          probability: 0.8    # 80% pass rate
    - outcome_id: fail
      next_step_id: rework
      conditions:
        - condition_type: probability
          probability: 0.2    # 20% fail rate`}</CodeBlock>
          
          <h6>N-way by chance</h6>
          <CodeBlock>{`decide_config:
  module_id: priority_routing
  decision_type: probability
  outcomes:
    - outcome_id: high_priority
      next_step_id: fast_track
      conditions:
        - condition_type: probability
          probability: 0.2    # 20% high priority
    - outcome_id: medium_priority
      next_step_id: normal_track
      conditions:
        - condition_type: probability
          probability: 0.6    # 60% medium priority
    - outcome_id: low_priority
      next_step_id: slow_track
      conditions:
        - condition_type: probability
          probability: 0.2    # 20% low priority`}</CodeBlock>
          
          <h5>2-way by condition & n-way by condition (Future)</h5>
          <p>Route entities based on attributes or system state (planned for future implementation):</p>
          <CodeBlock>{`# Future feature - not yet implemented
decide_config:
  module_id: attribute_based_routing
  decision_type: condition
  outcomes:
    - outcome_id: vip_customer
      next_step_id: priority_service
      conditions:
        - condition_type: attribute_value
          attribute: customer_type
          operator: equals
          value: VIP
    - outcome_id: regular_customer
      next_step_id: standard_service
      conditions:
        - condition_type: default`}</CodeBlock>
          
          <div className="alert alert-info">
            <strong>Note:</strong> The system automatically normalizes probabilities to ensure they sum to 1.0, and uses proper cumulative distribution for accurate probability-based routing.
          </div>
        </div>
      )
    }
  ];

  // Scroll position persistence
  useEffect(() => {
    // Restore scroll position on mount with a delay to ensure content is rendered
    const restoreScrollPosition = () => {
      const savedScrollPosition = sessionStorage.getItem('configGuideScrollPosition');
      if (savedScrollPosition && mainContentRef.current) {
        const scrollTop = parseInt(savedScrollPosition, 10);
        mainContentRef.current.scrollTop = scrollTop;
      }
    };

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(restoreScrollPosition, 100);

    // Save scroll position function
    const saveScrollPosition = () => {
      if (mainContentRef.current) {
        sessionStorage.setItem('configGuideScrollPosition', mainContentRef.current.scrollTop.toString());
      }
    };

    // Save scroll position when user navigates away
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };

    // Save scroll position when page becomes hidden (user switches tabs or apps)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveScrollPosition();
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function - save on component unmount
    return () => {
      clearTimeout(timeoutId);
      saveScrollPosition();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Additional scroll position saving during scroll events (debounced)
  useEffect(() => {
    let scrollSaveTimeout;

    const handleScroll = () => {
      if (mainContentRef.current) {
        // Debounce the save operation to avoid too frequent saves
        clearTimeout(scrollSaveTimeout);
        scrollSaveTimeout = setTimeout(() => {
          sessionStorage.setItem('configGuideScrollPosition', mainContentRef.current.scrollTop.toString());
        }, 500);
      }
    };

    const mainContent = mainContentRef.current;
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll);
      return () => {
        mainContent.removeEventListener('scroll', handleScroll);
        clearTimeout(scrollSaveTimeout);
      };
    }
  }, []);

  // Scroll spy functionality
  useEffect(() => {
    const handleScroll = () => {
      if (!mainContentRef.current) return;

      const scrollTop = mainContentRef.current.scrollTop;
      const sections = Object.keys(sectionRefs.current);
      
      // Find the section that's currently in view
      let currentSection = sections[0];
      
      for (const sectionId of sections) {
        const element = sectionRefs.current[sectionId];
        if (element) {
          const rect = element.getBoundingClientRect();
          const containerRect = mainContentRef.current.getBoundingClientRect();
          
          // Check if section is in view (top of section is above middle of container)
          if (rect.top - containerRect.top < containerRect.height / 2) {
            currentSection = sectionId;
          }
        }
      }
      
      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    const mainContent = mainContentRef.current;
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll);
      return () => mainContent.removeEventListener('scroll', handleScroll);
    }
  }, [activeSection]);

  // Filter content based on search term
  const filteredContent = documentationSections.filter((section) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      section.title.toLowerCase().includes(searchLower) ||
      section.id.toLowerCase().includes(searchLower)
    );
  });

  // Handle navigation click
  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
    // Scroll to section
    const element = sectionRefs.current[sectionId];
    if (element && mainContentRef.current) {
      const containerRect = mainContentRef.current.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scrollTop = mainContentRef.current.scrollTop + elementRect.top - containerRect.top - 20;
      
      mainContentRef.current.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  };

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
    <Container fluid className="configuration-guide">
      <Row>
        {/* Left Sidebar Navigation */}
        <Col className="sidebar-nav">
          <div className="sticky-nav">
            {/* Search Bar in Sidebar */}
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
              <h5><FiBook className="me-2" />Configuration Guide</h5>
            </div>
            <Nav className="flex-column">
              {navigationItems.map(item => renderNavItem(item))}
            </Nav>
          </div>
        </Col>

        {/* Main Content Area */}
        <Col className="main-content" ref={mainContentRef}>
          {/* Documentation Content */}
          <div className="documentation-content">
            {filteredContent.length > 0 ? (
              filteredContent.map((section) => (
                <Card 
                  key={section.id} 
                  id={section.id} 
                  className="content-section mb-4"
                  ref={el => sectionRefs.current[section.id] = el}
                >
                  <Card.Body>
                    <h2 className="section-title">{section.title}</h2>
                    <div className="section-content">
                      {section.content}
                    </div>
                  </Card.Body>
                </Card>
              ))
            ) : (
              <Card className="content-section">
                <Card.Body>
                  <div className="text-center py-5">
                    <FiSearch size={48} className="text-muted mb-3" />
                    <h5 className="text-muted">No results found</h5>
                    <p className="text-muted">
                      Try adjusting your search terms or browse the navigation sidebar.
                    </p>
                  </div>
                </Card.Body>
              </Card>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default ConfigurationGuide;