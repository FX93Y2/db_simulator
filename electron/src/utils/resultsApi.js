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
export const exportDatabaseToCSV = async (databasePath, customExportPath = null) => {
  try {
    const result = await window.api.exportDatabaseToCSV(databasePath, customExportPath);
    return result;
  } catch (error) {
    console.error('Error exporting database to CSV:', error);
    return { success: false, error: 'Failed to export database' };
  }
};

// Helper functions for data processing

// Convert raw table data for charting purposes with aggregation
export const prepareDataForChart = (rawData, config) => {
  if (!rawData || !rawData.length) return null;
  
  const { chartType, xAxis, aggregation, numericColumn } = config;
  
  // Aggregate data by x-axis categories
  const aggregatedData = {};
  
  rawData.forEach(item => {
    const xValue = String(item[xAxis] || 'Unknown');
    
    if (!aggregatedData[xValue]) {
      aggregatedData[xValue] = {
        count: 0,
        values: []
      };
    }
    
    aggregatedData[xValue].count++;
    
    // If we need numeric values for aggregation
    if (aggregation !== 'count' && numericColumn) {
      const numValue = parseFloat(item[numericColumn]);
      if (!isNaN(numValue)) {
        aggregatedData[xValue].values.push(numValue);
      }
    }
  });
  
  // Calculate final aggregated values
  const labels = Object.keys(aggregatedData).sort();
  const values = labels.map(label => {
    const data = aggregatedData[label];
    
    switch (aggregation) {
      case 'count':
        return data.count;
      case 'sum':
        return data.values.reduce((sum, val) => sum + val, 0);
      case 'average':
        return data.values.length > 0 ? data.values.reduce((sum, val) => sum + val, 0) / data.values.length : 0;
      case 'min':
        return data.values.length > 0 ? Math.min(...data.values) : 0;
      case 'max':
        return data.values.length > 0 ? Math.max(...data.values) : 0;
      default:
        return data.count;
    }
  });
  
  // Generate colorblind-friendly colors
  const colors = getColorblindFriendlyPalette(labels.length);
  
  // For pie charts
  if (chartType === 'pie') {
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace('0.8', '1')),
        borderWidth: 2
      }]
    };
  }
  
  // For bar and line charts
  const datasetLabel = aggregation === 'count' ? 'Count' : `${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of ${numericColumn}`;
  
  return {
    labels,
    datasets: [{
      label: datasetLabel,
      data: values,
      backgroundColor: chartType === 'line' ? colors[0] : colors,
      borderColor: chartType === 'line' ? colors[0] : colors.map(color => color.replace('0.8', '1')),
      borderWidth: 2,
      fill: false
    }]
  };
};

// Generate colorblind-friendly color palette
export const getColorblindFriendlyPalette = (count) => {
  const colors = [
    'rgba(31, 119, 180, 0.8)',   // Blue
    'rgba(255, 127, 14, 0.8)',   // Orange
    'rgba(44, 160, 44, 0.8)',    // Green
    'rgba(214, 39, 40, 0.8)',    // Red
    'rgba(148, 103, 189, 0.8)',  // Purple
    'rgba(140, 86, 75, 0.8)',    // Brown
    'rgba(227, 119, 194, 0.8)',  // Pink
    'rgba(127, 127, 127, 0.8)',  // Gray
    'rgba(188, 189, 34, 0.8)',   // Olive
    'rgba(23, 190, 207, 0.8)'    // Cyan
  ];
  
  // If we need more colors than available, cycle through the palette
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  
  return result;
};

// Legacy function for backward compatibility
export const getRandomColor = (opacity = 1) => {
  return getColorblindFriendlyPalette(1)[0];
};

// Get chart options based on chart type with dark theme support
export const getChartOptions = (chartType) => {
  // Detect if we're in dark theme
  const isDarkTheme = document.body.classList.contains('theme-dark');
  const textColor = isDarkTheme ? '#e0e0e0' : '#333333';
  const gridColor = isDarkTheme ? '#444444' : '#e0e0e0';
  
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: textColor,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: isDarkTheme ? '#383838' : '#ffffff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: gridColor,
        borderWidth: 1
      }
    }
  };
  
  const scaleOptions = {
    ticks: {
      color: textColor,
      font: {
        size: 11
      }
    },
    grid: {
      color: gridColor
    },
    title: {
      color: textColor,
      font: {
        size: 12,
        weight: 'bold'
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
          x: {
            ...scaleOptions,
            title: {
              ...scaleOptions.title,
              display: true,
              text: 'Categories'
            }
          },
          y: {
            ...scaleOptions,
            beginAtZero: true,
            title: {
              ...scaleOptions.title,
              display: true,
              text: 'Values'
            }
          }
        }
      };
      
    case 'line':
    default:
      return {
        ...commonOptions,
        scales: {
          x: {
            ...scaleOptions,
            title: {
              ...scaleOptions.title,
              display: true,
              text: 'Categories'
            }
          },
          y: {
            ...scaleOptions,
            beginAtZero: true,
            title: {
              ...scaleOptions.title,
              display: true,
              text: 'Values'
            }
          }
        }
      };
  }
};