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
  FiList,
  FiBarChart2,
  FiDownload,
  FiFolder,
  FiChevronUp,
  FiChevronDown
} from 'react-icons/fi';
import ChartView from '../shared/ChartView';
import {
  getSimulationSummary,
  getDatabaseTables,
  getTableData,
  exportDatabaseToCSV
} from '../../utils/resultsApi';
import { useToastContext } from '../../contexts/ToastContext';

const ResultsViewer = ({ projectId, isProjectTab }) => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToastContext();
  
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [selectedView, setSelectedView] = useState('table'); // 'table' or 'chart'
  const [chartConfiguration, setChartConfiguration] = useState({
    chartType: 'bar',
    xAxis: '',
    aggregation: 'count',
    numericColumn: ''
  });
  const [databasePath, setDatabasePath] = useState('');
  
  // Export-related state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  
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
        
        // Add a small delay to ensure backend has released database connections
        // This prevents EBUSY errors on Windows when accessing database immediately after simulation
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get basic info about the simulation results
        const resultInfo = await getSimulationSummary(databasePath);
        if (resultInfo.success) {
          setResults(resultInfo.data);
          console.log("Loaded simulation results:", resultInfo.data);
        } else {
          console.error("Failed to load simulation results:", resultInfo.error);
          showError(`Error loading simulation results: ${resultInfo.error}`);
        }
        
        // Add another small delay before accessing tables
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
            showError(`Error loading database tables: ${tablesResult.error}`);
          }
        }
      } catch (error) {
        console.error('Error loading database info:', error);
        showError(`Error loading database info: ${error.message}`);
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
        
        // Add a small delay to ensure any previous database connections are closed
        // This prevents EBUSY errors on Windows when accessing database
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get data for the selected table
        const dataResult = await getTableData(databasePath, selectedTable);
        
        if (dataResult.success) {
          setTableData(dataResult.data || []);
          console.log("Loaded table data:", dataResult.data ? dataResult.data.length : 0, "rows");
          
          // Extract column names from the first row
          if (dataResult.data && dataResult.data.length > 0) {
            setTableColumns(Object.keys(dataResult.data[0]));
            
            // Set default chart configuration
            if (Object.keys(dataResult.data[0]).length >= 1) {
              setChartConfiguration({
                ...chartConfiguration,
                xAxis: Object.keys(dataResult.data[0])[0]
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
        showError(`Error selecting directory: ${result.error}`);
      }
    } catch (error) {
      console.error('Error showing directory picker:', error);
      showError(`Error selecting directory: ${error.message}`);
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
        showSuccess(
          `Export completed successfully!\n\n` +
          `Location: ${result.path}\n` +
          `Tables exported: ${result.tables}\n` +
          `Total rows: ${result.totalRows}\n\n` +
          `The data has been saved to a folder named after the database.`
        );
      } else {
        showError(`Error exporting database: ${result.error}`);
      }
    } catch (error) {
      console.error('Error exporting database:', error);
      showError(`Error exporting database: ${error.message}`);
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
        showSuccess(
          `Export completed successfully!\n\n` +
          `Location: ${result.path}\n` +
          `Tables exported: ${result.tables}\n` +
          `Total rows: ${result.totalRows}\n\n` +
          `The data has been saved to a folder named after the database.`
        );
      } else {
        showError(`Error exporting database: ${result.error}`);
      }
    } catch (error) {
      console.error('Error exporting database:', error);
      showError(`Error exporting database: ${error.message}`);
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
  
  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  // Sort table data
  const sortedTableData = React.useMemo(() => {
    if (!sortColumn || !tableData.length) return tableData;
    
    return [...tableData].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Convert to strings for comparison
      aVal = String(aVal);
      bVal = String(bVal);
      
      // Check if values are numeric
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      const aIsNum = !isNaN(aNum) && isFinite(aNum);
      const bIsNum = !isNaN(bNum) && isFinite(bNum);
      
      let comparison = 0;
      if (aIsNum && bIsNum) {
        // Numeric comparison
        comparison = aNum - bNum;
      } else {
        // String comparison (case insensitive)
        comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [tableData, sortColumn, sortDirection]);
  
  
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
      <div className="results-viewer-content">
        {loading && !results ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <div className="mt-2">Loading results...</div>
          </div>
        ) : (
        <>
          {results && (
            <Card className="mb-3 simulation-summary-compact">
              <Card.Body className="py-2">
                <div className="d-flex align-items-center justify-content-between flex-wrap">
                  <div className="d-flex align-items-center gap-4 flex-wrap">
                    <div className="summary-item">
                      <small className="text-muted">Simulation ID:</small>
                      <div className="fw-medium">{results.simulationId || 'N/A'}</div>
                    </div>
                    <div className="summary-item">
                      <small className="text-muted">Run Date:</small>
                      <div className="fw-medium">{results.runDate || 'N/A'}</div>
                    </div>
                    <div className="summary-item">
                      <small className="text-muted">Database:</small>
                      <div className="fw-medium">{databasePath ? databasePath.split('/').pop() : 'N/A'}</div>
                    </div>
                  </div>
                  {!isProjectTab && (
                    <Button
                      size="sm"
                      className="btn-custom-toolbar"
                      onClick={handleShowExportModal}
                      disabled={loading}
                      title="Export Data"
                    >
                      <FiDownload className="me-1" />
                      Export
                    </Button>
                  )}
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
            <div className="table-container-wrapper">
              <div className="table-container">
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
                <Table striped bordered hover className="results-table data-table">
                  <thead>
                    <tr>
                      {tableColumns.map(column => (
                        <th 
                          key={column}
                          style={{ 
                            cursor: 'pointer', 
                            userSelect: 'none',
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'var(--theme-card-bg)',
                            zIndex: 10
                          }}
                          onClick={() => handleSort(column)}
                          title={`Click to sort by ${column}`}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <span>{column}</span>
                            <div className="sort-icons" style={{ marginLeft: '8px', display: 'flex', flexDirection: 'column' }}>
                              <FiChevronUp 
                                size={12} 
                                style={{ 
                                  opacity: sortColumn === column && sortDirection === 'asc' ? 1 : 0.3,
                                  marginBottom: '-2px'
                                }} 
                              />
                              <FiChevronDown 
                                size={12} 
                                style={{ 
                                  opacity: sortColumn === column && sortDirection === 'desc' ? 1 : 0.3,
                                  marginTop: '-2px'
                                }} 
                              />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableData.map((row, index) => (
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
                      <option value="bar">Bar Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="line">Line Chart</option>
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
                    <Form.Label>Aggregation</Form.Label>
                    <Form.Select
                      value={chartConfiguration.aggregation}
                      onChange={(e) => handleChartConfigChange('aggregation', e.target.value)}
                    >
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="average">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                {chartConfiguration.aggregation !== 'count' && (
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Numeric Column</Form.Label>
                      <Form.Select
                        value={chartConfiguration.numericColumn}
                        onChange={(e) => handleChartConfigChange('numericColumn', e.target.value)}
                      >
                        <option value="">Select Numeric Column</option>
                        {tableColumns.filter(column => {
                          // Filter to only show numeric columns
                          if (tableData.length === 0) return true;
                          const sampleValue = tableData[0][column];
                          return !isNaN(parseFloat(sampleValue)) && isFinite(sampleValue);
                        }).map(column => (
                          <option key={column} value={column}>{column}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                )}
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
                ) : !chartConfiguration.xAxis || (chartConfiguration.aggregation !== 'count' && !chartConfiguration.numericColumn) ? (
                  <div className="text-center py-4">
                    <p>Please select X Axis{chartConfiguration.aggregation !== 'count' ? ' and Numeric Column' : ''} for the chart</p>
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
                  <div className="table-list-container" style={{ maxHeight: '100px', overflowY: 'auto', padding: '10px', borderRadius: '4px' }}>
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
    </div>
  );
};

export default ResultsViewer; 