'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';

interface FirmMetric {
  firm_id: string;
  firm_name: string;
  firm_group: string;
  reporting_period_id: string;
  period_name: string;
  year: number;
  product_category_id: string;
  category_name: string;
  closed_within_3_days_pct: number;
  closed_after_3_days_within_8_weeks_pct: number;
  upheld_rate_pct: number;
  total_complaints: number;
}

interface ConsumerCreditMetric {
  firm_id: string;
  firm_name: string;
  firm_group: string;
  reporting_period_id: string;
  period_name: string;
  year: number;
  complaints_received: number;
  complaints_closed: number;
  complaints_upheld_pct: number;
  reporting_frequency: string;
}

interface DashboardData {
  firmMetrics: FirmMetric[];
  consumerCredit: ConsumerCreditMetric[];
  kpis: {
    total_complaints: number;
    total_closed: number;
    avg_upheld_rate: number;
  };
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedYears, setSelectedYears] = useState(['2024']);
  const [loading, setLoading] = useState(true);
  const [chartJsLoaded, setChartJsLoaded] = useState(false);
  const chartsRef = useRef<{[key: string]: any}>({});

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/dashboard?query=initial_load');
        const data = await response.json();
        
        if (data.error) {
          console.error('API Error:', data.error);
          setLoading(false);
          return;
        }
        
        console.log('Loaded dashboard data:', data);
        setDashboardData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Initialize charts when Chart.js is loaded and data is available
  useEffect(() => {
    if (chartJsLoaded && dashboardData && !loading) {
      setTimeout(() => {
        createOverviewCharts();
      }, 100);
    }
  }, [chartJsLoaded, dashboardData, loading, selectedYears]);

  const createOverviewCharts = () => {
    if (typeof window === 'undefined' || !window.Chart || !dashboardData) return;

    // Clear existing charts
    Object.values(chartsRef.current).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    chartsRef.current = {};

    // Filter data by selected years
    const filteredFirmData = dashboardData.firmMetrics.filter(
      item => item.year && selectedYears.includes(item.year.toString())
    );

    const filteredCreditData = dashboardData.consumerCredit.filter(
      item => item.year && selectedYears.includes(item.year.toString())
    );

    // Aggregate performance data by firm
    const firmPerformance: {[key: string]: {
      firmName: string;
      firmGroup: string;
      avgClosed3Days: number;
      avgUpheld: number;
      totalComplaints: number;
      count: number;
    }} = {};

    filteredFirmData.forEach(item => {
      if (!item.firm_name) return; // Skip items without firm names
      
      if (!firmPerformance[item.firm_name]) {
        firmPerformance[item.firm_name] = {
          firmName: item.firm_name,
          firmGroup: item.firm_group || 'Unknown',
          avgClosed3Days: 0,
          avgUpheld: 0,
          totalComplaints: 0,
          count: 0
        };
      }
      firmPerformance[item.firm_name].avgClosed3Days += item.closed_within_3_days_pct || 0;
      firmPerformance[item.firm_name].avgUpheld += item.upheld_rate_pct || 0;
      firmPerformance[item.firm_name].totalComplaints += item.total_complaints || 0;
      firmPerformance[item.firm_name].count += 1;
    });

    // Calculate averages
    const performanceArray = Object.values(firmPerformance).map(firm => ({
      name: firm.firmName,
      group: firm.firmGroup,
      avgClosed3Days: firm.count > 0 ? firm.avgClosed3Days / firm.count : 0,
      avgUpheld: firm.count > 0 ? firm.avgUpheld / firm.count : 0,
      totalComplaints: firm.totalComplaints
    })).filter(firm => firm.avgClosed3Days > 0 || firm.avgUpheld > 0);

    // Best vs Worst Performers Chart
    const sortedByUpheld = [...performanceArray].sort((a, b) => a.avgUpheld - b.avgUpheld);
    const best5 = sortedByUpheld.slice(0, Math.min(5, sortedByUpheld.length));
    const worst5 = sortedByUpheld.slice(-Math.min(5, sortedByUpheld.length)).reverse();

    const performersCtx = document.getElementById('performersChart') as HTMLCanvasElement;
    if (performersCtx && (best5.length > 0 || worst5.length > 0)) {
      chartsRef.current.performers = new window.Chart(performersCtx, {
        type: 'bar',
        data: {
          labels: [...best5.map(f => f.name), ...worst5.map(f => f.name)],
          datasets: [{
            label: 'Average Uphold Rate (%)',
            data: [...best5.map(f => f.avgUpheld), ...worst5.map(f => f.avgUpheld)],
            backgroundColor: [
              ...Array(best5.length).fill('#10b981'),
              ...Array(worst5.length).fill('#ef4444')
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterLabel: function(context: any) {
                  const allFirms = [...best5, ...worst5];
                  const firm = allFirms[context.dataIndex];
                  return firm ? `Group: ${firm.group}` : '';
                }
              }
            }
          },
          scales: {
            y: { beginAtZero: true, max: 100 },
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 0
              }
            }
          }
        }
      });
    }

    // Product Category Distribution
    const categoryDistribution: {[key: string]: number} = {};
    filteredFirmData.forEach(item => {
      if (item.category_name) {
        categoryDistribution[item.category_name] = (categoryDistribution[item.category_name] || 0) + (item.total_complaints || 0);
      }
    });

    const categoryCtx = document.getElementById('categoryDistributionChart') as HTMLCanvasElement;
    if (categoryCtx && Object.keys(categoryDistribution).length > 0) {
      chartsRef.current.categoryDist = new window.Chart(categoryCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(categoryDistribution),
          datasets: [{
            data: Object.values(categoryDistribution),
            backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom' as const,
              labels: { padding: 10, font: { size: 11 } }
            }
          }
        }
      });
    }

    // Industry Comparison Bubble Chart
    const industryCtx = document.getElementById('industryComparisonChart') as HTMLCanvasElement;
    if (industryCtx && performanceArray.length > 0) {
      const bubbleData = performanceArray.map(firm => ({
        x: firm.avgClosed3Days,
        y: firm.avgUpheld,
        r: Math.max(5, Math.min(20, firm.totalComplaints / 100)),
        firmName: firm.name,
        firmGroup: firm.group
      }));

      chartsRef.current.industry = new window.Chart(industryCtx, {
        type: 'bubble',
        data: {
          datasets: [{
            label: 'Firms Performance',
            data: bubbleData,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: '#3b82f6'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  const point = context.raw;
                  if (!point) return '';
                  return [
                    `${point.firmName || 'Unknown Firm'}`,
                    `Group: ${point.firmGroup || 'Unknown'}`,
                    `3-day resolution: ${(point.x || 0).toFixed(1)}%`,
                    `Uphold rate: ${(point.y || 0).toFixed(1)}%`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Resolution within 3 days (%)' },
              beginAtZero: true,
              max: 100
            },
            y: {
              title: { display: true, text: 'Uphold Rate (%)' },
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    }

    // Consumer Credit Charts
    createConsumerCreditCharts(filteredCreditData);
  };

  const createConsumerCreditCharts = (creditData: ConsumerCreditMetric[]) => {
    if (typeof window === 'undefined' || !window.Chart || creditData.length === 0) return;

    // Aggregate by firm
    const firmCreditData: {[key: string]: {
      firmName: string;
      firmGroup: string;
      totalReceived: number;
      totalClosed: number;
      avgUpheld: number;
      count: number;
    }} = {};

    creditData.forEach(item => {
      if (!item.firm_name) return;
      
      if (!firmCreditData[item.firm_name]) {
        firmCreditData[item.firm_name] = {
          firmName: item.firm_name,
          firmGroup: item.firm_group || 'Unknown',
          totalReceived: 0,
          totalClosed: 0,
          avgUpheld: 0,
          count: 0
        };
      }
      firmCreditData[item.firm_name].totalReceived += item.complaints_received || 0;
      firmCreditData[item.firm_name].totalClosed += item.complaints_closed || 0;
      firmCreditData[item.firm_name].avgUpheld += item.complaints_upheld_pct || 0;
      firmCreditData[item.firm_name].count += 1;
    });

    const creditArray = Object.values(firmCreditData).map(firm => ({
      ...firm,
      avgUpheld: firm.count > 0 ? firm.avgUpheld / firm.count : 0
    }));

    // Volume Chart
    const byVolume = [...creditArray].sort((a, b) => b.totalReceived - a.totalReceived).slice(0, 5);
    
    const volumeCtx = document.getElementById('volumeChart') as HTMLCanvasElement;
    if (volumeCtx && byVolume.length > 0) {
      chartsRef.current.volume = new window.Chart(volumeCtx, {
        type: 'bar',
        data: {
          labels: byVolume.map(d => d.firmName),
          datasets: [
            {
              label: 'Received',
              data: byVolume.map(d => d.totalReceived),
              backgroundColor: '#3b82f6'
            },
            {
              label: 'Closed',
              data: byVolume.map(d => d.totalClosed),
              backgroundColor: '#10b981'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                afterLabel: function(context: any) {
                  const firm = byVolume[context.dataIndex];
                  return firm ? `Group: ${firm.firmGroup}` : '';
                }
              }
            }
          },
          scales: {
            x: { 
              ticks: { 
                autoSkip: false,
                maxRotation: 45,
                minRotation: 0
              }
            }
          }
        }
      });
    }

    // Uphold Rate Chart
    const byUpheld = [...creditArray].sort((a, b) => b.avgUpheld - a.avgUpheld).slice(0, 5);
    
    const upheldCtx = document.getElementById('upheldChart') as HTMLCanvasElement;
    if (upheldCtx && byUpheld.length > 0) {
      chartsRef.current.upheld = new window.Chart(upheldCtx, {
        type: 'bar',
        data: {
          labels: byUpheld.map(d => d.firmName),
          datasets: [{
            label: 'Uphold Rate (%)',
            data: byUpheld.map(d => d.avgUpheld),
            backgroundColor: '#ef4444'
          }]
        },
        options: {
          indexAxis: 'y' as const,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterLabel: function(context: any) {
                  const firm = byUpheld[context.dataIndex];
                  return firm ? `Group: ${firm.firmGroup}` : '';
                }
              }
            }
          },
          scales: {
            x: { beginAtZero: true, max: 100 }
          }
        }
      });
    }
  };

  const handleYearChange = (year: string, checked: boolean) => {
    if (checked) {
      setSelectedYears([...selectedYears, year]);
    } else {
      const newYears = selectedYears.filter(y => y !== year);
      if (newYears.length > 0) {
        setSelectedYears(newYears);
      }
    }
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="text-center py-20">
          <div className="text-lg text-gray-600">Loading dashboard data...</div>
        </div>
      );
    }

    if (!dashboardData) {
      return (
        <div className="text-center py-20">
          <div className="text-lg text-red-600">Error loading data. Please check the console for details.</div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        // Get available years from the data - FIXED SET ITERATION
        const yearStrings = [
          ...dashboardData.firmMetrics.map(item => item.year?.toString()).filter(Boolean),
          ...dashboardData.consumerCredit.map(item => item.year?.toString()).filter(Boolean)
        ] as string[];
        const availableYears = Array.from(new Set(yearStrings)).sort();

        return (
          <div>
            {/* Year Selection */}
            {availableYears.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow mb-6">
                <label className="font-medium text-gray-700 mr-3">Select Years:</label>
                <div className="inline-flex gap-2 flex-wrap mt-2">
                  {availableYears.map(year => (
                    <label key={year} className="cursor-pointer">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedYears.includes(year)}
                        onChange={(e) => handleYearChange(year, e.target.checked)}
                      />
                      <span className="px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                        {year}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Total Complaints</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {dashboardData?.kpis?.total_complaints?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                    📊
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Total Closed</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {dashboardData?.kpis?.total_closed?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
                    ✅
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Avg Upheld Rate</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {dashboardData?.kpis?.avg_upheld_rate?.toFixed(1) || '0.0'}%
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-2xl">
                    ⚠️
                  </div>
                </div>
              </div>
            </div>

            {/* Data Summary */}
            <div className="bg-blue-50 p-6 rounded-lg mb-8">
              <h3 className="text-lg font-semibold mb-4">📈 Live Data Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData.firmMetrics.length}
                  </div>
                  <div className="text-sm text-blue-800">Complaint Records</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData.consumerCredit.length}
                  </div>
                  <div className="text-sm text-blue-800">Consumer Credit Records</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {Array.from(new Set(dashboardData.firmMetrics.map(f => f.firm_name).filter(Boolean))).length}
                  </div>
                  <div className="text-sm text-blue-800">Unique Firms</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {Array.from(new Set(dashboardData.firmMetrics.map(f => f.category_name).filter(Boolean))).length}
                  </div>
                  <div className="text-sm text-blue-800">Product Categories</div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">🏆 Best vs Worst Performers (by Uphold Rate)</h3>
                <p className="text-sm text-gray-600 mb-4">Lower uphold rates indicate better firm performance</p>
                <div className="relative h-80">
                  <canvas id="performersChart"></canvas>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">📊 Product Category Distribution</h3>
                <p className="text-sm text-gray-600 mb-4">Complaints by product category</p>
                <div className="relative h-80">
                  <canvas id="categoryDistributionChart"></canvas>
                </div>
              </div>
            </div>

            {/* Consumer Credit Section */}
            <div className="grid grid-cols-1 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">💳 Consumer Credit Volume by Firm</h3>
                <div className="relative h-80">
                  <canvas id="volumeChart"></canvas>
                </div>
              </div>
            </div>

            {/* Industry Comparison */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">
                🎯 Industry Performance Comparison (Resolution Speed vs Uphold Rate)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Best performers appear in the bottom-right (fast resolution, low uphold rate). Bubble size represents complaint volume.
              </p>
              <div className="relative h-96">
                <canvas id="industryComparisonChart"></canvas>
              </div>
            </div>
          </div>
        );

      case 'credit':
        const uniqueFirms = Array.from(new Set(dashboardData.consumerCredit.map(item => item.firm_name).filter(Boolean))).length;
        const totalComplaints = dashboardData.consumerCredit.reduce((sum, item) => sum + (item.complaints_received || 0), 0);
        const avgUpheld = dashboardData.consumerCredit.length > 0 ? 
          dashboardData.consumerCredit.reduce((sum, item) => sum + (item.complaints_upheld_pct || 0), 0) / dashboardData.consumerCredit.length : 0;

        return (
          <div>
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg mb-8">
              <h3 className="text-xl font-semibold mb-4">💳 Consumer Credit Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold text-purple-600">{uniqueFirms}</div>
                  <div className="text-sm text-purple-800">Total Firms</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-600">
                    {Math.round(totalComplaints / 1000)}K
                  </div>
                  <div className="text-sm text-purple-800">Total Complaints</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-600">
                    {avgUpheld.toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-800">Avg Uphold Rate</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">⚠️ Highest Uphold Rates</h3>
              <p className="text-sm text-gray-600 mb-4">Firms with highest percentage of complaints upheld (needs improvement)</p>
              <div className="relative h-80">
                <canvas id="upheldChart"></canvas>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">{activeTab} Analysis</h3>
            <p className="text-gray-600">This section is under development.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Load Chart.js */}
      <Script 
        src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"
        onLoad={() => setChartJsLoaded(true)}
      />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Complaints Tracking Dashboard</h1>
          <p className="text-gray-600">Comprehensive analysis of complaint resolution performance across financial firms</p>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>🔄 Live Data:</strong> Connected to Neon database with real firm names, product categories, and complaint metrics from your lookup tables.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex overflow-x-auto">
            {[
              { id: 'overview', label: 'Performance Overview' },
              { id: 'firm', label: 'Firm Deep Dive' },
              { id: 'product', label: 'Product Analysis' },
              { id: 'credit', label: 'Consumer Credit Focus' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Footer */}
        <div className="bg-gray-100 p-6 rounded-lg mt-8">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <span className="mr-2">ℹ️</span> About This Dashboard
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            <em>This dashboard displays live data from your Neon PostgreSQL database with real firm names, product categories, and reporting periods. The data includes complaint resolution performance metrics across different firms and product categories, sourced from regulatory reporting requirements.</em>
          </p>
        </div>
      </div>
    </div>
  );
}
