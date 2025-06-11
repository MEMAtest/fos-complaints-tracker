'use client';

import React, { Component, useEffect, useState, useCallback, useRef, ErrorInfo, ReactNode } from 'react';;
import Script from 'next/script';

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Data interfaces with strict validation
interface DashboardKPIs {
  total_complaints: number;
  total_firms: number;
  avg_upheld_rate: number;
  total_rows: number;
}

interface FirmPerformance {
  firm_name: string;
  complaint_count: number;
  avg_uphold_rate: string | number;
  avg_resolution_speed?: string | number;
}

interface ProductCategory {
  category_name: string;
  complaint_count: number;
  avg_uphold_rate: string | number;
  avg_resolution_speed?: string | number;
}

interface ConsumerCreditFirm {
  firm_name: string;
  total_received: number;
  avg_upheld_pct: string | number;
  avg_resolution_speed?: string | number;
}

interface DashboardData {
  kpis: DashboardKPIs;
  topPerformers: FirmPerformance[];
  productCategories: ProductCategory[];
  industryComparison: FirmPerformance[];
  consumerCredit: ConsumerCreditFirm[];
}

interface APIResponse {
  success: boolean;
  data?: DashboardData;
  error?: string;
  debug?: {
    timestamp: string;
    dataSource: string;
    totalRecordsFound?: number;
  };
}

// Data validation functions
const validateKPIs = (kpis: any): DashboardKPIs => ({
  total_complaints: Math.max(0, parseInt(String(kpis?.total_complaints || 0))),
  total_firms: Math.max(0, parseInt(String(kpis?.total_firms || 0))),
  avg_upheld_rate: Math.max(0, Math.min(100, parseFloat(String(kpis?.avg_upheld_rate || 0)))),
  total_rows: Math.max(0, parseInt(String(kpis?.total_rows || 0)))
});

const validateFirmArray = (firms: any[]): FirmPerformance[] => {
  if (!Array.isArray(firms)) return [];
  return firms.slice(0, 10).map(firm => ({
    firm_name: String(firm?.firm_name || 'Unknown Firm').substring(0, 100),
    complaint_count: Math.max(0, parseInt(String(firm?.complaint_count || 0))),
    avg_uphold_rate: Math.max(0, Math.min(100, parseFloat(String(firm?.avg_uphold_rate || 0)))),
    avg_resolution_speed: firm?.avg_resolution_speed ? 
      Math.max(0, Math.min(100, parseFloat(String(firm.avg_resolution_speed)))) : undefined
  }));
};

const validateProductArray = (products: any[]): ProductCategory[] => {
  if (!Array.isArray(products)) return [];
  return products.slice(0, 10).map(product => ({
    category_name: String(product?.category_name || 'Unknown Category').substring(0, 100),
    complaint_count: Math.max(0, parseInt(String(product?.complaint_count || 0))),
    avg_uphold_rate: Math.max(0, Math.min(100, parseFloat(String(product?.avg_uphold_rate || 0)))),
    avg_resolution_speed: product?.avg_resolution_speed ? 
      Math.max(0, Math.min(100, parseFloat(String(product.avg_resolution_speed)))) : undefined
  }));
};

const validateConsumerCreditArray = (credit: any[]): ConsumerCreditFirm[] => {
  if (!Array.isArray(credit)) return [];
  return credit.slice(0, 10).map(firm => ({
    firm_name: String(firm?.firm_name || 'Unknown Firm').substring(0, 100),
    total_received: Math.max(0, parseInt(String(firm?.total_received || 0))),
    avg_upheld_pct: Math.max(0, Math.min(100, parseFloat(String(firm?.avg_upheld_pct || 0)))),
    avg_resolution_speed: firm?.avg_resolution_speed ? 
      Math.max(0, Math.min(100, parseFloat(String(firm.avg_resolution_speed)))) : undefined
  }));
};

// Loading Component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-2 text-gray-600">Loading dashboard data...</span>
  </div>
);

// Error Fallback Component
const ErrorFallback = ({ error, retry }: { error?: string; retry: () => void }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
    <h3 className="text-lg font-semibold text-red-800 mb-2">Dashboard Error</h3>
    <p className="text-red-600 mb-4">{error || 'An unexpected error occurred'}</p>
    <button 
      onClick={retry}
      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
    >
      Retry Loading
    </button>
  </div>
);

