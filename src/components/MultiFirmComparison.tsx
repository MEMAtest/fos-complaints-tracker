import React, { useEffect, useRef, useState } from 'react';
import type { HistoricalTrendData, IndustryTrendData } from '../types/dashboard';

interface FirmData {
  firm_name: string;
  avg_uphold_rate: number;
  avg_closure_rate: number;
  complaint_count?: number;
}

interface MultiFirmComparisonProps {
  selectedFirms: string[];
  firmData: FirmData[];
  historicalData: HistoricalTrendData[];
  industryTrends: IndustryTrendData[];
  onRemoveFirm: (firmName: string) => void;
}

// ✅ FIXED: Extend Chart.js dataset type to include borderDash
interface ExtendedDataset {
  label: string;
  data: { x: string; y: number; }[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  borderDash?: number[]; // ✅ Make borderDash optional
  fill: boolean;
  tension: number;
  pointRadius: number;
  pointHoverRadius: number;
}

export default function MultiFirmComparison({
  selectedFirms,
  firmData,
  historicalData,
  industryTrends,
  onRemoveFirm
}: MultiFirmComparisonProps) {
  const historicalChartRef = useRef<HTMLCanvasElement>(null);
  const comparisonChartRef = useRef<HTMLCanvasElement>(null);
  const [charts, setCharts] = useState<{ [key: string]: any }>({});

  // Color palette for different firms
  const firmColors = [
    { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }, // Blue
    { border: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' },  // Red
    { border: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }, // Green
    { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }, // Amber
    { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }  // Purple
  ];

  // ✅ COMPREHENSIVE: Helper functions to safely get property values from any interface variation
  const getReportingPeriod = (item: any): string => {
    return item.reporting_period || 
           item.period || 
           item.reporting_period_id?.toString() || 
           item.date || 
           item.period_name || 
           'Unknown';
  };

  const getUpheldRate = (item: any): number => {
    return item.upheld_rate || 
           item.uphold_rate_pct || 
           item.avg_upheld_rate || 
           item.avg_uphold_rate || 
           item.uphold_rate || 
           item.complaint_upheld_rate || 
           0;
  };

  const getClosureRate = (item: any): number => {
    return item.avg_closure_rate || 
           item.closure_rate || 
           item.avg_closure_within_3_days || 
           item.closure_3_days_rate || 
           item.closure_rate_pct || 
           item.resolution_rate || 
           0;
  };

  const getFirmName = (item: any): string => {
    return item.firm_name || 
           item.name || 
           item.company_name || 
           item.organization || 
           'Unknown Firm';
  };

  const getComplaintCount = (item: any): number => {
    return item.complaint_count || 
           item.total_complaints || 
           item.complaints_received || 
           item.volume || 
           item.count || 
           0;
  };

  // Helper function to get firm historical data
  const getFirmHistoricalData = (firmName: string) => {
    return historicalData
      .filter(item => getFirmName(item) === firmName)
      .sort((a, b) => (getReportingPeriod(a) || '').localeCompare(getReportingPeriod(b) || ''))
      .map(item => ({
        x: getReportingPeriod(item),
        y: getUpheldRate(item)
      }));
  };

  // Helper function to get industry average data
  const getIndustryAverageData = () => {
    return industryTrends
      .sort((a, b) => (getReportingPeriod(a) || '').localeCompare(getReportingPeriod(b) || ''))
      .map(item => ({
        x: getReportingPeriod(item),
        y: getUpheldRate(item)
      }));
  };

  // Calculate industry benchmarks
  const calculateIndustryBenchmarks = () => {
    if (industryTrends.length === 0) return { avgUphold: 0, avgClosure: 0 };
    
    const avgUphold = industryTrends.reduce((sum, item) => sum + getUpheldRate(item), 0) / industryTrends.length;
    const avgClosure = industryTrends.reduce((sum, item) => sum + getClosureRate(item), 0) / industryTrends.length;
    
    return { avgUphold, avgClosure };
  };

  // Get current firm data for comparison table
  const getCurrentFirmData = () => {
    return selectedFirms.map(firmName => {
      const firm = firmData.find(f => getFirmName(f) === firmName);
      const historical = getFirmHistoricalData(firmName);
      const latestData = historical[historical.length - 1];
      
      return {
        name: firmName,
        currentUphold: firm ? getUpheldRate(firm) : 0,
        currentClosure: firm ? getClosureRate(firm) : 0,
        complaintCount: firm ? getComplaintCount(firm) : 0,
        trend: historical.length >= 2 ? 
          ((latestData?.y || 0) - (historical[0]?.y || 0)) : 0
      };
    });
  };

  // Create historical trends chart
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
            pointRadius: 4,
            pointHoverRadius: 6
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
          borderDash: [5, 5] as any,
          fill: false,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        });
      } else {
        console.warn('No industry trend data available');
      }
    } catch (error) {
      console.error('Error processing industry trend data:', error);
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
          mode: 'index',
          intersect: false
        },
        plugins: {
          title: {
            display: true,
            text: 'Historical Uphold Rate Trends'
          },
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              title: function(context: any) {
                return `Period: ${context[0].label}`;
              },
              label: function(context: any) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Reporting Period'
            },
            ticks: {
              maxRotation: 45
            }
          },
          y: {
            title: {
              display: true,
              text: 'Uphold Rate (%)'
            },
            beginAtZero: true,
            max: 100,
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

  // Create current performance comparison chart
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

    try {
      const currentData = getCurrentFirmData();
      const benchmarks = calculateIndustryBenchmarks();

      if (currentData.length === 0) {
        console.warn('No current firm data available for comparison chart');
        return;
      }

      const newChart = new Chart(comparisonChartRef.current, {
        type: 'bar',
        data: {
          labels: currentData.map(f => f.name.substring(0, 15)),
          datasets: [
            {
              label: 'Uphold Rate (%)',
              data: currentData.map(f => f.currentUphold),
              backgroundColor: 'rgba(239, 68, 68, 0.7)',
              borderColor: '#ef4444',
              borderWidth: 1
            },
            {
              label: 'Industry Avg Uphold',
              data: new Array(currentData.length).fill(benchmarks.avgUphold),
              backgroundColor: 'rgba(156, 163, 175, 0.5)',
              borderColor: '#9ca3af',
              borderWidth: 1,
              type: 'line',
              borderDash: [5, 5] as any,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Current Performance vs Industry Benchmark'
            },
            legend: {
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                maxRotation: 45
              }
            },
            y: {
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
    } catch (error) {
      console.error('Error creating comparison chart:', error);
    }
  };

  // Create charts when data changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Chart && selectedFirms.length > 0) {
      // ✅ DEBUG: Log data availability for troubleshooting
      console.log('MultiFirmComparison - Creating charts:', {
        selectedFirms: selectedFirms.length,
        firmData: firmData.length,
        historicalData: historicalData.length,
        industryTrends: industryTrends.length,
        sampleHistoricalItem: historicalData[0] || 'None',
        sampleIndustryItem: industryTrends[0] || 'None'
      });

      setTimeout(() => {
        try {
          createHistoricalChart();
          createComparisonChart();
        } catch (error) {
          console.error('Error creating multi-firm comparison charts:', error);
        }
      }, 100);
    }

    // Cleanup function
    return () => {
      Object.values(charts).forEach((chart: any) => {
        if (chart && typeof chart.destroy === 'function') {
          try {
            chart.destroy();
          } catch (error) {
            console.warn('Error destroying chart:', error);
          }
        }
      });
    };
  }, [selectedFirms, firmData, historicalData, industryTrends]);

  // Helper functions for formatting
  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const getTrendIcon = (trend: number): string => {
    if (trend > 1) return '📈'; // Increasing (bad for uphold rate)
    if (trend < -1) return '📉'; // Decreasing (good for uphold rate)
    return '➡️'; // Stable
  };

  const getTrendColor = (trend: number): string => {
    if (trend > 1) return 'text-red-600'; // Increasing uphold rate is bad
    if (trend < -1) return 'text-green-600'; // Decreasing uphold rate is good
    return 'text-gray-600'; // Stable
  };

  if (selectedFirms.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-Firm Comparison</h3>
        <p className="text-gray-600">Select 2 or more firms to see detailed comparisons with historical trends.</p>
      </div>
    );
  }

  const currentData = getCurrentFirmData();
  const benchmarks = calculateIndustryBenchmarks();

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Firms Selected</h4>
          <div className="text-2xl font-bold text-blue-600">{selectedFirms.length}</div>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Best Performer</h4>
          <div className="text-lg font-bold text-green-600">
            {currentData.length > 0 ? 
              currentData.reduce((best, firm) => 
                firm.currentUphold < best.currentUphold ? firm : best
              ).name.substring(0, 12) : 'N/A'}
          </div>
        </div>
        <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border border-red-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Needs Improvement</h4>
          <div className="text-lg font-bold text-red-600">
            {currentData.length > 0 ? 
              currentData.reduce((worst, firm) => 
                firm.currentUphold > worst.currentUphold ? firm : worst
              ).name.substring(0, 12) : 'N/A'}
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Industry Benchmark</h4>
          <div className="text-lg font-bold text-purple-600">
            {formatPercentage(benchmarks.avgUphold)}
          </div>
        </div>
      </div>

      {/* Selected Firms Management */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Firms</h3>
        <div className="flex flex-wrap gap-2">
          {selectedFirms.map((firmName, index) => {
            const colorIndex = index % firmColors.length;
            return (
              <span 
                key={firmName} 
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border-l-4"
                style={{ borderLeftColor: firmColors[colorIndex].border }}
              >
                {firmName.substring(0, 25)}
                <button
                  onClick={() => onRemoveFirm(firmName)}
                  className="ml-2 text-gray-500 hover:text-red-600 transition-colors"
                  title="Remove firm"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical Trends</h3>
          <div className="h-80">
            <canvas ref={historicalChartRef}></canvas>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Performance Comparison</h3>
          <div className="h-80">
            <canvas ref={comparisonChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Detailed Comparison Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Performance Comparison</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Firm Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Uphold Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  vs Industry Avg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Closure Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Complaints Volume
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentData.map((firm, index) => {
                const colorIndex = index % firmColors.length;
                const vsIndustry = firm.currentUphold - benchmarks.avgUphold;
                return (
                  <tr key={firm.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: firmColors[colorIndex].border }}
                        ></div>
                        <div className="text-sm font-medium text-gray-900">
                          {firm.name.substring(0, 30)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPercentage(firm.currentUphold)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        vsIndustry > 0 ? 'text-red-600' : vsIndustry < 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {vsIndustry > 0 ? '+' : ''}{formatPercentage(vsIndustry)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPercentage(firm.currentClosure)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatNumber(firm.complaintCount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getTrendColor(firm.trend)}`}>
                        {getTrendIcon(firm.trend)} {formatPercentage(Math.abs(firm.trend))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ DEBUG INFO: Data Status (Development Only) */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <details className="cursor-pointer">
            <summary className="font-medium text-gray-700 mb-2">🔧 Multi-Firm Component Debug Info</summary>
            <div className="text-xs text-gray-600 space-y-1">
              <div><strong>Selected Firms:</strong> {selectedFirms.join(', ')}</div>
              <div><strong>Firm Data Count:</strong> {firmData.length}</div>
              <div><strong>Historical Data Count:</strong> {historicalData.length}</div>
              <div><strong>Industry Trends Count:</strong> {industryTrends.length}</div>
              <div><strong>Current Firm Data:</strong> {JSON.stringify(getCurrentFirmData().map(f => ({ 
                name: f.name.substring(0, 15), 
                uphold: f.currentUphold, 
                closure: f.currentClosure 
              })))}</div>
              <div><strong>Industry Benchmarks:</strong> {JSON.stringify(calculateIndustryBenchmarks())}</div>
              {historicalData.length > 0 && (
                <div><strong>Sample Historical Data Properties:</strong> {Object.keys(historicalData[0]).join(', ')}</div>
              )}
              {industryTrends.length > 0 && (
                <div><strong>Sample Industry Data Properties:</strong> {Object.keys(industryTrends[0]).join(', ')}</div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
