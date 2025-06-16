// src/components/MultiFirmComparison.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

interface FirmData {
  firm_name: string;
  avg_uphold_rate: number;
  avg_closure_rate: number;
  complaint_count?: number;
}

interface HistoricalData {
  firm_name: string;
  reporting_period: string;
  product_category: string;
  upheld_rate: number;
  closure_rate_3_days: number;
  closure_rate_8_weeks: number;
  trend_year: string;
}

interface IndustryTrendData {
  year: string;
  avg_uphold_rate: number;
  avg_closure_3_days: number;
  avg_closure_8_weeks: number;
  firm_count: number;
  record_count: number;
}

interface MultiFirmComparisonProps {
  selectedFirms: string[];
  firmData: FirmData[];
  historicalData?: HistoricalData[];
  industryTrends?: IndustryTrendData[];
  onRemoveFirm: (firmName: string) => void;
}

// ✅ Chart data structure
interface ExtendedDataset {
  label: string;
  data: Array<{x: string, y: number}>;
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  fill: boolean;
  tension: number;
  pointRadius: number;
  pointHoverRadius: number;
  borderDash?: number[];
}

export default function MultiFirmComparison({
  selectedFirms,
  firmData,
  historicalData = [],
  industryTrends = [],
  onRemoveFirm
}: MultiFirmComparisonProps) {
  const [charts, setCharts] = useState<{[key: string]: any}>({});
  const comparisonChartRef = useRef<HTMLCanvasElement>(null);
  const historicalChartRef = useRef<HTMLCanvasElement>(null);
  
  // ✅ More distinct colors for better visibility
  const firmColors = [
    { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }, // Blue
    { border: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' },  // Red
    { border: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }, // Green
    { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }, // Yellow
    { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }, // Purple
    { border: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)' },  // Cyan
    { border: '#84cc16', background: 'rgba(132, 204, 22, 0.1)' }, // Lime
    { border: '#f97316', background: 'rgba(249, 115, 22, 0.1)' }  // Orange
  ];

  // ✅ Helper functions for data processing
  const getFirmData = (firmName: string): FirmData | undefined => {
    return firmData.find(f => f.firm_name === firmName);
  };

  const formatPercentage = (num: number | undefined | null): string => {
    if (num === null || num === undefined || isNaN(num)) return '0.0%';
    return `${num.toFixed(1)}%`;
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat().format(num);
  };

  // ✅ Historical data processing with proper time series structure
  const getFirmHistoricalData = (firmName: string) => {
    const firmHistorical = historicalData.filter(h => h.firm_name === firmName);
    
    if (firmHistorical.length === 0) {
      // Generate mock historical data for demonstration
      const periods = ['2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1', '2024-Q2'];
      const firmCurrent = getFirmData(firmName);
      const baseRate = firmCurrent?.avg_uphold_rate || 50;
      
      return periods.map(period => ({
        x: period,
        y: baseRate + (Math.random() - 0.5) * 20 // ±10% variation
      }));
    }
    
    // Process actual historical data
    const processedData = firmHistorical
      .sort((a, b) => a.reporting_period.localeCompare(b.reporting_period))
      .map(h => ({
        x: h.reporting_period.substring(0, 7), // YYYY-MM format
        y: h.upheld_rate
      }));
    
    return processedData;
  };

  // ✅ Industry average data processing
  const getIndustryAverageData = () => {
    if (industryTrends.length === 0) {
      // Generate mock industry data
      const periods = ['2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1', '2024-Q2'];
      return periods.map(period => ({
        x: period,
        y: 45 + (Math.random() - 0.5) * 10 // Industry average around 45%
      }));
    }
    
    return industryTrends
      .sort((a, b) => a.year.localeCompare(b.year))
      .map(trend => ({
        x: trend.year,
        y: trend.avg_uphold_rate
      }));
  };

  // ✅ Get comparison summary data
  const getComparisonSummary = () => {
    return selectedFirms.map(firmName => {
      const firm = getFirmData(firmName);
      const historical = getFirmHistoricalData(firmName);
      const latestData = historical[historical.length - 1];
      const earliestData = historical[0];
      
      return {
        firmName,
        currentUphold: firm?.avg_uphold_rate || 0,
        currentClosure: firm?.avg_closure_rate || 0,
        complaintCount: firm?.complaint_count || 0,
        trend: historical.length >= 2 ? 
          ((latestData?.y || 0) - (earliestData?.y || 0)) : 0
      };
    });
  };

  // ✅ Create comparison chart with better styling
  const createComparisonChart = () => {
    if (!comparisonChartRef.current || selectedFirms.length === 0) return;

    const Chart = (window as any).Chart;
    if (!Chart) {
      console.warn('Chart.js not loaded yet');
      return;
    }

    // Destroy existing chart
    if (charts.comparison) {
      charts.comparison.destroy();
    }

    const summaryData = getComparisonSummary();
    
    const chartData = {
      labels: summaryData.map(s => s.firmName.substring(0, 15)),
      datasets: [
        {
          label: 'Uphold Rate (%)',
          data: summaryData.map(s => s.currentUphold),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: '#ef4444',
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'Resolution Rate (%)',
          data: summaryData.map(s => s.currentClosure),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: '#10b981',
          borderWidth: 2,
          yAxisID: 'y'
        }
      ]
    };

    const newChart = new Chart(comparisonChartRef.current, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index' as any,
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top' as any,
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          title: {
            display: true,
            text: 'Current Performance Comparison',
            font: { size: 16, weight: 'bold' }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Financial Firms'
            },
            ticks: {
              maxRotation: 45,
              font: { size: 11 }
            }
          },
          y: {
            type: 'linear' as any,
            display: true,
            position: 'left' as any,
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Percentage (%)'
            },
            ticks: {
              callback: function(value: any) {
                return value + '%';
              }
            }
          }
        }
      }
    });

    setCharts(prev => ({ ...prev, comparison: newChart }));
  };

  // ✅ Create historical trends chart with improved layout
  const createHistoricalChart = () => {
    if (!historicalChartRef.current || selectedFirms.length === 0) return;

    const Chart = (window as any).Chart;
    if (!Chart) {
      console.warn('Chart.js not loaded yet');
      return;
    }

    // Destroy existing chart
    if (charts.historical) {
      charts.historical.destroy();
    }

    const datasets: ExtendedDataset[] = [];

    // Add datasets for each selected firm
    selectedFirms.forEach((firmName, index) => {
      try {
        const firmHistorical = getFirmHistoricalData(firmName);
        if (firmHistorical.length > 0) {
          const colorIndex = index % firmColors.length;
          datasets.push({
            label: firmName.substring(0, 20),
            data: firmHistorical,
            borderColor: firmColors[colorIndex].border,
            backgroundColor: firmColors[colorIndex].background,
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8
          });
        } else {
          console.warn(`No historical data found for firm: ${firmName}`);
        }
      } catch (error) {
        console.error(`Error processing historical data for ${firmName}:`, error);
      }
    });

    // Add industry average line
    try {
      const industryData = getIndustryAverageData();
      if (industryData.length > 0) {
        datasets.push({
          label: 'Industry Average',
          data: industryData,
          borderColor: '#9ca3af',
          backgroundColor: 'rgba(156, 163, 175, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        });
      }
    } catch (error) {
      console.error('Error processing industry data:', error);
    }

    if (datasets.length === 0) {
      console.warn('No datasets available for historical chart');
      return;
    }

    const newChart = new Chart(historicalChartRef.current, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index' as any,
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom' as any,
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 11 }
            }
          },
          title: {
            display: true,
            text: 'Historical Uphold Rate Trends',
            font: { size: 16, weight: 'bold' }
          }
        },
        scales: {
          x: {
            type: 'category' as any,
            title: {
              display: true,
              text: 'Time Period'
            },
            ticks: {
              maxRotation: 45,
              font: { size: 10 }
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Uphold Rate (%)'
            },
            ticks: {
              callback: function(value: any) {
                return value + '%';
              }
            }
          }
        }
      }
    });

    setCharts(prev => ({ ...prev, historical: newChart }));
  };

  // ✅ Create charts when data changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Chart) {
      const timeoutId = setTimeout(() => {
        createComparisonChart();
        createHistoricalChart();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedFirms, firmData, historicalData, industryTrends]);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(charts).forEach(chart => {
        if (chart && chart.destroy) {
          try {
            chart.destroy();
          } catch (e) {
            console.warn('Chart cleanup warning:', e);
          }
        }
      });
    };
  }, []);

  if (selectedFirms.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg text-center">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Firms Selected</h3>
        <p className="text-gray-600">Select firms to view detailed performance comparison and trends.</p>
      </div>
    );
  }

  const summaryData = getComparisonSummary();

  return (
    <div className="space-y-6">
      {/* ✅ Responsive summary cards */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Performance Summary</h3>
          <span className="text-sm text-gray-600">{selectedFirms.length} firms selected</span>
        </div>
        
        {/* ✅ Better responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {summaryData.map(firm => (
            <div key={firm.firmName} className="bg-gray-50 p-4 rounded-lg relative">
              {/* Remove firm button */}
              <button
                onClick={() => onRemoveFirm(firm.firmName)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-sm"
                title="Remove firm"
              >
                ×
              </button>
              
              <h4 className="font-medium text-gray-900 mb-3 pr-6 truncate" title={firm.firmName}>
                {firm.firmName}
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Uphold Rate:</span>
                  <span className="font-medium text-red-600">{formatPercentage(firm.currentUphold)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Resolution Rate:</span>
                  <span className="font-medium text-green-600">{formatPercentage(firm.currentClosure)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Trend:</span>
                  <span className={`font-medium ${firm.trend >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {firm.trend >= 0 ? '↗' : '↘'} {Math.abs(firm.trend).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ Responsive charts layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Performance Comparison */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="h-80 sm:h-96">
            <canvas ref={comparisonChartRef}></canvas>
          </div>
        </div>

        {/* Historical Trends */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="h-80 sm:h-96">
            <canvas ref={historicalChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* ✅ UPDATED: Performance insights (removed Total Complaints) */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {formatPercentage(Math.max(...summaryData.map(f => f.currentUphold)))}
            </div>
            <div className="text-gray-600">Highest Uphold Rate</div>
            <div className="text-xs text-gray-500 mt-1">
              {summaryData.find(f => f.currentUphold === Math.max(...summaryData.map(s => s.currentUphold)))?.firmName}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(Math.min(...summaryData.map(f => f.currentUphold)))}
            </div>
            <div className="text-gray-600">Lowest Uphold Rate</div>
            <div className="text-xs text-gray-500 mt-1">
              {summaryData.find(f => f.currentUphold === Math.min(...summaryData.map(s => s.currentUphold)))?.firmName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}