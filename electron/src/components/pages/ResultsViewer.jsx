import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Button, 
  Table, 
  Form, 
  Tabs, 
  Tab, 
  Spinner,
  Modal,
  InputGroup
} from 'react-bootstrap';
import { FiArrowLeft, FiDownload, FiPlus, FiEdit2, FiSave } from 'react-icons/fi';

// In a real implementation, this would use SQL.js to interact with the SQLite database
// This is a simplified version for demo purposes

const ResultsViewer = () => {
  const { dbPath } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [currentTable, setCurrentTable] = useState('');
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('TEXT');
  const [newColumnFormula, setNewColumnFormula] = useState('');
  
  // Load database tables on component mount
  useEffect(() => {
    const loadDatabaseInfo = async () => {
      try {
        setLoading(true);
        
        if (!dbPath) {
          return;
        }
        
        // In a real implementation, this would fetch the actual database schema
        // For now, we'll simulate loading tables from a database
        
        // Simulated tables based on our knowledge of the schema
        const simulatedTables = [
          'Project',
          'Deliverable',
          'Consultant',
          'SimulationEvent',
          'ResourceAllocation'
        ];
        
        setTables(simulatedTables);
        if (simulatedTables.length > 0) {
          setCurrentTable(simulatedTables[0]);
        }
      } catch (error) {
        console.error('Error loading database info:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadDatabaseInfo();
  }, [dbPath]);
  
  // Load table data when the current table changes
  useEffect(() => {
    const loadTableData = async () => {
      if (!currentTable) return;
      
      try {
        setLoading(true);
        
        // In a real implementation, this would execute an SQL query
        // For now, we'll generate mock data based on the table name
        
        let columns = [];
        let rows = [];
        
        // Generate mock columns and data based on the selected table
        switch (currentTable) {
          case 'Project':
            columns = ['id', 'name', 'created_at'];
            rows = Array.from({ length: 10 }, (_, i) => ({
              id: i + 1,
              name: `Project ${i + 1}`,
              created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            }));
            break;
            
          case 'Deliverable':
            columns = ['id', 'project_id', 'name', 'type', 'status'];
            rows = Array.from({ length: 30 }, (_, i) => ({
              id: i + 1,
              project_id: Math.floor(i / 3) + 1,
              name: `Deliverable ${i + 1}`,
              type: ['Requirements', 'Design', 'Implementation', 'Testing', 'Deployment'][i % 5],
              status: ['Pending', 'In Progress', 'Completed'][Math.floor(Math.random() * 3)]
            }));
            break;
            
          case 'Consultant':
            columns = ['id', 'name', 'email', 'role'];
            rows = Array.from({ length: 15 }, (_, i) => ({
              id: i + 1,
              name: `Consultant ${i + 1}`,
              email: `consultant${i + 1}@example.com`,
              role: ['Developer', 'Tester', 'Tech Lead', 'Business Analyst'][i % 4]
            }));
            break;
            
          case 'SimulationEvent':
            columns = ['id', 'entity_id', 'event_type', 'start_time', 'end_time', 'duration'];
            rows = Array.from({ length: 50 }, (_, i) => ({
              id: i + 1,
              entity_id: Math.floor(i / 5) + 1,
              event_type: ['Requirements', 'Design', 'Implementation', 'Testing', 'Deployment'][i % 5],
              start_time: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
              end_time: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000).toISOString(),
              duration: Math.floor(Math.random() * 10) + 1
            }));
            break;
            
          case 'ResourceAllocation':
            columns = ['id', 'event_id', 'resource_id', 'allocation_start', 'allocation_end'];
            rows = Array.from({ length: 80 }, (_, i) => ({
              id: i + 1,
              event_id: Math.floor(i / 2) + 1,
              resource_id: (i % 15) + 1,
              allocation_start: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
              allocation_end: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000).toISOString()
            }));
            break;
            
          default:
            columns = ['id', 'name'];
            rows = [];
        }
        
        setTableData({ columns, rows });
      } catch (error) {
        console.error('Error loading table data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTableData();
  }, [currentTable]);
  
  // Handle table selection change
  const handleTableChange = (e) => {
    setCurrentTable(e.target.value);
  };
  
  // Handle export to CSV
  const handleExport = () => {
    if (!tableData.rows.length) return;
    
    try {
      // Create CSV content
      const headers = tableData.columns.join(',');
      const rows = tableData.rows.map(row => {
        return tableData.columns.map(col => {
          // Ensure values with commas are quoted
          const value = row[col]?.toString() || '';
          return value.includes(',') ? `"${value}"` : value;
        }).join(',');
      }).join('\n');
      
      const csvContent = `${headers}\n${rows}`;
      
      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger click
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${currentTable}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Error exporting to CSV');
    }
  };
  
  // Show add column modal
  const handleAddColumn = () => {
    setNewColumnName('');
    setNewColumnType('TEXT');
    setNewColumnFormula('');
    setShowAddColumnModal(true);
  };
  
  // Close add column modal
  const handleCloseAddColumnModal = () => {
    setShowAddColumnModal(false);
  };
  
  // Add a new column
  const handleSaveNewColumn = () => {
    if (!newColumnName) {
      alert('Please enter a column name');
      return;
    }
    
    // In a real implementation, this would execute an ALTER TABLE SQL command
    // or generate a calculated column using SQL.js
    
    // For our mock implementation, add the column to our state
    const columns = [...tableData.columns, newColumnName];
    
    // Generate values for the new column using the formula
    // In a real implementation, this would evaluate the formula for each row
    const rows = tableData.rows.map(row => {
      // Simple mock implementation to simulate a formula calculation
      let value;
      
      if (newColumnType === 'TEXT') {
        value = `${newColumnName}_${row.id}`;
      } else if (newColumnType === 'INTEGER') {
        value = row.id * 10;
      } else if (newColumnType === 'REAL') {
        value = row.id * 1.5;
      } else if (newColumnType === 'FORMULA') {
        // In a real implementation, this would evaluate the formula
        // For demo, just multiply id by 100 to simulate a calculation
        value = row.id * 100;
      }
      
      return { ...row, [newColumnName]: value };
    });
    
    setTableData({ columns, rows });
    handleCloseAddColumnModal();
  };
  
  return (
    <div className="results-viewer">
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <Button 
            variant="outline-secondary" 
            className="me-3"
            onClick={() => navigate('/dashboard')}
          >
            <FiArrowLeft /> Back
          </Button>
          <h2 className="mb-0">Simulation Results</h2>
        </div>
        <div>
          <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={handleExport}
            disabled={!tableData.rows.length}
          >
            <FiDownload /> Export CSV
          </Button>
          <Button 
            variant="outline-success" 
            onClick={handleAddColumn}
            disabled={!currentTable}
          >
            <FiPlus /> Add Column
          </Button>
        </div>
      </div>
      
      <Form.Group className="mb-4">
        <Form.Label>Select Table</Form.Label>
        <Form.Select 
          value={currentTable} 
          onChange={handleTableChange}
          disabled={loading || !tables.length}
        >
          {tables.map(table => (
            <option key={table} value={table}>
              {table}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <div className="mt-2">Loading table data...</div>
        </div>
      ) : tableData.rows.length === 0 ? (
        <div className="text-center py-5">
          <p>No data available for this table.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <Table className="results-table">
            <thead>
              <tr>
                {tableData.columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, index) => (
                <tr key={index}>
                  {tableData.columns.map(column => (
                    <td key={`${index}-${column}`}>
                      {row[column] !== undefined ? String(row[column]) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      
      {/* Add Column Modal */}
      <Modal show={showAddColumnModal} onHide={handleCloseAddColumnModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Column</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Column Name</Form.Label>
              <Form.Control 
                type="text" 
                value={newColumnName} 
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Enter column name"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Column Type</Form.Label>
              <Form.Select 
                value={newColumnType} 
                onChange={(e) => setNewColumnType(e.target.value)}
              >
                <option value="TEXT">Text</option>
                <option value="INTEGER">Integer</option>
                <option value="REAL">Real (Decimal)</option>
                <option value="FORMULA">Formula</option>
              </Form.Select>
            </Form.Group>
            
            {newColumnType === 'FORMULA' && (
              <Form.Group className="mb-3">
                <Form.Label>Formula</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3}
                  value={newColumnFormula}
                  onChange={(e) => setNewColumnFormula(e.target.value)}
                  placeholder="Enter formula (e.g. [column1] * 2 + [column2])"
                />
                <Form.Text className="text-muted">
                  Use [columnName] to reference other columns.
                </Form.Text>
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseAddColumnModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveNewColumn}>
            <FiSave /> Add Column
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ResultsViewer; 