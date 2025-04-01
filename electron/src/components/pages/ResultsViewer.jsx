import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Spinner, 
  Form, 
  Tabs, 
  Tab, 
  Table
} from 'react-bootstrap';
import { 
  FiArrowLeft, 
  FiDatabase, 
  FiList, 
  FiBarChart2, 
  FiDownload
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
  
  // Construct database path from resultId and projectId
  useEffect(() => {
    if (resultId) {
      let dbPath;
      
      if (projectId) {
        // Construct a project-specific path
        dbPath = `output/${projectId}/${resultId}.db`;
        console.log("Setting project-specific database path:", dbPath);
      } else {
        // For standalone results (not in a project context)
        dbPath = `output/${resultId}.db`;
        console.log("Setting standalone database path:", dbPath);
      }
      
      // Check if this is an absolute path or just a filename
      if (resultId.includes('/') || resultId.includes('\\')) {
        // This might be a full path already
        dbPath = resultId;
        console.log("Using full path as database path:", dbPath);
      }
      
      setDatabasePath(dbPath);
    }
  }, [resultId, projectId]);
  
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
          setSelectedTable(tablesResult.tables[0]);
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
  }, [databasePath]);
  
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
  
  // Handle table selection
  const handleTableChange = (e) => {
    setSelectedTable(e.target.value);
  };
  
  // Handle chart configuration changes
  const handleChartConfigChange = (field, value) => {
    setChartConfiguration({
      ...chartConfiguration,
      [field]: value
    });
  };
  
  // Handle exporting data
  const handleExportData = async () => {
    try {
      setLoading(true);
      const result = await exportDatabaseToCSV(databasePath);
      setLoading(false);
      
      if (result.success) {
        alert(`Data exported successfully to ${result.exportPath}`);
      } else {
        alert('Failed to export data: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      setLoading(false);
      console.error('Error exporting data:', error);
      alert('Error exporting data');
    }
  };
  
  // Navigate back based on context
  const handleBack = () => {
    if (projectId && isProjectTab) {
      // In project tab context, stay in the current page
      // The tab navigation will be handled by the parent component
      return;
    } else if (projectId) {
      // Navigate back to project page
      navigate(`/project/${projectId}`);
    } else {
      // Navigate back to dashboard
      navigate('/');
    }
  };
  
  return (
    <div className="results-viewer">
      {!isProjectTab && (
        <div className="mb-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <Button 
              variant="outline-secondary" 
              className="me-3"
              onClick={handleBack}
            >
              <FiArrowLeft /> Back
            </Button>
            <h2 className="mb-0">Simulation Results</h2>
          </div>
          <Button 
            variant="success" 
            onClick={handleExportData}
            disabled={loading}
          >
            <FiDownload /> Export Data
          </Button>
        </div>
      )}
      
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
          
          <Form.Group className="mb-3">
            <Form.Label><strong>Select Table</strong></Form.Label>
            <Form.Select 
              value={selectedTable} 
              onChange={handleTableChange}
              disabled={loading || tables.length === 0}
            >
              {tables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </Form.Select>
          </Form.Group>
          
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
        </>
      )}
    </div>
  );
};

export default ResultsViewer; 