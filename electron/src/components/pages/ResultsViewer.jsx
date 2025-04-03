import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Spinner, 
  Form, 
  Tabs, 
  Tab, 
  Table,
  Modal,
  InputGroup
} from 'react-bootstrap';
import { 
  FiArrowLeft, 
  FiDatabase, 
  FiList, 
  FiBarChart2, 
  FiDownload,
  FiFolder
} from 'react-icons/fi';
import ChartView from '../shared/ChartView';
import {
  getSimulationSummary,
  getDatabaseTables,
  getTableData,
  exportDatabaseToCSV
} from '../../utils/resultsApi';

const ResultsViewer = ({ projectId, isProjectTab }) => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [selectedView, setSelectedView] = useState('table'); // 'table' or 'chart'
  const [chartConfiguration, setChartConfiguration] = useState({
    chartType: 'line',
    xAxis: '',
    yAxis: '',
    groupBy: ''
  });
  const [databasePath, setDatabasePath] = useState('');
  
  // Export-related state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  
  // Get the selected table from the URL query parameter
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tableParam = queryParams.get('table');
    
    if (tableParam && tables.includes(tableParam)) {
      setSelectedTable(tableParam);
    }
  }, [location.search, tables]);
  
  // Construct database path from resultId and projectId
  useEffect(() => {
    if (resultId) {
      let dbPath;
      
      // Log for debugging
      console.log("ResultsViewer constructing database path with:", {
        resultId,
        projectId,
        isProjectTab
      });
      
      // Check if resultId already contains a path
      if (resultId.includes('/') || resultId.includes('\\') || resultId.endsWith('.db')) {
        // This is already a full path or filename with extension
        dbPath = resultId;
        console.log("Using resultId as database path:", dbPath);
      } else if (projectId) {
        // Construct a project-specific path
        dbPath = `output/${projectId}/${resultId}.db`;
        console.log("Setting project-specific database path:", dbPath);
      } else {
        // For standalone results (not in a project context)
        dbPath = `output/${resultId}.db`;
        console.log("Setting standalone database path:", dbPath);
      }
      
      console.log("Final database path for querying:", dbPath);
      setDatabasePath(dbPath);
      
      // Force refresh by scanning for project results if we have a projectId
      if (projectId) {
        console.log("Force refreshing results for project:", projectId);
        window.api.scanProjectResults(projectId)
          .then(result => {
            if (result.success && result.results) {
              console.log("Scan found", result.results.length, "results:", result.results);
              
              // Check if our result ID is in the list
              const matchingResult = result.results.find(r => 
                r.id === resultId || 
                r.path === dbPath || 
                r.path === `output/${projectId}/${resultId}.db`
              );
              
              if (matchingResult) {
                console.log("Found matching result:", matchingResult);
                // Update path if it differs
                if (matchingResult.path !== dbPath) {
                  console.log("Updating database path to:", matchingResult.path);
                  setDatabasePath(matchingResult.path);
                }
              } else {
                console.log("Result not found in project scan results");
              }
            }
          })
          .catch(err => {
            console.error("Error scanning for results:", err);
          });
      }
    }
  }, [resultId, projectId, isProjectTab]);
  
  // Load database info and tables
  useEffect(() => {
    const loadDatabaseInfo = async () => {
      if (!databasePath) return;
      
      try {
        setLoading(true);
        console.log("Loading database info from path:", databasePath);
        
        // Get basic info about the simulation results
        const resultInfo = await getSimulationSummary(databasePath);
        if (resultInfo.success) {
          setResults(resultInfo.data);
          console.log("Loaded simulation results:", resultInfo.data);
        } else {
          console.error("Failed to load simulation results:", resultInfo.error);
          alert(`Error loading simulation results: ${resultInfo.error}`);
        }
        
        // Get list of tables in the database
        const tablesResult = await getDatabaseTables(databasePath);
        if (tablesResult.success && tablesResult.tables && tablesResult.tables.length > 0) {
          setTables(tablesResult.tables);
          
          // Check if there's a table in the URL query
          const queryParams = new URLSearchParams(location.search);
          const tableParam = queryParams.get('table');
          
          // Set selected table from query parameter or default to first table
          if (tableParam && tablesResult.tables.includes(tableParam)) {
            setSelectedTable(tableParam);
          } else {
            setSelectedTable(tablesResult.tables[0]);
          }
          
          console.log("Loaded tables:", tablesResult.tables);
        } else {
          console.error("Failed to load database tables:", tablesResult.error || "No tables found");
          if (tablesResult.error) {
            alert(`Error loading database tables: ${tablesResult.error}`);
          }
        }
      } catch (error) {
        console.error('Error loading database info:', error);
        alert(`Error loading database info: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    if (databasePath) {
      loadDatabaseInfo();
    }
  }, [databasePath, location.search]);
  
  // Load table data when selected table changes
  useEffect(() => {
    const loadTableData = async () => {
      if (!selectedTable || !databasePath) return;
      
      try {
        setLoading(true);
        console.log("Loading data for table:", selectedTable, "from path:", databasePath);
        
        // Get data for the selected table
        const dataResult = await getTableData(databasePath, selectedTable);
        
        if (dataResult.success) {
          setTableData(dataResult.data || []);
          console.log("Loaded table data:", dataResult.data ? dataResult.data.length : 0, "rows");
          
          // Extract column names from the first row
          if (dataResult.data && dataResult.data.length > 0) {
            setTableColumns(Object.keys(dataResult.data[0]));
            
            // Set default chart configuration
            if (Object.keys(dataResult.data[0]).length >= 2) {
              setChartConfiguration({
                ...chartConfiguration,
                xAxis: Object.keys(dataResult.data[0])[0],
                yAxis: Object.keys(dataResult.data[0])[1]
              });
            }
          } else {
            setTableColumns([]);
          }
        } else {
          console.error("Failed to load table data:", dataResult.error);
        }
      } catch (error) {
        console.error('Error loading table data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (selectedTable && databasePath) {
      loadTableData();
    }
  }, [selectedTable, databasePath]);
  
  // Handle showing the export modal
  const handleShowExportModal = () => {
    setExportPath('');
    setShowExportModal(true);
  };
  
  // Handle closing the export modal
  const handleCloseExportModal = () => {
    setShowExportModal(false);
  };
  
  // Handle selecting a directory for export
  const handleSelectExportDirectory = async () => {
    try {
      const result = await window.api.showDirectoryPicker({
        title: 'Select Export Directory',
        buttonLabel: 'Export Here'
      });
      
      if (result.success) {
        setExportPath(result.path);
      } else if (!result.canceled && result.error) {
        alert(`Error selecting directory: ${result.error}`);
      }
    } catch (error) {
      console.error('Error showing directory picker:', error);
      alert(`Error selecting directory: ${error.message}`);
    }
  };
  
  // Handle exporting data with custom path
  const handleExportWithCustomPath = async () => {
    try {
      setExportLoading(true);
      console.log("Exporting database:", databasePath, "to custom path:", exportPath);
      
      const result = await exportDatabaseToCSV(databasePath, exportPath);
      
      if (result.success) {
        handleCloseExportModal();
        alert(
          `Export completed successfully!\n\n` +
          `Location: ${result.path}\n` +
          `Tables exported: ${result.tables}\n` +
          `Total rows: ${result.totalRows}\n\n` +
          `The data has been saved to a folder named after the database.`
        );
      } else {
        alert(`Error exporting database: ${result.error}`);
      }
    } catch (error) {
      console.error('Error exporting database:', error);
      alert(`Error exporting database: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };
  
  // Handle exporting data to default location
  const handleExportToDefault = async () => {
    try {
      setLoading(true);
      console.log("Exporting database to default location:", databasePath);
      
      const result = await exportDatabaseToCSV(databasePath);
      
      if (result.success) {
        handleCloseExportModal();
        alert(
          `Export completed successfully!\n\n` +
          `Location: ${result.path}\n` +
          `Tables exported: ${result.tables}\n` +
          `Total rows: ${result.totalRows}\n\n` +
          `The data has been saved to a folder named after the database.`
        );
      } else {
        alert(`Error exporting database: ${result.error}`);
      }
    } catch (error) {
      console.error('Error exporting database:', error);
      alert(`Error exporting database: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Change the table selection by updating the URL query parameter
  const changeSelectedTable = (tableName) => {
    // Create URL with the new table parameter
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('table', tableName);
    
    // Navigate to the same path but with updated query parameter
    if (projectId) {
      navigate(`/project/${projectId}/results/${resultId}?${searchParams.toString()}`);
    } else {
      navigate(`/results/${resultId}?${searchParams.toString()}`);
    }
  };
  
  // Handle chart configuration changes
  const handleChartConfigChange = (field, value) => {
    setChartConfiguration({
      ...chartConfiguration,
      [field]: value
    });
  };
  
  // Handle the back button
  const handleBack = () => {
    if (projectId) {
      navigate(`/project/${projectId}`);
    } else {
      navigate('/');
    }
  };
  
  // Display the current table name
  const renderTableHeader = () => {
    if (!selectedTable) return "No table selected";
    return (
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="m-0">Table: {selectedTable}</h5>
        {tables.length > 0 && (
          <div className="table-pagination">
            <Button 
              size="sm"
              className="btn-custom-toolbar"
              onClick={() => {
                const currentIndex = tables.indexOf(selectedTable);
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : tables.length - 1;
                changeSelectedTable(tables[prevIndex]);
              }}
            >
              Previous
            </Button>
            <span className="mx-2">
              {tables.indexOf(selectedTable) + 1} of {tables.length}
            </span>
            <Button 
              size="sm"
              className="btn-custom-toolbar"
              onClick={() => {
                const currentIndex = tables.indexOf(selectedTable);
                const nextIndex = currentIndex < tables.length - 1 ? currentIndex + 1 : 0;
                changeSelectedTable(tables[nextIndex]);
              }}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="results-viewer">
      {loading && !results ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <div className="mt-2">Loading results...</div>
        </div>
      ) : (
        <>
          {results && (
            <Card className="mb-4 dashboard-card">
              <Card.Body>
                <div className="dashboard-card__header">
                  <h3>Simulation Summary</h3>
                  {!isProjectTab && (
                    <Button 
                      className="btn-custom-toolbar" 
                      onClick={handleShowExportModal}
                      disabled={loading}
                      title="Export Data"
                    >
                      <FiDownload />
                    </Button>
                  )}
                </div>
                <div className="dashboard-card__content">
                  <Row>
                    <Col md={6}>
                      <p><strong>Simulation ID:</strong> {results.simulationId || 'N/A'}</p>
                      <p><strong>Run Date:</strong> {results.runDate || 'N/A'}</p>
                      <p><strong>Duration:</strong> {results.duration || 'N/A'} days</p>
                    </Col>
                    <Col md={6}>
                      <p><strong>Entities Generated:</strong> {results.entitiesCount || 0}</p>
                      <p><strong>Events Processed:</strong> {results.eventsCount || 0}</p>
                      <p><strong>Database:</strong> {databasePath ? databasePath.split('/').pop() : 'N/A'}</p>
                    </Col>
                  </Row>
                </div>
              </Card.Body>
            </Card>
          )}
          
          {/* Table header with current table name and navigation */}
          {renderTableHeader()}
          
          <div className="mb-3">
            <Tabs
              activeKey={selectedView}
              onSelect={(key) => setSelectedView(key)}
              className="mb-3"
            >
              <Tab 
                eventKey="table" 
                title={
                  <span>
                    <FiList className="me-2" />
                    Table View
                  </span>
                }
              />
              <Tab 
                eventKey="chart" 
                title={
                  <span>
                    <FiBarChart2 className="me-2" />
                    Chart View
                  </span>
                }
              />
            </Tabs>
          </div>
          
          {selectedView === 'table' ? (
            <div className="table-responsive">
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" size="sm" />
                  <span className="ms-2">Loading table data...</span>
                </div>
              ) : tableData.length === 0 ? (
                <div className="text-center py-4">
                  <p>No data available in this table</p>
                </div>
              ) : (
                <Table striped bordered hover className="results-table">
                  <thead>
                    <tr>
                      {tableColumns.map(column => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, index) => (
                      <tr key={index}>
                        {tableColumns.map(column => (
                          <td key={`${index}-${column}`}>
                            {row[column] !== null && row[column] !== undefined ? String(row[column]) : 'null'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          ) : (
            <div>
              <Row className="mb-3">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Chart Type</Form.Label>
                    <Form.Select
                      value={chartConfiguration.chartType}
                      onChange={(e) => handleChartConfigChange('chartType', e.target.value)}
                    >
                      <option value="line">Line Chart</option>
                      <option value="bar">Bar Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="scatter">Scatter Plot</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>X Axis</Form.Label>
                    <Form.Select
                      value={chartConfiguration.xAxis}
                      onChange={(e) => handleChartConfigChange('xAxis', e.target.value)}
                    >
                      <option value="">Select X Axis</option>
                      {tableColumns.map(column => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Y Axis</Form.Label>
                    <Form.Select
                      value={chartConfiguration.yAxis}
                      onChange={(e) => handleChartConfigChange('yAxis', e.target.value)}
                    >
                      <option value="">Select Y Axis</option>
                      {tableColumns.map(column => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Group By</Form.Label>
                    <Form.Select
                      value={chartConfiguration.groupBy}
                      onChange={(e) => handleChartConfigChange('groupBy', e.target.value)}
                    >
                      <option value="">No Grouping</option>
                      {tableColumns.map(column => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              
              <div className="chart-container" style={{ height: '400px' }}>
                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" />
                    <div className="mt-2">Loading chart data...</div>
                  </div>
                ) : tableData.length === 0 ? (
                  <div className="text-center py-4">
                    <p>No data available for chart</p>
                  </div>
                ) : !chartConfiguration.xAxis || !chartConfiguration.yAxis ? (
                  <div className="text-center py-4">
                    <p>Please select X and Y axis for the chart</p>
                  </div>
                ) : (
                  <ChartView 
                    data={tableData}
                    config={chartConfiguration}
                  />
                )}
              </div>
            </div>
          )}
          
          {/* Export Modal */}
          <Modal 
            show={showExportModal} 
            onHide={handleCloseExportModal}
            backdrop="static"
            centered
          >
            <Modal.Header closeButton>
              <Modal.Title>Export Database</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>You are about to export the database <strong>{databasePath ? databasePath.split('/').pop() : 'N/A'}</strong></p>
              
              {tables.length > 0 && (
                <div className="mb-3">
                  <p>
                    <strong>{tables.length}</strong> tables will be exported as CSV files:
                  </p>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #dee2e6', padding: '10px', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
                    {tables.map((tableName, index) => (
                      <div key={tableName} className="small">
                        {index + 1}. {tableName}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mb-3 mt-4">
                <Form.Label>Export Location</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={exportPath}
                    placeholder="Select a directory to export to"
                    readOnly
                  />
                  <Button 
                    className="btn-custom-toolbar"
                    onClick={handleSelectExportDirectory}
                  >
                    <FiFolder /> Browse
                  </Button>
                </InputGroup>
                <Form.Text className="text-muted">
                  {exportPath ? 
                    `Files will be exported to a new folder inside ${exportPath}` : 
                    "If no location is selected, the files will be exported to the default location."}
                </Form.Text>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button 
                className="btn-custom-toolbar"
                onClick={handleCloseExportModal}
              >
                Cancel
              </Button>
              <Button 
                className="btn-custom-toolbar"
                onClick={exportPath ? handleExportWithCustomPath : handleExportToDefault}
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Exporting...
                  </>
                ) : exportPath ? (
                  <>Export to Selected Location</>
                ) : (
                  <>Export to Default Location</>
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
    </div>
  );
};

export default ResultsViewer; 