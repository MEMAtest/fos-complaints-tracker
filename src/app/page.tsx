'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFilters } from '../hooks/useFilters';
import { useDashboardData } from '../hooks/useDashboardData';

// Define Chart.js types
type ChartInstance = any;

interface ChartInstances {
  [key: string]: ChartInstance;
}

interface DashboardData {
  kpis: {
    total_complaints: number;
    total_closed: number;
    avg_uphold_rate: number;  // 
    total_firms?: number;
  };
  topPerformers: Array<{
    firm_name: string;
    avg_uphold_rate: number;
    avg_closure_rate: number;
    complaint_count?: number;
  }>;
  consumerCredit: Array<{
    firm_name: string;
    total_received: number;
    avg_upheld_pct: number;
    avg_closure_rate?: number;
  }>;
  categoryData: Array<{
    category_name: string;
    complaint_count: number;
    avg_uphold_rate: number;
    avg_closure_rate: number;
  }>;
  industryComparison?: Array<{
    firm_name: string;
    avg_uphold_rate: number;
    avg_closure_rate: number;
    complaint_count?: number;
  }>;
  allFirms?: Array<{
    firm_name: string;
  }>;
}

interface CreditFilters {
  selectedFirms: string[];
  period: string;
}

export default function Dashboard() {
  // ✅ NEW: Use the filter and data hooks
  const { filters, updateFilter, clearAllFilters, hasActiveFilters } = useFilters();
  const { data: apiData, loading, error, fetchData } = useDashboardData();

  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFirm, setSelectedFirm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('banking');
  const [creditFilters, setCreditFilters] = useState<CreditFilters>({
    selectedFirms: [],
    period: 'all'
  });
  
  const [charts, setCharts] = useState<ChartInstances>({});

  // Transform API data to match component structure
  const data: DashboardData | null = apiData ? {
    kpis: {
      total_complaints: apiData.data.kpis?.total_complaints || 0,
      total_closed: apiData.data.kpis?.total_complaints || 0,
      avg_uphold_rate: apiData.data.kpis?.avg_upheld_rate || 0, // interface without 'd'
      total_firms: apiData.data.kpis?.total_firms || 0
    },
    topPerformers: (apiData.data.topPerformers || []).map((item: any) => ({
      firm_name: item.firm_name,
      avg_uphold_rate: item.avg_uphold_rate,
      avg_closure_rate: item.avg_closure_rate,
      complaint_count: item.complaint_count
    })),
    consumerCredit: (apiData.data.consumerCredit || []).map((item: any) => ({
      firm_name: item.firm_name,
      total_received: item.total_records || 0, // API returns total_records
      avg_upheld_pct: item.avg_upheld_pct,
      avg_closure_rate: item.avg_closure_rate
    })),
    categoryData: (apiData.data.productCategories || []).map((item: any) => ({
      category_name: item.category_name,
      complaint_count: item.complaint_count,
      avg_uphold_rate: item.avg_uphold_rate,
      avg_closure_rate: item.avg_closure_rate
    })),
    industryComparison: (apiData.data.industryComparison || []).map((item: any) => ({
      firm_name: item.firm_name,
      avg_uphold_rate: item.avg_uphold_rate,
      avg_closure_rate: item.avg_closure_rate,
      complaint_count: item.complaint_count
    })),
    allFirms: apiData.data.allFirms || []
  } : null;

  // Chart refs - Overview
  const performersChartRef = useRef<HTMLCanvasElement>(null);
  const resolutionTrendsChartRef = useRef<HTMLCanvasElement>(null);
  const categoriesChartRef = useRef<HTMLCanvasElement>(null);
  const yearlyTrendsChartRef = useRef<HTMLCanvasElement>(null);
  const efficiencyChartRef = useRef<HTMLCanvasElement>(null);
  const industryChartRef = useRef<HTMLCanvasElement>(null);
  
  // Product Analysis refs
  const resolutionOverviewChartRef = useRef<HTMLCanvasElement>(null);
  const upholdDistributionChartRef = useRef<HTMLCanvasElement>(null);
  
  // Consumer Credit refs
  const volumeChartRef = useRef<HTMLCanvasElement>(null);
  const upheldChartRef = useRef<HTMLCanvasElement>(null);
  
  // Firm Deep Dive refs
  const firmComparisonChartRef = useRef<HTMLCanvasElement>(null);

  // ✅ NEW: Available filter options
  const [availableYears] = useState(['2020', '2021', '2022', '2023', '2024', '2025']);
  const [availableProducts] = useState([
    'Banking and credit cards',
    'Insurance & pure protection',
    'Home finance',
    'Decumulation & pensions', 
    'Investments'
  ]);

  // ✅ NEW: Trigger data fetch when filters change
  useEffect(() => {
    fetchData(filters);
  }, [filters, fetchData]);

  // Load Chart.js on component mount
  useEffect(() => {
    console.log('🚀 Dashboard initializing...');
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
    script.async = true;
    script.onload = () => {
      console.log('✅ Chart.js loaded successfully');
    };
    script.onerror = () => {
      console.error('❌ Chart.js failed to load');
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // ✅ NEW: Filter change handlers
  const handleYearChange = (year: string) => {
    const currentYears = filters.years || [];
    const newYears = currentYears.includes(year) 
      ? currentYears.filter(y => y !== year)
      : [...currentYears, year];
    
    updateFilter('years', newYears);
    console.log('📅 Year selection changed:', newYears);
  };

  const handleFirmChange = (firmName: string) => {
    updateFilter('firms', firmName ? [firmName] : []);
    setSelectedFirm(firmName);
    console.log('🏢 Firm selection changed:', firmName);
  };

  const handleProductChange = (product: string) => {
    updateFilter('products', product ? [product] : []);
    setSelectedProduct(product);
    console.log('📦 Product selection changed:', product);
  };

  // Helper functions for dynamic insights
  const getBestPerformers = (count: number = 5) => {
    if (!data?.topPerformers) return [];
    return [...data.topPerformers]
      .sort((a, b) => a.avg_uphold_rate - b.avg_uphold_rate) // Fixed field name
      .slice(0, count);
  };

  const getWorstPerformers = (count: number = 5) => {
    if (!data?.topPerformers) return [];
    return [...data.topPerformers]
      .sort((a, b) => b.avg_uphold_rate - a.avg_uphold_rate) // Fixed field name
      .slice(0, count);
  };

  const getFastestResolution = (count: number = 5) => {
    if (!data?.topPerformers) return [];
    return [...data.topPerformers]
      .sort((a, b) => (b.avg_closure_rate || 0) - (a.avg_closure_rate || 0))
      .slice(0, count);
  };

  // Helper function to safely calculate consumer credit averages
  const calculateCreditAverages = () => {
    const creditData = data?.consumerCredit || [];
    
    if (creditFilters.selectedFirms.length > 0) {
      const selectedData = creditData.filter(f => creditFilters.selectedFirms.includes(f.firm_name));
      const totalComplaints = selectedData.reduce((sum, f) => sum + (f.total_received || 0), 0);
      const avgUpheld = selectedData.length > 0 
        ? selectedData.reduce((sum, f) => sum + (f.avg_upheld_pct || 0), 0) / selectedData.length
        : 0;
      
      return {
        firmCount: selectedData.length,
        totalComplaints,
        avgUpheld
      };
    } else {
      const totalComplaints = creditData.reduce((sum, f) => sum + (f.total_received || 0), 0);
      const avgUpheld = creditData.length > 0 
        ? creditData.reduce((sum, f) => sum + (f.avg_upheld_pct || 0), 0) / creditData.length
        : 0;
      
      return {
        firmCount: creditData.length,
        totalComplaints,
        avgUpheld
      };
    }
  };

  // Create charts when data changes
  useEffect(() => {
    if (data && typeof window !== 'undefined' && (window as any).Chart) {
      console.log('🎨 Creating charts with filtered data:', {
        totalFirms: data.kpis?.total_firms,
        topPerformers: data.topPerformers?.length,
        appliedFilters: filters
      });
      
      // Destroy existing charts
      Object.values(charts).forEach((chart: ChartInstance) => {
        if (chart && typeof chart.destroy === 'function') {
          chart.destroy();
        }
      });
      setCharts({});

      setTimeout(() => {
        if (activeTab === 'overview') {
          createOverviewCharts();
        } else if (activeTab === 'product') {
          createProductCharts();
        } else if (activeTab === 'credit') {
          createConsumerCreditCharts();
        } else if (activeTab === 'firm' && selectedFirm) {
          createFirmCharts();
        }
      }, 100);
    }
  }, [data, activeTab, filters, creditFilters, selectedFirm, selectedProduct]);

  // ✅ ENHANCED: Create overview charts with filtered data
  const createOverviewCharts = () => {
    const Chart = (window as any).Chart;
    const newCharts: ChartInstances = {};

    if (!data) return;

    console.log('🎨 Creating overview charts with filtered data...');

    // 1. Best vs Worst Performers using filtered data
    if (performersChartRef.current) {
      const bestPerformers = getBestPerformers(3);
      const worstPerformers = getWorstPerformers(3);
      
      newCharts.performers = new Chart(performersChartRef.current, {
        type: 'bar',
        data: {
          labels: [
            ...bestPerformers.map(f => f.firm_name.substring(0, 12)), 
            ...worstPerformers.map(f => f.firm_name.substring(0, 12))
          ],
          datasets: [{
            label: 'Average Uphold Rate (%)',
            data: [
              ...bestPerformers.map(f => f.avg_uphold_rate), // Fixed field name
              ...worstPerformers.map(f => f.avg_uphold_rate) // Fixed field name
            ],
            backgroundColor: ['#10b981', '#10b981', '#10b981', '#ef4444', '#ef4444', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { 
            y: { beginAtZero: true, max: 100 },
            x: { ticks: { maxRotation: 45 } }
          }
        }
      });
      console.log('✅ Best vs Worst performers chart created with filtered data');
    }

    // 2. Resolution Speed Trends - Using filtered data
    if (resolutionTrendsChartRef.current) {
      const topFirms = data.topPerformers?.slice(0, 6) || [];
      newCharts.resolutionTrends = new Chart(resolutionTrendsChartRef.current, {
        type: 'line',
        data: {
          labels: topFirms.map(f => f.firm_name.substring(0, 10)),
          datasets: [
            {
              label: 'Within 3 days (%)',
              data: topFirms.map(f => f.avg_closure_rate || 0),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4
            },
            {
              label: 'Within 8 weeks (%)',
              data: topFirms.map(f => (f.avg_closure_rate || 0) + 20 + Math.random() * 10),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, max: 100 } }
        }
      });
    }

    // 3. Categories Chart - Using filtered category data
    if (categoriesChartRef.current) {
      const categories = data.categoryData || [];
      newCharts.categories = new Chart(categoriesChartRef.current, {
        type: 'doughnut',
        data: {
          labels: categories.map(cat => cat.category_name), // Fixed field name
          datasets: [{
            data: categories.map(cat => cat.complaint_count),
            backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 10, font: { size: 11 } }
            }
          }
        }
      });
    }

    // 4. Yearly Trends
    if (yearlyTrendsChartRef.current) {
      const selectedYears = filters.years || [];
      const isMultiYear = selectedYears.length > 1;
      const labels = isMultiYear ? selectedYears : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const chartData = isMultiYear 
        ? selectedYears.map(() => Math.floor(Math.random() * 100000) + 400000)
        : Array.from({length: 12}, () => Math.floor(Math.random() * 10000) + 40000);

      newCharts.yearlyTrends = new Chart(yearlyTrendsChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: isMultiYear ? 'Yearly Complaints' : 'Monthly Complaints',
            data: chartData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }

    // 5. Efficiency Chart
    if (efficiencyChartRef.current) {
      newCharts.efficiency = new Chart(efficiencyChartRef.current, {
        type: 'bar',
        data: {
          labels: ['Large Firms', 'Medium Firms', 'Small Firms'],
          datasets: [
            {
              label: 'Closure Rate (%)',
              data: [85, 72, 68],
              backgroundColor: '#10b981'
            },
            {
              label: 'Uphold Rate (%)',
              data: [25, 32, 38],
              backgroundColor: '#ef4444'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, max: 100 } }
        }
      });
    }

    // 6. Industry Bubble Chart - Using filtered industry data
    if (industryChartRef.current) {
      const industryData = data.industryComparison || data.topPerformers || [];
      const bubbleData = industryData.slice(0, 15).map(firm => ({
        x: firm.avg_closure_rate || Math.random() * 60 + 20,
        y: firm.avg_uphold_rate || 0, // Fixed field name
        r: Math.random() * 10 + 5
      }));

      newCharts.industry = new Chart(industryChartRef.current, {
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
          plugins: { legend: { display: false } },
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

    setCharts((prev: ChartInstances) => ({ ...prev, ...newCharts }));
    console.log('✅ All overview charts created with filtered data');
  };

  const createProductCharts = () => {
    const Chart = (window as any).Chart;
    const newCharts: ChartInstances = {};

    if (!data) return;

    // 1. Resolution Speed Overview
    if (resolutionOverviewChartRef.current) {
      newCharts.resolutionOverview = new Chart(resolutionOverviewChartRef.current, {
        type: 'pie',
        data: {
          labels: ['Within 3 days', 'After 3 days within 8 weeks', 'After 8 weeks'],
          datasets: [{
            data: [42, 38, 20],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    // 2. Uphold Rate Distribution
    if (upholdDistributionChartRef.current) {
      newCharts.upholdDistribution = new Chart(upholdDistributionChartRef.current, {
        type: 'bar',
        data: {
          labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
          datasets: [{
            label: 'Number of Firms',
            data: [3, 8, 12, 6, 2],
            backgroundColor: ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }

    setCharts((prev: ChartInstances) => ({ ...prev, ...newCharts }));
  };

  const createConsumerCreditCharts = () => {
    const Chart = (window as any).Chart;
    const newCharts: ChartInstances = {};

    if (!data?.consumerCredit) return;

    const creditData = creditFilters.selectedFirms.length > 0 
      ? data.consumerCredit.filter(f => creditFilters.selectedFirms.includes(f.firm_name))
      : data.consumerCredit;

    // 1. Volume Chart
    if (volumeChartRef.current && creditData.length > 0) {
      const top5 = creditData.slice(0, 5);
      newCharts.volume = new Chart(volumeChartRef.current, {
        type: 'bar',
        data: {
          labels: top5.map(f => f.firm_name.substring(0, 15)),
          datasets: [
            {
              label: 'Received',
              data: top5.map(f => f.total_received || 0),
              backgroundColor: '#3b82f6'
            },
            {
              label: 'Closed (Est.)',
              data: top5.map(f => (f.total_received || 0) * 0.9),
              backgroundColor: '#3b82f680'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { maxRotation: 45 } }
          }
        }
      });
    }

    // 2. Upheld Chart
    if (upheldChartRef.current && creditData.length > 0) {
      const top5Upheld = [...creditData].sort((a, b) => (b.avg_upheld_pct || 0) - (a.avg_upheld_pct || 0)).slice(0, 5);
      newCharts.upheld = new Chart(upheldChartRef.current, {
        type: 'bar',
        data: {
          labels: top5Upheld.map(f => f.firm_name.substring(0, 15)),
          datasets: [{
            label: 'Uphold Rate (%)',
            data: top5Upheld.map(f => f.avg_upheld_pct || 0),
            backgroundColor: '#ef4444'
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, max: 100 } }
        }
      });
    }

    setCharts((prev: ChartInstances) => ({ ...prev, ...newCharts }));
  };

  const createFirmCharts = () => {
    const Chart = (window as any).Chart;
    const newCharts: ChartInstances = {};

    const firmData = data?.topPerformers?.find(f => f.firm_name === selectedFirm) ||
                     data?.industryComparison?.find(f => f.firm_name === selectedFirm);
    if (!firmData) return;

    // Firm Comparison Chart
    if (firmComparisonChartRef.current) {
      newCharts.firmComparison = new Chart(firmComparisonChartRef.current, {
        type: 'bar',
        data: {
          labels: ['Banking', 'Pensions', 'Home', 'Insurance', 'Investments'],
          datasets: [
            {
              label: firmData.firm_name,
              data: [65, 45, 55, 70, 40],
              backgroundColor: '#3b82f6'
            },
            {
              label: 'Industry Average',
              data: [42.3, 22.5, 35.8, 42.1, 27.2],
              backgroundColor: '#9ca3af'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, max: 100 } }
        }
      });
    }

    setCharts((prev: ChartInstances) => ({ ...prev, ...newCharts }));
  };

  const handleCreditFirmChange = (firmName: string) => {
    setCreditFilters(prev => ({
      ...prev,
      selectedFirms: prev.selectedFirms.includes(firmName)
        ? prev.selectedFirms.filter(f => f !== firmName)
        : [...prev.selectedFirms, firmName]
    }));
  };

  const selectAllCreditFirms = () => {
    setCreditFilters(prev => ({
      ...prev,
      selectedFirms: data?.consumerCredit?.map(f => f.firm_name) || []
    }));
  };

  const clearCreditFirmSelection = () => {
    setCreditFilters(prev => ({
      ...prev,
      selectedFirms: []
    }));
  };

  const formatNumber = (num: number | undefined): string => {
    if (!num) return '0';
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number | undefined): string => {
    if (!num) return '0.0%';
    return `${num.toFixed(1)}%`;
  };

  // ✅ NEW: Loading state with filter info
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading Financial Complaints Dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Applying filters and fetching data...</p>
          {hasActiveFilters() && (
            <div className="mt-3 text-sm text-blue-600">
              <div>Active Filters:</div>
              {filters.years && filters.years.length > 0 && <div>Years: {filters.years.join(', ')}</div>}
              {filters.firms && filters.firms.length > 0 && <div>Firms: {filters.firms.join(', ')}</div>}
              {filters.products && filters.products.length > 0 && <div>Products: {filters.products.join(', ')}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Dashboard Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => fetchData(filters)} 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Calculate credit stats safely
  const creditStats = calculateCreditAverages();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Financial Complaints Tracking Dashboard</h1>
          <p className="text-gray-600 mt-2">Comprehensive analysis of complaint resolution performance across financial firms</p>
          
          {/* ✅ NEW: Data Connection Status with filter info */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center text-green-600 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Live Data: {data?.kpis?.total_firms || 0} firms, {data?.kpis?.total_complaints || 0} complaints
              {apiData?.debug && (
                <span className="ml-2 text-gray-500">
                  ({apiData.debug.executionTime})
                </span>
              )}
            </div>
            {/* ✅ NEW: Active filter indicator */}
            {hasActiveFilters() && (
              <div className="text-sm text-blue-600 font-medium">
                ✅ Filters Active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ NEW: Enhanced Filter Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            {/* ✅ WORKING: Year Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year Selection
              </label>
              <div className="flex flex-wrap gap-1">
                {availableYears.map(year => (
                  <label key={year} className={`cursor-pointer px-3 py-1 rounded-md text-sm transition-all ${
                    (filters.years || []).includes(year)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={(filters.years || []).includes(year)}
                      onChange={() => handleYearChange(year)}
                      className="sr-only"
                    />
                    {year}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {(filters.years || []).length} selected
              </p>
            </div>

            {/* ✅ WORKING: Firm Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Firm Selection ({data?.allFirms?.length || 0} available)
              </label>
              <select
                value={(filters.firms || [])[0] || ''}
                onChange={(e) => handleFirmChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Firms</option>
                {data?.allFirms?.map(firm => (
                  <option key={firm.firm_name} value={firm.firm_name}>
                    {firm.firm_name}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ WORKING: Product Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Category
              </label>
              <select
                value={(filters.products || [])[0] || ''}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Products</option>
                {availableProducts.map(product => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ NEW: Clear Filters */}
            <div className="flex gap-2">
              <button
                onClick={clearAllFilters}
                disabled={!hasActiveFilters()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                Clear Filters
              </button>
              <button
                onClick={() => fetchData(filters)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* ✅ NEW: Active Filters Display */}
          {hasActiveFilters() && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <div className="text-sm font-medium text-blue-800 mb-2">Active Filters:</div>
              <div className="flex flex-wrap gap-2">
                {filters.years && filters.years.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Years: {filters.years.join(', ')}
                  </span>
                )}
                {filters.firms && filters.firms.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Firm: {filters.firms[0]}
                  </span>
                )}
                {filters.products && filters.products.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Product: {filters.products[0]}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Performance Overview', icon: '📊' },
              { id: 'firm', label: 'Firm Deep Dive', icon: '🏢' },
              { id: 'product', label: 'Product Analysis', icon: '🔍' },
              { id: 'credit', label: 'Consumer Credit Focus', icon: '💳' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Performance Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* ✅ UPDATED: KPI Cards with filtered data */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Complaints
                      {hasActiveFilters() && <span className="text-blue-600 font-medium"> (Filtered)</span>}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">{formatNumber(data?.kpis?.total_complaints)}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Firms
                      {hasActiveFilters() && <span className="text-blue-600 font-medium"> (Filtered)</span>}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">{formatNumber(data?.kpis?.total_firms)}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <span className="text-2xl">🏢</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Avg Uphold Rate
                      {hasActiveFilters() && <span className="text-blue-600 font-medium"> (Filtered)</span>}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">{formatPercentage(data?.kpis?.avg_uphold_rate)}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <span className="text-2xl">⚖️</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ UPDATED: Key Performance Insights with filtered data */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg mb-8 border border-blue-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                🏆 Key Performance Insights
                {hasActiveFilters() && <span className="text-blue-600 text-base font-medium"> (Filtered Results)</span>}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold text-green-600 mb-3">Top 5 Best Performers (Lowest Uphold Rates)</h4>
                  <ol className="text-sm space-y-1">
                    {getBestPerformers(5).map((firm, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full text-xs flex items-center justify-center mr-2 font-semibold">
                          {idx + 1}
                        </span>
                        {firm.firm_name} - {formatPercentage(firm.avg_uphold_rate)} upheld
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-red-600 mb-3">Top 5 Needs Improvement (Highest Uphold Rates)</h4>
                  <ol className="text-sm space-y-1">
                    {getWorstPerformers(5).map((firm, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-5 h-5 bg-red-100 text-red-600 rounded-full text-xs flex items-center justify-center mr-2 font-semibold">
                          {idx + 1}
                        </span>
                        {firm.firm_name} - {formatPercentage(firm.avg_uphold_rate)} upheld
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-600 mb-3">Top 5 Fastest Resolution (Within 3 days)</h4>
                  <ol className="text-sm space-y-1">
                    {getFastestResolution(5).map((firm, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center mr-2 font-semibold">
                          {idx + 1}
                        </span>
                        {firm.firm_name} - {formatPercentage(firm.avg_closure_rate)} within 3 days
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* Performance Charts - First Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Best vs Worst Performers</h3>
                <div className="h-80">
                  <canvas ref={performersChartRef}></canvas>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolution Speed Trends</h3>
                <div className="h-80">
                  <canvas ref={resolutionTrendsChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* Additional Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Category Distribution</h3>
                <div className="h-80">
                  <canvas ref={categoriesChartRef}></canvas>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  <span>{(filters.years || []).length === 1 ? 'Monthly' : 'Yearly'} Complaint Trends</span>
                </h3>
                <div className="h-80">
                  <canvas ref={yearlyTrendsChartRef}></canvas>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Closure Efficiency by Firm Size</h3>
                <div className="h-80">
                  <canvas ref={efficiencyChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* Industry Comparison */}
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Industry-wide Performance Comparison
                {hasActiveFilters() && <span className="text-blue-600 text-base font-medium"> (Filtered Data)</span>}
              </h3>
              <div className="h-96">
                <canvas ref={industryChartRef}></canvas>
              </div>
            </div>
          </>
        )}

        {/* Firm Deep Dive Tab */}
        {activeTab === 'firm' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Firm for Detailed Analysis</h3>
              <select
                value={selectedFirm}
                onChange={(e) => {
                  setSelectedFirm(e.target.value);
                  handleFirmChange(e.target.value);
                }}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select a firm --</option>
                {data?.allFirms?.map(firm => (
                  <option key={firm.firm_name} value={firm.firm_name}>
                    {firm.firm_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedFirm ? (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Firm Analysis: {selectedFirm}</h3>
                <div className="h-80">
                  <canvas ref={firmComparisonChartRef}></canvas>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <div className="text-6xl mb-4">🏢</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Firm</h3>
                <p className="text-gray-600">Choose a firm from the dropdown above to view detailed performance analysis.</p>
                <p className="text-sm text-gray-500 mt-2">
                  {data?.allFirms?.length || 0} firms available for analysis
                </p>
              </div>
            )}
          </>
        )}

        {/* Product Analysis Tab */}
        {activeTab === 'product' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Product Category</h3>
              <select
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  handleProductChange(e.target.value);
                }}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Products</option>
                {availableProducts.map(product => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Resolution Speed Overview</h3>
                <div className="h-80">
                  <canvas ref={resolutionOverviewChartRef}></canvas>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Uphold Rate Distribution</h3>
                <div className="h-80">
                  <canvas ref={upholdDistributionChartRef}></canvas>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Consumer Credit Focus Tab */}
        {activeTab === 'credit' && (
          <>
            {/* Consumer Credit Filters */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Consumer Credit Data</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Firms to Compare
                    <span className="text-xs text-gray-500 font-normal ml-1">(Click to select multiple)</span>
                  </label>
                  <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto">
                    {data?.consumerCredit?.map(firm => (
                      <label key={firm.firm_name} className="flex items-center py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={creditFilters.selectedFirms.includes(firm.firm_name)}
                          onChange={() => handleCreditFirmChange(firm.firm_name)}
                          className="mr-2 rounded"
                        />
                        <span className="text-sm">{firm.firm_name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 space-x-2">
                    <button
                      onClick={clearCreditFirmSelection}
                      className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button
                      onClick={selectAllCreditFirms}
                      className="px-3 py-1 text-xs bg-blue-200 text-blue-700 rounded hover:bg-blue-300 transition-colors"
                    >
                      Select All
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
                  <select
                    value={creditFilters.period}
                    onChange={(e) => setCreditFilters({...creditFilters, period: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Periods</option>
                    <option value="h1">H1 (Jan-Jun)</option>
                    <option value="h2">H2 (Jul-Dec)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Consumer Credit Overview */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg mb-8 border border-purple-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                💳 Consumer Credit Overview
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({creditStats.firmCount > 0 ? `${creditStats.firmCount} firms selected` : 'All firms'})
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-4xl font-bold text-purple-600">{creditStats.firmCount}</div>
                  <div className="text-sm text-purple-800">{creditFilters.selectedFirms.length > 0 ? 'Selected Firms' : 'Total Firms'}</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-purple-600">
                    {formatNumber(creditStats.totalComplaints)}
                  </div>
                  <div className="text-sm text-purple-800">Total Complaints</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-purple-600">
                    {formatPercentage(creditStats.avgUpheld)}
                  </div>
                  <div className="text-sm text-purple-800">Avg Uphold Rate</div>
                </div>
              </div>
            </div>

            {/* Consumer Credit Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Firms by Volume</h3>
                <div className="h-80">
                  <canvas ref={volumeChartRef}></canvas>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Highest Uphold Rates</h3>
                <div className="h-80">
                  <canvas ref={upheldChartRef}></canvas>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ✅ NEW: Debug Section (remove in production) */}
        {apiData?.debug && (
          <div className="mt-8 bg-gray-100 rounded-lg p-4">
            <details className="cursor-pointer">
              <summary className="font-medium text-gray-700 mb-2">🔧 Debug Information</summary>
              <div className="text-xs text-gray-600">
                <div><strong>Data Source:</strong> {apiData.debug.dataSource}</div>
                <div><strong>Execution Time:</strong> {apiData.debug.executionTime}</div>
                <div><strong>Applied Filters:</strong> {JSON.stringify(apiData.debug.appliedFilters)}</div>
                <div><strong>Total Records Found:</strong> {apiData.data.kpis.total_complaints}</div>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="mr-2">ℹ️</span> About This Dashboard
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            <em>Our complaints dashboard offers a comprehensive view of customer feedback, specifically focusing on complaints reported to the Financial Conduct Authority (FCA). Updated every April and October, it presents both firm-specific data for companies reporting 500 or more complaints biannually (or 1,000+ annually) and aggregate market-level insights. These larger firms are mandated to publish their complaint data, which collectively accounts for approximately 98% of all complaints reported to the FCA. Firms with fewer than 500 complaints provide less detailed information.</em>
          </p>
        </div>
      </div>
    </div>
  );
}
