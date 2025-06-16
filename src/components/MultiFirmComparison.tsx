// src/components/MultiFirmComparison.tsx
// ✅ COMPLETE UPDATED VERSION with Enhanced Historical Chart Comparison

'use client';

import React, { useEffect, useState, useRef } from 'react';
import type { 
  HistoricalTrendData, 
  IndustryTrendData,
  TopPerformerData,
  IndustryComparisonData
} from '../types/dashboard';

// ✅ NEW: Enhanced chart comparison interfaces
interface ChartComparisonMode {
  mode: 'absolute' | 'relative' | 'normalized';
  scaleType: 'shared' | 'individual' | 'industry_relative';
}

interface ChartScaleConfig {
  min?: number;
  max?: number;
  stepSize?: number;
}

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
  yAxisID?: string;
  borderDash?: number[];
  type?: string;
}

interface Props {
  selectedFirms: string[];
  firmData: (TopPerformerData | IndustryComparisonData)[];
  historicalData: HistoricalTrendData[];
  industryTrends: IndustryTrendData[];
  onClose: () => void;
}

interface ChartInstances {
  [key: string]: any;
}

export default function MultiFirmComparison({ 
  selectedFirms, 
  firmData, 
  historicalData, 
  industryTrends, 
  onClose 
}: Props) {
  // ✅ NEW: Comparison mode state
  const [comparisonMode, setComparisonMode] = useState<ChartComparisonMode>({
    mode: 'absolute',
    scaleType: 'shared'
  });
  
  const [charts, setCharts] = useState<ChartInstances>({});
  
  const historicalChartRef = useRef<HTMLCanvasElement>(null);
  const comparisonChartRef = useRef<HTMLCanvasElement>(null);

  // ✅ Enhanced color palette for better distinction
  const firmColors = [
    { border: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' },
    { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' },
    { border: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
    { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' },
    { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' },
    { border: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)' },
    { border: '#84cc16', background: 'rgba(132, 204, 22, 0.1)' },
    { border: '#f97316', background: 'rgba(249, 115, 22, 0.1)' }
  ];

  // ✅ Helper functions for enhanced chart functionality
  const calculateIndustryBaseline = (): number => {
    if (!industryTrends || industryTrends.length === 0) return 25; // Default fallback
    
    const avgUpholdRates = industryTrends.map(trend => trend.avg_uphold_rate || 0);
    const validRates = avgUpholdRates.filter(rate => rate > 0);
    
    if (validRates.length === 0) return 25;
    
    return validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length;
  };

  const calculateOptimalScales = (firmNames: string[]): Map<string, ChartScaleConfig> => {
    const scaleMap = new Map<string, ChartScaleConfig>();
    
    firmNames.forEach(firmName => {
      const firmData = getFirmHistoricalData(firmName);
      if (firmData.length === 0) return;
      
      const values = firmData.map(d => d.y).filter(v => v > 0);
      if (values.length === 0) return;
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      
      // Create optimal scale with padding
      const padding = Math.max(range * 0.1, 2); // At least 2% padding
      scaleMap.set(firmName, {
        min: Math.max(0, min - padding),
        max: Math.min(100, max + padding),
        stepSize: range > 20 ? 10 : 5
      });
    });
    
    return scaleMap;
  };

  const getNormalizedData = (firmName: string): Array<{x: string, y: number}> => {
    const firmData = getFirmHistoricalData(firmName);
    const baseline = calculateIndustryBaseline();
    
    return firmData.map(point => ({
      x: point.x,
      y: point.y - baseline // Difference from industry average
    }));
  };

  // ✅ Existing helper functions (preserved)
  const getUpheldRate = (firm: TopPerformerData | IndustryComparisonData): number => {
    return firm.avg_uphold_rate || 0;
  };

  const getClosureRate = (firm: TopPerformerData | IndustryComparisonData): number => {
    return firm.avg_closure_rate || 0;
  };

  const getComplaintCount = (firm: TopPerformerData | IndustryComparisonData): number => {
    return firm.complaint_count || 0;
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const getFirmHistoricalData = (firmName: string): Array<{x: string, y: number}> => {
    const firmHistorical = historicalData
      .filter(item => item.firm_name === firmName && item.upheld_rate > 0)
      .sort((a, b) => a.reporting_period.localeCompare(b.reporting_period));

    return firmHistorical.map(item => ({
      x: item.reporting_period,
      y: item.upheld_rate
    }));
  };

  const getIndustryAverageData = (): Array<{x: string, y: number}> => {
    if (!industryTrends || industryTrends.length === 0) return [];

    return industryTrends
      .filter(item => item.avg_uphold_rate > 0)
      .sort((a, b) => a.year.localeCompare(b.year))
      .map(item => ({
        x: item.year,
        y: item.avg_uphold_rate
      }));
  };

  const calculateIndustryBenchmarks = () => {
    const validFirms = firmData.filter(f => f.avg_uphold_rate > 0);
    if (validFirms.length === 0) return { avgUphold: 0, avgClosure: 0 };

    const avgUphold = validFirms.reduce((sum, f) => sum + f.avg_uphold_rate, 0) / validFirms.length;
    const avgClosure = validFirms.reduce((sum, f) => sum + (f.avg_closure_rate || 0), 0) / validFirms.length;

    return { avgUphold, avgClosure };
  };

  const getCurrentFirmData = () => {
    return selectedFirms.map(firmName => {
      const firm = firmData.find(f => f.firm_name === firmName);
      return {
        name: firmName,
        currentUphold: firm ? getUpheldRate(firm) : 0,
        currentClosure: firm ? getClosureRate(firm) : 0,
        complaintCount: firm ? getComplaintCount(firm) : 0
      };
    });
  };

  const getTrendColor = (trend: number) => {
    if (trend > 2) return 'text-red-600';
    if (trend < -2) return 'text-green-600';
    return 'text-gray-600';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 2) return '↗️';
    if (trend < -2) return '↘️';
    return '→';
  };

  const getComparisonSummary = () => {
    const historical = selectedFirms.map(firmName => {
      const firmHistorical = getFirmHistoricalData(firmName);
      const latestData = firmHistorical[firmHistorical.length - 1];
      const earliestData = firmHistorical[0];

      return {
        firmName,
        currentUphold: latestData?.y || 0,
        currentClosure: getCurrentFirmData().find(f => f.name === firmName)?.currentClosure || 0,
        complaintCount: getCurrentFirmData().find(f => f.name === firmName)?.complaintCount || 0,
        trend: firmHistorical.length >= 2 ? 
          ((latestData?.y || 0) - (earliestData?.y || 0)) : 0
      };
    });

    return historical;
  };

  // ✅ ENHANCED: Historical chart with comparison modes
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
    const optimalScales = calculateOptimalScales(selectedFirms);

    // Add datasets for each selected firm based on comparison mode
    selectedFirms.forEach((firmName, index) => {
      try {
        const colorIndex = index % firmColors.length;
        let firmData: Array<{x: string, y: number}>;
        let yAxisId = 'y';

        // Get data based on comparison mode
        if (comparisonMode.mode === 'normalized') {
          firmData = getNormalizedData(firmName);
        } else {
          firmData = getFirmHistoricalData(firmName);
        }

        // For individual scaling, assign different y-axes
        if (comparisonMode.scaleType === 'individual' && comparisonMode.mode === 'absolute') {
          yAxisId = `y${index}`;
        }

        if (firmData.length > 0) {
          datasets.push({
            label: firmName.substring(0, 20),
            data: firmData,
            borderColor: firmColors[colorIndex].border,
            backgroundColor: firmColors[colorIndex].background,
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
            yAxisID: yAxisId
          });
        }
      } catch (error) {
        console.error(`Error processing historical data for ${firmName}:`, error);
      }
    });

    // Add industry baseline for normalized view
    if (comparisonMode.mode === 'normalized') {
      const industryData = getIndustryAverageData();
      if (industryData.length > 0) {
        datasets.push({
          label: 'Industry Baseline (0%)',
          data: industryData.map(point => ({ x: point.x, y: 0 })),
          borderColor: '#9ca3af',
          backgroundColor: 'rgba(156, 163, 175, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4
        });
      }
    } else {
      // Add regular industry average for absolute view
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
    }

    if (datasets.length === 0) {
      console.warn('No datasets available for historical chart');
      return;
    }

    // Build scales configuration based on comparison mode
    const scales: any = {
      x: {
        type: 'category',
        title: {
          display: true,
          text: 'Reporting Period'
        },
        ticks: {
          maxRotation: 45,
          font: { size: 10 }
        }
      }
    };

    // Configure Y-axes based on comparison mode
    if (comparisonMode.scaleType === 'individual' && comparisonMode.mode === 'absolute') {
      // Dual-axis configuration for different firm ranges
      selectedFirms.forEach((firmName, index) => {
        const scale = optimalScales.get(firmName);
        scales[`y${index}`] = {
          type: 'linear',
          display: index < 2, // Only show first two y-axes to avoid clutter
          position: index === 0 ? 'left' : 'right',
          title: {
            display: true,
            text: index === 0 ? 'Uphold Rate (%)' : `${firmName.substring(0, 10)} (%)`
          },
          min: scale?.min || 0,
          max: scale?.max || 100,
          ticks: {
            stepSize: scale?.stepSize || 10,
            callback: function(value: any) {
              return value + '%';
            }
          },
          grid: {
            drawOnChartArea: index === 0, // Only show grid for primary axis
          }
        };
      });
    } else {
      // Single Y-axis configuration
      if (comparisonMode.mode === 'normalized') {
        // Normalized view: center around 0
        scales.y = {
          title: {
            display: true,
            text: 'Difference from Industry Average (%)'
          },
          ticks: {
            callback: function(value: any) {
              return (value > 0 ? '+' : '') + value.toFixed(1) + '%';
            }
          },
          grid: {
            color: function(context: any) {
              return context.tick.value === 0 ? '#374151' : '#e5e7eb';
            },
            lineWidth: function(context: any) {
              return context.tick.value === 0 ? 2 : 1;
            }
          }
        };
      } else {
        // Standard absolute view
        scales.y = {
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
        };
      }
    }

    // Chart title based on mode
    let chartTitle = 'Historical Uphold Rate Trends';
    if (comparisonMode.mode === 'normalized') {
      chartTitle = 'Performance vs Industry Average';
    } else if (comparisonMode.scaleType === 'individual') {
      chartTitle = 'Historical Trends (Optimized Scales)';
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
            text: chartTitle,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            callbacks: {
              title: function(context: any) {
                return `Period: ${context[0].label}`;
              },
              label: function(context: any) {
                if (comparisonMode.mode === 'normalized') {
                  const value = context.parsed.y;
                  const prefix = value > 0 ? '+' : '';
                  return `${context.dataset.label}: ${prefix}${value.toFixed(1)}% vs industry`;
                }
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
              }
            }
          }
        },
        scales: scales
      }
    });

    setCharts(prev => ({ ...prev, historical: newChart }));
    
    console.log('✅ Enhanced historical chart created with mode:', comparisonMode);
  };

  // ✅ Existing comparison chart (preserved)
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
              type: 'line' as any,
              borderDash: [5, 5],
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
              position: 'top' as any
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
              title: {
                display: true,
                text: 'Financial Firms'
              },
              ticks: {
                maxRotation: 45
              }
            },
            y: {
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

  // ✅ UPDATED: Create charts when data or comparison mode changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Chart) {
      const timeoutId = setTimeout(() => {
        createComparisonChart();
        createHistoricalChart(); // Uses the new comparison mode
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedFirms, firmData, historicalData, industryTrends, comparisonMode]); // Added comparisonMode

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
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Firms to Compare</h3>
        <p className="text-gray-600">Choose 2 or more firms from the filters above to see detailed comparison charts and analysis.</p>
      </div>
    );
  }

  const summaryData = getComparisonSummary();
  const benchmarks = calculateIndustryBenchmarks();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Multi-Firm Comparison</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            ✕ Close
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Comparing {selectedFirms.length} firms: {selectedFirms.join(', ')}
        </div>
      </div>

      {/* ✅ NEW: Comparison Mode Controls */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">📊 Chart Comparison Mode</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* View Mode Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">View Mode</label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={comparisonMode.mode === 'absolute'}
                  onChange={() => setComparisonMode(prev => ({ ...prev, mode: 'absolute' }))}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">Absolute Values (0-100%)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={comparisonMode.mode === 'normalized'}
                  onChange={() => setComparisonMode(prev => ({ ...prev, mode: 'normalized' }))}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">vs Industry Average (±%)</span>
              </label>
            </div>
          </div>
          
          {/* Scale Type Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Scale Type</label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={comparisonMode.scaleType === 'shared'}
                  onChange={() => setComparisonMode(prev => ({ ...prev, scaleType: 'shared' }))}
                  className="mr-2 text-blue-600"
                  disabled={comparisonMode.mode === 'normalized'}
                />
                <span className="text-sm">Shared Scale (0-100%)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={comparisonMode.scaleType === 'individual'}
                  onChange={() => setComparisonMode(prev => ({ ...prev, scaleType: 'individual' }))}
                  className="mr-2 text-blue-600"
                  disabled={comparisonMode.mode === 'normalized'}
                />
                <span className="text-sm">Optimized Scales (Dual-Axis)</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Help Text */}
        <div className="mt-3 text-xs text-gray-500">
          {comparisonMode.mode === 'normalized' ? 
            '📊 Shows performance relative to industry average. Above 0% = better than average.' :
            comparisonMode.scaleType === 'individual' ?
            '📊 Uses optimized scales for each firm. Ideal for comparing firms with very different ranges (e.g., Co-operative Bank 40-60% vs Curtis Banks 65-80%).' :
            '📊 Standard view with shared 0-100% scale for all firms.'
          }
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  Complaint Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summaryData.map((firm, index) => {
                const vsIndustry = firm.currentUphold - benchmarks.avgUphold;
                return (
                  <tr key={firm.firmName} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{firm.firmName}</div>
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
              <div><strong>Comparison Mode:</strong> {JSON.stringify(comparisonMode)}</div>
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