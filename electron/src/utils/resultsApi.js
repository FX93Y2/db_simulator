/**
 * Utilities for working with simulation results
 */

// Function to get a summary of simulation results
export const getSimulationSummary = async (databasePath) => {
  try {
    const result = await window.api.getSimulationResults(databasePath);
    return result;
  } catch (error) {
    console.error('Error getting simulation summary:', error);
    return { success: false, error: 'Failed to get simulation summary' };
  }
};

// Function to get available tables from a database
export const getDatabaseTables = async (databasePath) => {
  try {
    const result = await window.api.getDatabaseTables(databasePath);
    return result;
  } catch (error) {
    console.error('Error getting database tables:', error);
    return { success: false, error: 'Failed to get database tables' };
  }
};

// Function to get data from a specific table
export const getTableData = async (databasePath, tableName, limit = 1000) => {
  try {
    const result = await window.api.getTableData({
      databasePath,
      tableName,
      limit
    });
    return result;
  } catch (error) {
    console.error('Error getting table data:', error);
    return { success: false, error: 'Failed to get table data' };
  }
};

// Function to export database to CSV
export const exportDatabaseToCSV = async (databasePath) => {
  try {
    const result = await window.api.exportDatabaseToCSV(databasePath);
    return result;
  } catch (error) {
    console.error('Error exporting database to CSV:', error);
    return { success: false, error: 'Failed to export database' };
  }
};

// Helper functions for data processing

// Convert raw table data for charting purposes
export const prepareDataForChart = (rawData, config) => {
  if (!rawData || !rawData.length) return null;
  
  const { chartType, xAxis, yAxis, groupBy } = config;
  
  // For pie charts
  if (chartType === 'pie') {
    const aggregatedData = {};
    
    // If grouping is enabled
    if (groupBy && groupBy !== xAxis) {
      rawData.forEach(item => {
        const groupValue = String(item[groupBy] || 'Unknown');
        const numValue = parseFloat(item[yAxis]);
        
        if (!isNaN(numValue)) {
          if (!aggregatedData[groupValue]) {
            aggregatedData[groupValue] = 0;
          }
          aggregatedData[groupValue] += numValue;
        }
      });
    } else {
      // No grouping, aggregate by x-axis
      rawData.forEach(item => {
        const xValue = String(item[xAxis] || 'Unknown');
        const numValue = parseFloat(item[yAxis]);
        
        if (!isNaN(numValue)) {
          if (!aggregatedData[xValue]) {
            aggregatedData[xValue] = 0;
          }
          aggregatedData[xValue] += numValue;
        }
      });
    }
    
    const labels = Object.keys(aggregatedData);
    const values = labels.map(label => aggregatedData[label]);
    
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map(() => getRandomColor())
      }]
    };
  }
  
  // For line, bar, scatter charts
  if (groupBy && groupBy !== xAxis) {
    // Group data by the groupBy field
    const groupedData = {};
    const xValues = new Set();
    
    rawData.forEach(item => {
      const groupValue = String(item[groupBy] || 'Unknown');
      const xValue = String(item[xAxis]);
      const yValue = parseFloat(item[yAxis]);
      
      xValues.add(xValue);
      
      if (!groupedData[groupValue]) {
        groupedData[groupValue] = {};
      }
      
      groupedData[groupValue][xValue] = yValue;
    });
    
    const sortedXValues = [...xValues].sort();
    
    return {
      labels: sortedXValues,
      datasets: Object.keys(groupedData).map(group => {
        const color = getRandomColor();
        return {
          label: group,
          data: sortedXValues.map(x => groupedData[group][x] || 0),
          backgroundColor: chartType === 'line' ? color : `${color}88`,
          borderColor: color,
          borderWidth: 1,
          fill: false
        };
      })
    };
  } else {
    // No grouping
    return {
      labels: rawData.map(item => String(item[xAxis])),
      datasets: [{
        label: yAxis,
        data: rawData.map(item => {
          const value = parseFloat(item[yAxis]);
          return isNaN(value) ? 0 : value;
        }),
        backgroundColor: getRandomColor(0.6),
        borderColor: getRandomColor(),
        borderWidth: 1,
        fill: false
      }]
    };
  }
};

// Generate a random color for charts
export const getRandomColor = (opacity = 1) => {
  const r = Math.floor(Math.random() * 200);
  const g = Math.floor(Math.random() * 200);
  const b = Math.floor(Math.random() * 200);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Get chart options based on chart type
export const getChartOptions = (chartType) => {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
      },
      tooltip: {
        enabled: true
      }
    }
  };
  
  switch (chartType) {
    case 'pie':
      return {
        ...commonOptions,
        layout: {
          padding: 20
        }
      };
    
    case 'bar':
      return {
        ...commonOptions,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      };
      
    case 'scatter':
      return {
        ...commonOptions,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom'
          },
          y: {
            beginAtZero: true
          }
        }
      };
      
    case 'line':
    default:
      return {
        ...commonOptions,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      };
  }
}; 