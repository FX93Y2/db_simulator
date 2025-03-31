import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { prepareDataForChart, getChartOptions } from '../../utils/resultsApi';

// Register all Chart.js components
Chart.register(...registerables);

const ChartView = ({ data, config }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Effect to create or update chart when data or config changes
  useEffect(() => {
    // Destroy previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    // Process data and create chart only if needed values are provided
    if (data && data.length > 0 && config.xAxis && config.yAxis) {
      // Prepare the data for the chart
      const chartData = prepareDataForChart(data, config);
      
      // Get options based on chart type
      const options = getChartOptions(config.chartType);
      
      if (chartData && chartRef.current) {
        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
          type: config.chartType,
          data: chartData,
          options: options
        });
      }
    }
    
    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, config]);
  
  return (
    <div className="chart-wrapper" style={{ width: '100%', height: '100%' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default ChartView; 