// Chart cleanup utility
const destroyChart = (chartRef: React.MutableRefObject<any>) => {
  if (chartRef.current) {
    try {
      chartRef.current.destroy();
      chartRef.current = null;
    } catch (e) {
      console.warn('Error destroying chart:', e);
    }
  }
};


export default function Dashboard() {
  // State management
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartJsLoaded, setChartJsLoaded] = useState(false);
  const [chartJsError, setChartJsError] = useState(false);
  const [selectedYears, setSelectedYears] = useState(['2024']);
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Chart references for cleanup
  const kpiChartRef = useRef<any>(null);
  const performersChartRef = useRef<any>(null);
  const categoryChartRef = useRef<any>(null);

  // Data fetching with robust error handling
  const fetchDashboardData = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch('/api/dashboard', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: APIResponse = await response.json();
      
      if (!result.success && result.error) {
        console.warn('API returned error, using fallback data:', result.error);
      }

      if (result.data) {
        // Validate and sanitize all data
        const validatedData: DashboardData = {
          kpis: validateKPIs(result.data.kpis),
          topPerformers: validateFirmArray(result.data.topPerformers),
          productCategories: validateProductArray(result.data.productCategories),
          industryComparison: validateFirmArray(result.data.industryComparison),
          consumerCredit: validateConsumerCreditArray(result.data.consumerCredit)
        };

        setData(validatedData);
        setLastUpdated(new Date());
        console.log('✅ Dashboard data loaded successfully:', {
          source: result.debug?.dataSource,
          records: result.debug?.totalRecordsFound,
          firms: validatedData.kpis.total_firms
        });
      } else {
        throw new Error('No data received from API');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Dashboard data fetch failed:', errorMessage);
      
      if (retryCount < 2) {
        console.log(`⏳ Retrying... (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchDashboardData(retryCount + 1);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Chart initialization with error handling
  const initializeCharts = useCallback(() => {
    if (!chartJsLoaded || !data || !window.Chart) {
      console.log('⏳ Waiting for Chart.js or data...');
      return;
    }

    try {
      console.log('🎨 Initializing charts...');

      // Cleanup existing charts
      destroyChart(kpiChartRef);
      destroyChart(performersChartRef);
      destroyChart(categoryChartRef);

      // KPI Doughnut Chart
      const kpiCanvas = document.getElementById('kpiChart') as HTMLCanvasElement;
      if (kpiCanvas) {
        const ctx = kpiCanvas.getContext('2d');
        if (ctx) {
          kpiChartRef.current = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: ['Complaints Received', 'Average Processing'],
              datasets: [{
                data: [data.kpis.total_complaints, data.kpis.total_firms * 1000],
                backgroundColor: ['#3b82f6', '#10b981'],
                borderWidth: 2,
                borderColor: '#ffffff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { padding: 20, font: { size: 12 } }
                }
              }
            }
          });
        }
      }

      // Top Performers Bar Chart
      const performersCanvas = document.getElementById('performersChart') as HTMLCanvasElement;
      if (performersCanvas && data.topPerformers.length > 0) {
        const ctx = performersCanvas.getContext('2d');
        if (ctx) {
          performersChartRef.current = new window.Chart(ctx, {
            type: 'bar',
            data: {
              labels: data.topPerformers.slice(0, 5).map(p => 
                p.firm_name.length > 20 ? p.firm_name.substring(0, 20) + '...' : p.firm_name
              ),
              datasets: [{
                label: 'Uphold Rate (%)',
                data: data.topPerformers.slice(0, 5).map(p => 
                  typeof p.avg_uphold_rate === 'string' ? 
                  parseFloat(p.avg_uphold_rate) : p.avg_uphold_rate
                ),
                backgroundColor: ['#10b981', '#10b981', '#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 1,
                borderColor: '#ffffff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: { 
                  beginAtZero: true, 
                  max: 100,
                  ticks: { callback: (value: any) => value + '%' }
                },
                x: {
                  ticks: { 
                    maxRotation: 45,
                    minRotation: 0,
                    font: { size: 10 }
                  }
                }
              }
            }
          });
        }
      }

      // Product Categories Chart
      const categoryCanvas = document.getElementById('categoryChart') as HTMLCanvasElement;
      if (categoryCanvas && data.productCategories.length > 0) {
        const ctx = categoryCanvas.getContext('2d');
        if (ctx) {
          categoryChartRef.current = new window.Chart(ctx, {
            type: 'pie',
            data: {
              labels: data.productCategories.map(p => p.category_name),
              datasets: [{
                data: data.productCategories.map(p => p.complaint_count),
                backgroundColor: [
                  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'right',
                  labels: { 
                    padding: 15, 
                    font: { size: 11 },
                    generateLabels: (chart: any) => {
                      const data = chart.data;
                      return data.labels?.map((label: any, i: number) => ({
                        text: `${label}: ${data.datasets[0].data[i]}`,
                        fillStyle: data.datasets[0].backgroundColor?.[i],
                        index: i
                      })) || [];
                    }
                  }
                }
              }
            }
          });
        }
      }

      console.log('✅ Charts initialized successfully');
    } catch (err) {
      console.error('❌ Chart initialization failed:', err);
      setError('Failed to initialize charts: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [chartJsLoaded, data]);

  // Year selection with validation
  const handleYearChange = useCallback((year: string, checked: boolean) => {
    setSelectedYears(prev => {
      let newYears = checked 
        ? [...prev, year]
        : prev.filter(y => y !== year);
      
      // Ensure at least one year is selected
      if (newYears.length === 0) {
        newYears = ['2024'];
      }
      
      // Limit to max 5 years for performance
      if (newYears.length > 5) {
        newYears = newYears.slice(-5);
      }
      
      return newYears.sort();
    });
  }, []);

  // Effects
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (chartJsLoaded && data) {
      // Delay chart initialization to ensure DOM is ready
      const timeoutId = setTimeout(initializeCharts, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [chartJsLoaded, data, initializeCharts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyChart(kpiChartRef);
      destroyChart(performersChartRef);
      destroyChart(categoryChartRef);
    };
  }, []);

  // Format helpers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatPercentage = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '0.0%' : num.toFixed(1) + '%';
  };

  // Render loading state
  if (loading) {
    return <LoadingSpinner />;
  }

  // Render error state
  if (error && !data) {
    return <ErrorFallback error={error} retry={() => fetchDashboardData()} />;
  }

  return (
    <ErrorBoundary fallback={<ErrorFallback error="Component error" retry={() => window.location.reload()} />}>
      {/* Chart.js Script Loading */}
      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"
        onLoad={() => {
          console.log('✅ Chart.js loaded successfully');
          setChartJsLoaded(true);
        }}
        onError={() => {
          console.error('❌ Failed to load Chart.js');
          setChartJsError(true);
        }}
        strategy="beforeInteractive"
      />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  Financial Complaints Tracking Dashboard
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  Comprehensive analysis of complaint resolution performance across financial firms
                </p>
                {lastUpdated && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={() => fetchDashboardData()}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                aria-label="Refresh dashboard data"
              >
                {loading ? '⏳' : '🔄'} Refresh
              </button>
            </div>
            
            {/* Year Selection */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Years:
              </label>
              <div className="flex flex-wrap gap-3">
                {['2020', '2021', '2022', '2023', '2024'].map(year => (
                  <label key={year} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(year)}
                      onChange={(e) => handleYearChange(year, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      aria-label={`Select year ${year}`}
                    />
                    <span className="text-sm font-medium text-gray-700">{year}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Indicators */}
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className={`px-2 py-1 rounded ${chartJsLoaded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                Charts: {chartJsLoaded ? '✅ Ready' : '⏳ Loading'}
              </span>
              <span className={`px-2 py-1 rounded ${data ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                Data: {data ? '✅ Loaded' : '⏳ Loading'}
              </span>
              {error && (
                <span className="px-2 py-1 rounded bg-red-100 text-red-800">
                  ⚠️ {error.substring(0, 50)}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="flex overflow-x-auto border-b border-gray-200">
              {[
                { id: 'overview', label: '📊 Performance Overview', ariaLabel: 'Performance Overview Tab' },
                { id: 'firm', label: '🏢 Firm Deep Dive', ariaLabel: 'Firm Deep Dive Tab' },
                { id: 'product', label: '📈 Product Analysis', ariaLabel: 'Product Analysis Tab' },
                { id: 'credit', label: '💳 Consumer Credit Focus', ariaLabel: 'Consumer Credit Focus Tab' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-label={tab.ariaLabel}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
            {activeTab === 'overview' && data && (
              <div className="space-y-6">
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Total Complaints ({selectedYears.join(', ')})
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                          {formatNumber(data.kpis.total_complaints)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          From {data.kpis.total_firms} firms
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl" role="img" aria-label="Chart icon">📊</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Data Records ({selectedYears.join(', ')})
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                          {formatNumber(data.kpis.total_rows)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Processing records
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl" role="img" aria-label="Checkmark icon">✅</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Avg Upheld Rate ({selectedYears.join(', ')})
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                          {formatPercentage(data.kpis.avg_upheld_rate)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Industry average
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl" role="img" aria-label="Warning icon">⚠️</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Insights */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    🏆 Key Performance Insights for {selectedYears.join(', ')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-semibold text-green-600 mb-3">Top 5 Best Performers</h4>
                      <div className="space-y-2">
                        {data.topPerformers.slice(0, 5).map((firm, idx) => (
                          <div key={idx} className="text-sm bg-white rounded px-3 py-2">
                            <div className="font-medium">{firm.firm_name}</div>
                            <div className="text-gray-600">
                              {formatPercentage(firm.avg_uphold_rate)} upheld
                              {firm.avg_resolution_speed && (
                                <span className="ml-2 text-blue-600">
                                  • {formatPercentage(firm.avg_resolution_speed)} fast
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-red-600 mb-3">Product Categories</h4>
                      <div className="space-y-2">
                        {data.productCategories.slice(0, 5).map((category, idx) => (
                          <div key={idx} className="text-sm bg-white rounded px-3 py-2">
                            <div className="font-medium">{category.category_name}</div>
                            <div className="text-gray-600">
                              {formatNumber(category.complaint_count)} complaints
                              <span className="ml-2 text-orange-600">
                                • {formatPercentage(category.avg_uphold_rate)} upheld
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-blue-600 mb-3">Consumer Credit Leaders</h4>
                      <div className="space-y-2">
                        {data.consumerCredit.slice(0, 5).map((firm, idx) => (
                          <div key={idx} className="text-sm bg-white rounded px-3 py-2">
                            <div className="font-medium">{firm.firm_name}</div>
                            <div className="text-gray-600">
                              {formatNumber(firm.total_received)} complaints
                              <span className="ml-2 text-purple-600">
                                • {formatPercentage(firm.avg_upheld_pct)} upheld
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Complaint Distribution
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      {chartJsLoaded ? (
                        <canvas id="kpiChart" aria-label="Complaint distribution chart"></canvas>
                      ) : chartJsError ? (
                        <div className="text-center text-gray-500">
                          <p>⚠️ Charts unavailable</p>
                          <p className="text-xs mt-1">Chart.js failed to load</p>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm">Loading chart...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Best Performers (Lowest Uphold Rates)
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      {chartJsLoaded ? (
                        <canvas id="performersChart" aria-label="Top performers chart"></canvas>
                      ) : (
                        <div className="text-center text-gray-500">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm">Loading chart...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Product Categories
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      {chartJsLoaded ? (
                        <canvas id="categoryChart" aria-label="Product categories chart"></canvas>
                      ) : (
                        <div className="text-center text-gray-500">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm">Loading chart...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Tabs - Placeholder Content */}
            {activeTab !== 'overview' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">
                  {activeTab.replace('-', ' ')} Analysis
                </h3>
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">
                    This section is under development
                  </p>
                  <button
                    onClick={() => setActiveTab('overview')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Return to Overview
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Debug Info */}
          <div className="mt-8 p-4 bg-white rounded-lg shadow-sm">
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer font-medium mb-2">🔧 Technical Status</summary>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                <div>
                  <strong>Chart.js:</strong> {chartJsLoaded ? '✅ Loaded' : chartJsError ? '❌ Failed' : '⏳ Loading'}
                </div>
                <div>
                  <strong>Data:</strong> {data ? '✅ Connected' : '❌ No Data'}
                </div>
                <div>
                  <strong>Records:</strong> {data?.kpis.total_rows || 0}
                </div>
                <div>
                  <strong>Last Update:</strong> {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                </div>
              </div>
              {error && (
                <div className="mt-2 p-2 bg-red-50 rounded text-red-600">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </details>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
