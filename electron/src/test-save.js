// Test script to verify save functionality through Electron's IPC
console.log("Starting API test through Electron IPC...");

async function testSaveConfig() {
  try {
    // First, get all projects
    console.log("Getting projects...");
    const projectsResult = await window.api.getProjects();
    console.log("Projects result:", projectsResult);
    
    if (projectsResult.success && projectsResult.projects && projectsResult.projects.length > 0) {
      const projectId = projectsResult.projects[0].id;
      console.log(`Using project ID: ${projectId}`);
      
      // Test saving DB config
      console.log("Testing save project DB config...");
      const dbConfigData = {
        name: `Test DB Config ${Date.now()}`,
        content: `
# Test database configuration
entities:
  - name: TestTable
    rows: 100
    attributes:
      - name: id
        type: pk
      - name: name
        type: string
        generator:
          type: faker
          method: name
        `,
        description: "Test DB config via IPC"
      };
      
      const dbConfigResult = await window.api.saveProjectDbConfig(projectId, dbConfigData);
      console.log("DB Config save result:", dbConfigResult);
      
      // Test saving Sim config
      console.log("Testing save project Sim config...");
      const simConfigData = {
        name: `Test Sim Config ${Date.now()}`,
        content: `
# Test simulation configuration
simulation:
  duration_days: 30
  start_date: 2024-01-01
  random_seed: 42

event_simulation:
  table_specification:
    entity_table: Project
    event_table: Deliverable
    resource_table: Consultant
        `,
        description: "Test Sim config via IPC"
      };
      
      const simConfigResult = await window.api.saveProjectSimConfig(projectId, simConfigData);
      console.log("Sim Config save result:", simConfigResult);
      
      // Add results to the document body for visual inspection
      document.body.innerHTML += `
        <h3>Test Results:</h3>
        <h4>DB Config Save:</h4>
        <pre>${JSON.stringify(dbConfigResult, null, 2)}</pre>
        <h4>Sim Config Save:</h4>
        <pre>${JSON.stringify(simConfigResult, null, 2)}</pre>
      `;
    } else {
      console.error("No projects found!");
      document.body.innerHTML += `<p>Error: No projects found!</p>`;
    }
  } catch (error) {
    console.error("Test error:", error);
    document.body.innerHTML += `<p>Error: ${error.message}</p>`;
  }
}

// Run the test when document is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', testSaveConfig);
} else {
  testSaveConfig();
} 