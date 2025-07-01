import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { prepareDataForChart, getChartOptions } from '../../utils/resultsApi';

// Register all Chart.js components
Chart.register(...registerables);

const ChartView = ({ data, config }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [themeObserver, setThemeObserver] = useState(null);

  // Effect to create or update chart when data, config, or theme changes
  useEffect(() => {
    // Destroy previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    // Process data and create chart only if needed values are provided
    const hasRequiredConfig = data && data.length > 0 && config.xAxis &&
      (config.aggregation === 'count' || config.numericColumn);
    
    if (hasRequiredConfig) {
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

  // Effect to watch for theme changes and re-render chart
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Theme changed, re-render chart
          if (chartInstance.current) {
            const options = getChartOptions(config.chartType);
            chartInstance.current.options = options;
            chartInstance.current.update();
          }
        }
      });
    });

    // Start observing theme changes on body element
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    setThemeObserver(observer);

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [config.chartType]);
  
  return (
    <div className="chart-wrapper" style={{ width: '100%', height: '100%' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default ChartView;