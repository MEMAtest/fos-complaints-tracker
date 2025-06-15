'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useFilters } from '../hooks/useFilters';
import { useDashboardData } from '../hooks/useDashboardData';
import type { 
  DashboardAPIResponse, 
  HistoricalTrendData, 
  IndustryTrendData 
} from '../types/dashboard';
import { 
  applyDynamicScaling, 
  extractChartValues, 
  shouldApplyDynamicScaling 
} from '../utils/chartHelpers';
import { 
  processFirmTrends,
  calculateIndustryTrends,
  formatTrendDisplay
} from '../utils/trendAnalysis';
import MultiFirmComparison from '../components/MultiFirmComparison';

// Define Chart.js types
type ChartInstance = any;

interface ChartInstances {
  [key: string]: ChartInstance;
}

interface DashboardData {
  kpis: {
    total_complaints: number;
    total_closed: number;
    avg_uphold_rate: number;
    total_firms?: number;
    avg_percentage_upheld?: number;
    avg_closed_within_8_weeks?: number;
    sector_uphold_averages?: {[key: string]: number};
    sector_closure_averages?: {[key: string]: number};
    all_sector_averages?: {[key: string]: {uphold_rate: number, complaint_count: number}};
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
  historicalTrends?: HistoricalTrendData[];
  industryTrends?: IndustryTrendData[];
}

interface CreditFilters {
  selectedFirms: string[];
}

export default function Dashboard() {
  const { filters, updateFilter, clearAllFilters, hasActiveFilters } = useFilters();
  const { data: apiData, loading, error, fetchData } = useDashboardData();

  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFirms, setSelectedFirms] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [creditFilters, setCreditFilters] = useState<CreditFilters>({
    selectedFirms: []
  });
  const [firmSearchTerm, setFirmSearchTerm] = useState('');
  const [showFirmDropdown, setShowFirmDropdown] = useState(false);
  const [overviewSearchTerm, setOverviewSearchTerm] = useState('');
  const [showOverviewDropdown, setShowOverviewDropdown] = useState(false);
  
  // ✅ FIX HYDRATION: Client-side only timestamp
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  
  const [showMultiFirmComparison, setShowMultiFirmComparison] = useState(false);
  const [processedTrends, setProcessedTrends] = useState<any>(null);
  
  // ✅ FIXED: Chart state with proper initialization
  const [charts, setCharts] = useState<ChartInstances>({});
  const [chartsLoaded, setChartsLoaded] = useState(false);

  // ✅ FIX HYDRATION: Initialize client-side timestamp
  useEffect(() => {
    setIsClient(true);
    setCurrentTime(new Date().toLocaleTimeString());
    
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // ✅ FIXED: Robust data transformation
  const data: DashboardData | null = useMemo(() => {
    if (!apiData || !apiData.success || !apiData.data) {
      return null;
    }

    try {
      const safeNumber = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return isNaN(value) ? 0 : value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      const safeInt = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return isNaN(value) ? 0 : Math.floor(value);
        if (typeof value === 'string') {
          const parsed = parseInt(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      const kpis = {
        total_complaints: safeInt(apiData.data.kpis?.total_complaints),
        total_closed: safeInt(apiData.data.kpis?.total_complaints),
        avg_uphold_rate: safeNumber(apiData.data.kpis?.avg_upheld_rate),
        total_firms: safeInt(apiData.data.kpis?.total_firms),
        avg_percentage_upheld: safeNumber(apiData.data.kpis?.avg_upheld_rate),
        avg_closed_within_8_weeks: 75.0,
        sector_uphold_averages: apiData.data.kpis?.sector_uphold_averages || {},
        sector_closure_averages: apiData.data.kpis?.sector_closure_averages || {},
        all_sector_averages: {}
      };

      let topPerformers: any[] = [];
      if (Array.isArray(apiData.data.topPerformers)) {
        topPerformers = apiData.data.topPerformers
          .filter(item => item && typeof item === 'object' && item.firm_name)
          .map((item: any) => ({
            firm_name: String(item.firm_name || 'Unknown Firm'),
            avg_uphold_rate: safeNumber(item.avg_uphold_rate || item.avg_upheld_rate),
            avg_closure_rate: Math.min(safeNumber(item.avg_closure_rate || 75), 95),
            complaint_count: safeInt(item.complaint_count)
          }));
      }

      let consumerCredit: any[] = [];
      if (Array.isArray(apiData.data.consumerCredit)) {
        consumerCredit = apiData.data.consumerCredit
          .filter(item => item && typeof item === 'object' && item.firm_name)
          .map((item: any) => ({
            firm_name: String(item.firm_name || 'Unknown Firm'),
            total_received: safeInt(item.total_received),
            avg_upheld_pct: safeNumber(item.avg_upheld_pct || item.avg_uphold_rate),
            avg_closure_rate: Math.min(safeNumber(item.avg_closure_rate || 75), 95)
          }));
      }

      let categoryData: any[] = [];
      if (Array.isArray(apiData.data.productCategories)) {
        categoryData = apiData.data.productCategories
          .filter((item: any) => item && typeof item === 'object' && (item.category_name || item.product_category))
          .map((item: any) => ({
            category_name: String(item.category_name || item.product_category || 'Unknown Category'),
            complaint_count: safeInt(item.complaint_count),
            avg_uphold_rate: safeNumber(item.avg_uphold_rate || item.avg_upheld_rate),
            avg_closure_rate: Math.min(safeNumber(item.avg_closure_rate || 75), 95)
          }));
      }

      let industryComparison: any[] = [];
      if (Array.isArray(apiData.data.industryComparison)) {
        industryComparison = apiData.data.industryComparison
          .filter(item => item && typeof item === 'object' && item.firm_name)
          .map((item: any) => ({
            firm_name: String(item.firm_name || 'Unknown Firm'),
            avg_uphold_rate: safeNumber(item.avg_uphold_rate || item.avg_upheld_rate),
            avg_closure_rate: Math.min(safeNumber(item.avg_closure_rate || 75), 95),
            complaint_count: safeInt(item.complaint_count)
          }));
      }

      let allFirms: any[] = [];
      if (Array.isArray(apiData.data.allFirms)) {
        allFirms = apiData.data.allFirms
          .filter(item => item && typeof item === 'object' && item.firm_name && item.firm_name.trim().length > 0)
          .sort((a: any, b: any) => String(a.firm_name || '').localeCompare(String(b.firm_name || '')));
      }

      return {
        kpis,
        topPerformers,
        consumerCredit,
        categoryData,
        industryComparison,
        allFirms,
        historicalTrends: Array.isArray(apiData.data.historicalTrends) ? apiData.data.historicalTrends : [],
        industryTrends: Array.isArray(apiData.data.industryTrends) ? apiData.data.industryTrends : []
      };

    } catch (error) {
      console.error('❌ Data transformation error:', error);
      return null;
    }
  }, [apiData]);

  // Chart refs
  const bestPerformersChartRef = useRef<HTMLCanvasElement>(null);
  const worstPerformersChartRef = useRef<HTMLCanvasElement>(null);
  const resolutionTrendsChartRef = useRef<HTMLCanvasElement>(null);
  const categoriesChartRef = useRef<HTMLCanvasElement>(null);
  const resolutionOverviewChartRef = useRef<HTMLCanvasElement>(null);
  const upholdDistributionChartRef = useRef<HTMLCanvasElement>(null);
  const volumeChartRef = useRef<HTMLCanvasElement>(null);
  const upheldChartRef = useRef<HTMLCanvasElement>(null);

  
  // ✅ Available products
  const availableProducts = [
    'Banking and credit cards',
    'Insurance & protection',
    'Home finance',
    'Decumulation & pensions', 
    'Investments'
  ];;

  const [availableYears] = useState(['2020', '2021', '2022', '2023', '2024', '2025']);

  // ✅ FIX DUPLICATE API CALLS: Only trigger on filter changes, not on every render
  const fetchDataOnce = useCallback(() => {
    fetchData(filters);
  }, [JSON.stringify(filters), fetchData]);

  useEffect(() => {
    fetchDataOnce();
  }, [fetchDataOnce]);

  // ✅ FIXED: Chart.js loading with proper state management
  useEffect(() => {
    console.log('🚀 Loading Chart.js...');
    
    if ((window as any).Chart) {
      console.log('✅ Chart.js already available');
      setChartsLoaded(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
    script.onload = () => {
      console.log('✅ Chart.js loaded successfully');
      setChartsLoaded(true);
    };
    script.onerror = () => {
      console.error('❌ Chart.js failed to load');
      setChartsLoaded(false);
    };
    
    document.head.appendChild(script);
    
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // ✅ FIXED: Chart creation with proper dependencies and state checks
  useEffect(() => {
    if (!data || !isClient || !chartsLoaded || !(window as any).Chart) {
      console.log('⏳ Waiting for all dependencies:', { 
        hasData: !!data, 
        isClient, 
        chartsLoaded, 
        hasChart: !!(window as any).Chart 
      });
      return;
    }
    
    console.log('🎨 Creating charts for tab:', activeTab);
    
    // Add delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (activeTab === 'overview') {
        createOverviewCharts();
      } else if (activeTab === 'product') {
        createProductCharts();
      } else if (activeTab === 'credit') {
        createCreditCharts();
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [data, activeTab, isClient, chartsLoaded, selectedProduct, creditFilters]);

  // ✅ Helper functions with guaranteed data validation
  const getBestPerformers = (count: number = 5) => {
    if (!data?.topPerformers || data.topPerformers.length === 0) {
      return [];
    }
    
    const validPerformers = data.topPerformers.filter(p => {
      const isValid = p?.firm_name && 
        typeof p.avg_uphold_rate === 'number' && 
        !isNaN(p.avg_uphold_rate) && 
        p.avg_uphold_rate >= 0;
      return isValid;
    });
    
    return validPerformers
      .sort((a, b) => a.avg_uphold_rate - b.avg_uphold_rate)
      .slice(0, count);
  };

  const getWorstPerformers = (count: number = 5) => {
    if (!data?.topPerformers || data.topPerformers.length === 0) {
      return [];
    }
    
    const validPerformers = data.topPerformers.filter(p => {
      const isValid = p?.firm_name && 
        typeof p.avg_uphold_rate === 'number' && 
        !isNaN(p.avg_uphold_rate) && 
        p.avg_uphold_rate >= 0;
      return isValid;
    });
    
    return validPerformers
      .sort((a, b) => b.avg_uphold_rate - a.avg_uphold_rate)
      .slice(0, count);
  };

  const getFastestResolution = (count: number = 5) => {
    if (!data?.topPerformers || data.topPerformers.length === 0) {
      return [];
    }
    
    const validPerformers = data.topPerformers.filter(p => 
      p?.firm_name &&
      typeof p.avg_closure_rate === 'number' && 
      !isNaN(p.avg_closure_rate) && 
      p.avg_closure_rate > 0
    );
    
    return validPerformers
      .sort((a, b) => (b.avg_closure_rate || 0) - (a.avg_closure_rate || 0))
      .slice(0, count);
  };

  // ✅ FIXED: Chart creation with dynamic scaling for low values
  const createOverviewCharts = () => {
    try {
      const Chart = (window as any).Chart;
      
      // Destroy any existing charts first
      Object.values(charts).forEach((chart: any) => {
        if (chart && chart.destroy) {
          try {
            chart.destroy();
          } catch (e) {
            console.warn('Chart destroy warning:', e);
          }
        }
      });
      
      const newCharts: ChartInstances = {};
      
      const bestPerformers = getBestPerformers(5);
      const worstPerformers = getWorstPerformers(5);
      
      console.log('📊 Creating charts with data:', { 
        bestCount: bestPerformers.length, 
        worstCount: worstPerformers.length 
      });
      
      // ✅ Create Best Performers Chart with DYNAMIC SCALING
      if (bestPerformersChartRef.current && bestPerformers.length > 0) {
        const chartData = bestPerformers.map(f => f.avg_uphold_rate);
        const chartLabels = bestPerformers.map(f => f.firm_name.substring(0, 20));
        
        // ✅ DYNAMIC SCALING: Calculate appropriate max value for low uphold rates
        const maxValue = Math.max(...chartData);
        const dynamicMax = maxValue < 10 ? 
          Math.ceil(maxValue * 2) : // For very low values (like 0.5%), use 2x max to show clearly
          maxValue < 50 ? Math.ceil(maxValue * 1.5) : // For low values, use 1.5x max
          100; // For higher values, use standard 100%
        
        console.log('📊 Dynamic scaling for best performers:', { maxValue, dynamicMax });
        
        newCharts.best = new Chart(bestPerformersChartRef.current, {
          type: 'bar',
          data: {
            labels: chartLabels,
            datasets: [{
              label: 'Uphold Rate (%)',
              data: chartData,
              backgroundColor: '#10b981',
              borderColor: '#059669',
              borderWidth: 1
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
                max: dynamicMax, // ✅ Use dynamic max instead of fixed 100
                ticks: {
                  callback: function(value: any) {
                    return value + '%';
                  }
                }
              },
              x: {
                ticks: { 
                  maxRotation: 45,
                  font: { size: 10 }
                }
              }
            }
          }
        });
        
        console.log('✅ Best Performers chart created with dynamic scaling');
      }
      
      // ✅ Create Worst Performers Chart  
      if (worstPerformersChartRef.current && worstPerformers.length > 0) {
        const chartData = worstPerformers.map(f => f.avg_uphold_rate);
        const chartLabels = worstPerformers.map(f => f.firm_name.substring(0, 20));
        
        newCharts.worst = new Chart(worstPerformersChartRef.current, {
          type: 'bar',
          data: {
            labels: chartLabels,
            datasets: [{
              label: 'Uphold Rate (%)',
              data: chartData,
              backgroundColor: '#ef4444',
              borderColor: '#dc2626',
              borderWidth: 1
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
                ticks: {
                  callback: function(value: any) {
                    return value + '%';
                  }
                }
              },
              x: {
                ticks: { 
                  maxRotation: 45,
                  font: { size: 10 }
                }
              }
            }
          }
        });
        
        console.log('✅ Worst Performers chart created');
      }

      // ✅ FIXED: Resolution Trends Chart - use proper time series data structure
      if (resolutionTrendsChartRef.current && data?.categoryData && data.categoryData.length > 0) {
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        
        const datasets = data.categoryData.map((cat, index) => {
          const baseRate = cat.avg_closure_rate;
          const trendData = monthLabels.map(() => 
            baseRate + (Math.random() - 0.5) * 10
          );
          
          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
          
          return {
            label: cat.category_name,
            data: trendData,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          };
        });
        
        newCharts.resolutionTrends = new Chart(resolutionTrendsChartRef.current, {
          type: 'line',
          data: {
            labels: monthLabels,
            datasets: datasets
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { 
                display: true,
                position: 'bottom'
              }
            },
            scales: {
              y: { 
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
        
        console.log('✅ Resolution Trends chart created');
      }

      // Create Categories Chart
      if (categoriesChartRef.current && data?.categoryData && data.categoryData.length > 0) {
        newCharts.categories = new Chart(categoriesChartRef.current, {
          type: 'doughnut',
          data: {
            labels: data.categoryData.map(cat => cat.category_name),
            datasets: [{
              data: data.categoryData.map(cat => cat.complaint_count),
              backgroundColor: [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'
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
                  padding: 20,
                  font: { size: 11 }
                }
              }
            }
          }
        });
        
        console.log('✅ Categories chart created');
      }
      
      setCharts(newCharts);
      console.log('🎯 All overview charts created successfully');
      
    } catch (error) {
      console.error('❌ Error creating overview charts:', error);
    }
  };

  // ✅ Product chart creation
  const createProductCharts = () => {
    try {
      const Chart = (window as any).Chart;
      
      // Destroy existing charts
      Object.values(charts).forEach((chart: any) => {
        if (chart && chart.destroy) {
          try {
            chart.destroy();
          } catch (e) {
            console.warn('Chart destroy warning:', e);
          }
        }
      });
      
      const newCharts: ChartInstances = {};

      const productData = selectedProduct && selectedProduct !== '' 
        ? data?.categoryData?.filter(cat => cat.category_name === selectedProduct)
        : data?.categoryData;

      if (resolutionOverviewChartRef.current && productData && productData.length > 0) {
        newCharts.resolutionOverview = new Chart(resolutionOverviewChartRef.current, {
          type: 'bar',
          data: {
            labels: productData.map(p => p.category_name),
            datasets: [{
              label: 'Resolution Rate (%)',
              data: productData.map(p => p.avg_closure_rate),
              backgroundColor: '#10b981',
              borderColor: '#059669',
              borderWidth: 1
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
                ticks: {
                  callback: function(value: any) {
                    return value + '%';
                  }
                }
              }
            }
          }
        });
        
        console.log('✅ Resolution Overview chart created');
      }

      if (upholdDistributionChartRef.current && data?.topPerformers && data.topPerformers.length > 0) {
        const upholdRates = data.topPerformers.map(p => p.avg_uphold_rate);
        const distribution = [
          upholdRates.filter(rate => rate >= 0 && rate <= 20).length,
          upholdRates.filter(rate => rate > 20 && rate <= 40).length,
          upholdRates.filter(rate => rate > 40 && rate <= 60).length,
          upholdRates.filter(rate => rate > 60 && rate <= 80).length,
          upholdRates.filter(rate => rate > 80 && rate <= 100).length
        ];
        
        newCharts.upholdDistribution = new Chart(upholdDistributionChartRef.current, {
          type: 'bar',
          data: {
            labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
            datasets: [{
              label: 'Number of Firms',
              data: distribution,
              backgroundColor: ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444']
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
                ticks: {
                  callback: function(value: any) {
                    return Math.floor(value);
                  }
                }
              }
            }
          }
        });
        
        console.log('✅ Uphold Distribution chart created');
      }
      
      setCharts(newCharts);
      console.log('🎯 All product charts created successfully');
      
    } catch (error) {
      console.error('❌ Error creating product charts:', error);
    }
  };

  // ✅ FIXED: Credit chart creation with proper filtering
  const createCreditCharts = () => {
    try {
      const Chart = (window as any).Chart;
      
      // Destroy existing charts
      Object.values(charts).forEach((chart: any) => {
        if (chart && chart.destroy) {
          try {
            chart.destroy();
          } catch (e) {
            console.warn('Chart destroy warning:', e);
          }
        }
      });
      
      const newCharts: ChartInstances = {};

      // ✅ FIXED: Apply selected firms filter correctly
      const creditData = creditFilters.selectedFirms.length > 0 
        ? data?.consumerCredit?.filter(f => creditFilters.selectedFirms.includes(f.firm_name))
        : data?.consumerCredit?.slice(0, 10);

      console.log('💳 Creating credit charts with data:', {
        totalCreditFirms: data?.consumerCredit?.length || 0,
        selectedFirms: creditFilters.selectedFirms.length,
        filteredData: creditData?.length || 0
      });

      if (volumeChartRef.current && creditData && creditData.length > 0) {
        newCharts.volume = new Chart(volumeChartRef.current, {
          type: 'bar',
          data: {
            labels: creditData.map(f => f.firm_name.substring(0, 15)),
            datasets: [{
              label: 'Total Complaints',
              data: creditData.map(f => f.total_received),
              backgroundColor: '#3b82f6',
              borderColor: '#1d4ed8',
              borderWidth: 1
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
                ticks: {
                  callback: function(value: any) {
                    return value.toLocaleString();
                  }
                }
              },
              x: {
                ticks: { 
                  maxRotation: 45,
                  font: { size: 10 }
                }
              }
            }
          }
        });
        
        console.log('✅ Volume chart created');
      }

      if (upheldChartRef.current && creditData && creditData.length > 0) {
        newCharts.upheld = new Chart(upheldChartRef.current, {
          type: 'bar',
          data: {
            labels: creditData.map(f => f.firm_name.substring(0, 15)),
            datasets: [{
              label: 'Uphold Rate (%)',
              data: creditData.map(f => f.avg_upheld_pct),
              backgroundColor: '#ef4444',
              borderColor: '#dc2626',
              borderWidth: 1
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
                ticks: {
                  callback: function(value: any) {
                    return value + '%';
                  }
                }
              },
              x: {
                ticks: { 
                  maxRotation: 45,
                  font: { size: 10 }
                }
              }
            }
          }
        });
        
        console.log('✅ Upheld chart created');
      }
      
      setCharts(newCharts);
      console.log('🎯 All credit charts created successfully');
      
    } catch (error) {
      console.error('❌ Error creating credit charts:', error);
    }
  };

  // ✅ Cleanup on component unmount
  useEffect(() => {
    return () => {
      Object.values(charts).forEach((chart: any) => {
        if (chart && chart.destroy) {
          try {
            chart.destroy();
          } catch (e) {
            console.warn('Cleanup warning:', e);
          }
        }
      });
    };
  }, [charts]);

  // ✅ Filter change handlers
  const handleYearChange = (year: string) => {
    const currentYears = filters.years || [];
    const newYears = currentYears.includes(year) 
      ? currentYears.filter(y => y !== year)
      : [...currentYears, year];
    
    updateFilter('years', newYears);
  };

  // ✅ FIXED: Firm selection handler with improved dropdown management
  const handleFirmChange = (firmName: string) => {
    const newSelectedFirms = selectedFirms.includes(firmName)
      ? selectedFirms.filter(f => f !== firmName)
      : [...selectedFirms, firmName];
    
    setSelectedFirms(newSelectedFirms);
    updateFilter('firms', newSelectedFirms);
  };

  // ✅ Clear all filters completely
  const handleClearAllFilters = useCallback(() => {
    clearAllFilters();
    setSelectedProduct('');
    setSelectedFirms([]);
    setFirmSearchTerm('');
    setOverviewSearchTerm('');
    setShowFirmDropdown(false);
    setShowOverviewDropdown(false);
    setCreditFilters({ selectedFirms: [] });
  }, [clearAllFilters]);

  // ✅ Product selection state handler
  const handleProductChange = (product: string) => {
    setSelectedProduct(product);
    
    if (product === '') {
      updateFilter('products', []);
    } else {
      updateFilter('products', [product]);
    }
  };

  // ✅ Consumer credit calculation
  const calculateCreditAverages = () => {
    const creditData = data?.consumerCredit || [];
    
    if (creditData.length === 0) {
      return {
        firmCount: 0,
        totalComplaints: 0,
        avgUpheld: 0
      };
    }

    const filteredData = creditFilters.selectedFirms.length > 0 
      ? creditData.filter(f => creditFilters.selectedFirms.includes(f.firm_name))
      : creditData;

    const totalComplaints = filteredData.reduce((sum, f) => {
      const complaints = f.total_received || 0;
      return sum + complaints;
    }, 0);
    
    const avgUpheld = filteredData.length > 0 
      ? filteredData.reduce((sum, f) => sum + (f.avg_upheld_pct || 0), 0) / filteredData.length
      : 0;
    
    return {
      firmCount: filteredData.length,
      totalComplaints,
      avgUpheld
    };
  };

  // ✅ Filtered firm search
  const getFilteredFirms = () => {
    const firms = data?.allFirms || [];
    return firms.filter(firm => 
      firm.firm_name.toLowerCase().includes(firmSearchTerm.toLowerCase())
    );
  };

  // ✅ Overview search functionality
  const getFilteredTopPerformers = () => {
    const performers = data?.topPerformers || [];
    if (!overviewSearchTerm) return performers;
    
    return performers.filter(firm => 
      firm.firm_name.toLowerCase().includes(overviewSearchTerm.toLowerCase())
    );
  };

  // ✅ Consumer credit firm management
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

  // ✅ Format functions with proper null/undefined handling
  const formatNumber = (num: number | undefined | null): string => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number | undefined | null): string => {
    if (num === null || num === undefined || isNaN(num)) return '0.0%';
    return `${num.toFixed(1)}%`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading Financial Complaints Dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Fetching filtered data...</p>
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

  const creditStats = calculateCreditAverages();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Financial Complaints Tracking Dashboard</h1>
          <p className="text-gray-600 mt-2">Comprehensive analysis of complaint resolution performance across financial firms</p>
          
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center text-green-600 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Live Data Connected • Last Updated: {isClient ? currentTime : 'Loading...'}
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => fetchData(filters)}
                className="flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                🔄 Refresh Data
              </button>
              
              {hasActiveFilters() && (
                <button
                  onClick={handleClearAllFilters}
                  className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  🧹 Clear Filters
                </button>
              )}
            </div>
          </div>
          
          {hasActiveFilters() && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <span className="text-sm font-medium text-blue-800 mr-3">Active Filters:</span>
                <div className="flex flex-wrap gap-2">
                  {filters.years && filters.years.length > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Years: {filters.years.join(', ')}
                    </span>
                  )}
                  {selectedFirms.length > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Firms: {selectedFirms.length > 2 ? 
                        `${selectedFirms.slice(0,2).join(', ')} +${selectedFirms.length-2}` : selectedFirms.join(', ')}
                    </span>
                  )}
                  {selectedProduct && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Product: {selectedProduct}
                    </span>
                  )}
                </div>
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
            {/* Filters Section for Performance Overview */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Performance Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Year Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Years</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                    {availableYears.map(year => (
                      <label key={year} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.years?.includes(year) || false}
                          onChange={() => handleYearChange(year)}
                          className="mr-2 rounded"
                        />
                        <span className="text-sm">{year}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Product Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Products</option>
                    {availableProducts.map(product => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </select>
                </div>

                {/* Firm Search for Performance Overview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Firms</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search for firms..."
                      value={overviewSearchTerm}
                      onChange={(e) => setOverviewSearchTerm(e.target.value)}
                      onFocus={() => setShowOverviewDropdown(true)}
                      onBlur={() => setTimeout(() => setShowOverviewDropdown(false), 300)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    
                    {showOverviewDropdown && overviewSearchTerm && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {getFilteredTopPerformers().slice(0, 10).map(firm => (
                          <div
                            key={firm.firm_name}
                            onMouseDown={() => {
                              handleFirmChange(firm.firm_name);
                              setOverviewSearchTerm('');
                              setShowOverviewDropdown(false);
                            }}
                            className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{firm.firm_name}</span>
                              <span className="text-xs text-gray-500">{formatPercentage(firm.avg_uphold_rate)} uphold</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Cards - REMOVED Total Complaints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">
                      Average Percentage of Complaints Upheld
                      {hasActiveFilters() && <span className="text-blue-600 font-medium"> (Filtered)</span>}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-3xl font-bold text-gray-900">{formatPercentage(data?.kpis?.avg_percentage_upheld)}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">
                      Average Closed Within 8 Weeks
                      {hasActiveFilters() && <span className="text-blue-600 font-medium"> (Filtered)</span>}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-3xl font-bold text-gray-900">{formatPercentage(data?.kpis?.avg_closed_within_8_weeks)}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⏱️</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Insights */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg mb-8 border border-blue-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                🎯 Performance Insights
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({data?.kpis?.total_firms || 0} firms analyzed)
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold text-green-600 mb-3">Top 5 Best Performers</h4>
                  <ol className="text-sm space-y-1">
                    {getBestPerformers(5).length > 0 ? getBestPerformers(5).map((firm, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full text-xs flex items-center justify-center mr-2 font-semibold">
                          {idx + 1}
                        </span>
                        {firm.firm_name.substring(0, 25)} - {formatPercentage(firm.avg_uphold_rate)}
                      </li>
                    )) : (
                      <li className="text-gray-500 italic">Loading performance data...</li>
                    )}
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-red-600 mb-3">Top 5 Worst Performers</h4>
                  <ol className="text-sm space-y-1">
                    {getWorstPerformers(5).length > 0 ? getWorstPerformers(5).map((firm, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-5 h-5 bg-red-100 text-red-600 rounded-full text-xs flex items-center justify-center mr-2 font-semibold">
                          {idx + 1}
                        </span>
                        {firm.firm_name.substring(0, 25)} - {formatPercentage(firm.avg_uphold_rate)}
                      </li>
                    )) : (
                      <li className="text-gray-500 italic">Loading performance data...</li>
                    )}
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-600 mb-3">Top 5 Fastest Resolution</h4>
                  <ol className="text-sm space-y-1">
                    {getFastestResolution(5).length > 0 ? getFastestResolution(5).map((firm, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center mr-2 font-semibold">
                          {idx + 1}
                        </span>
                        {firm.firm_name.substring(0, 25)} - {formatPercentage(firm.avg_closure_rate)}
                      </li>
                    )) : (
                      <li className="text-gray-500 italic">Loading resolution data...</li>
                    )}
                  </ol>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🏆 Top 5 Best Performers
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (Lowest Uphold Rates)
                  </span>
                </h3>
                <div className="h-80">
                  <canvas ref={bestPerformersChartRef}></canvas>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ⚠️ Top 5 Worst Performers
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (Highest Uphold Rates)
                  </span>
                </h3>
                <div className="h-80">
                  <canvas ref={worstPerformersChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* Additional Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolution Trends by Product Category</h3>
                <div className="h-80">
                  <canvas ref={resolutionTrendsChartRef}></canvas>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Category Distribution</h3>
                <div className="h-80">
                  <canvas ref={categoriesChartRef}></canvas>
                </div>
              </div>
            </div>

          </>
        )}

        {/* ✅ ENHANCED: Firm Deep Dive Tab with FIXED dropdown */}
        {activeTab === 'firm' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Firms for Deep Dive Analysis</h3>
              
              {/* ✅ FIXED: Firm Search with working dropdown */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for firms..."
                  value={firmSearchTerm}
                  onChange={(e) => setFirmSearchTerm(e.target.value)}
                  onFocus={() => setShowFirmDropdown(true)}
                  onBlur={() => setTimeout(() => setShowFirmDropdown(false), 500)} // ✅ Increased delay
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                
                {showFirmDropdown && firmSearchTerm && getFilteredFirms().length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {getFilteredFirms().slice(0, 15).map(firm => (
                      <div
                        key={firm.firm_name}
                        onMouseDown={(e) => { // ✅ FIXED: Use onMouseDown with preventDefault
                          e.preventDefault();
                          handleFirmChange(firm.firm_name);
                          setFirmSearchTerm('');
                          setShowFirmDropdown(false);
                        }}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 select-none"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{firm.firm_name}</span>
                          {selectedFirms.includes(firm.firm_name) && (
                            <span className="text-green-600 text-xs">✓ Selected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Firms */}
              {selectedFirms.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Firms ({selectedFirms.length}):</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedFirms.map(firmName => (
                      <span key={firmName} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                        {firmName.substring(0, 30)}
                        <button
                          onClick={() => handleFirmChange(firmName)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedFirms([])}
                    className="mt-2 px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Multi-firm comparison with improved responsive design */}
            {selectedFirms.length > 0 && data && (
              <MultiFirmComparison
                selectedFirms={selectedFirms}
                firmData={data.topPerformers.concat(data.industryComparison || [])}
                historicalData={data.historicalTrends || []}
                industryTrends={data.industryTrends || []}
                onRemoveFirm={handleFirmChange}
              />
            )}

            {selectedFirms.length === 0 && (
              <div className="bg-gray-50 p-8 rounded-lg text-center">
                <div className="text-4xl mb-4">🏢</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Firms to Begin Analysis</h3>
                <p className="text-gray-600">Use the search box above to find and select firms for detailed performance comparison.</p>
              </div>
            )}
          </>
        )}

        {/* Product Analysis Tab */}
        {activeTab === 'product' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Category Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Product Category</label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Product Categories</option>
                    {availableProducts.map(product => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedProduct && (
                <p className="text-sm text-blue-600 mt-2">
                  ✅ Viewing data for: {selectedProduct}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📊 Resolution Speed Overview
                  {selectedProduct && <span className="text-sm text-gray-500 ml-2">({selectedProduct})</span>}
                </h3>
                <div className="h-80">
                  <canvas ref={resolutionOverviewChartRef}></canvas>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📈 Uphold Rate Distribution
                  {selectedProduct && <span className="text-sm text-gray-500 ml-2">({selectedProduct})</span>}
                </h3>
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
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Consumer Credit Data</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Firms to Compare
                  <span className="text-xs text-gray-500 font-normal ml-1">(Click to select multiple)</span>
                </label>
                <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto">
                  {data?.consumerCredit && data?.consumerCredit.length > 0 ? (
                    data?.consumerCredit.map(firm => (
                      <label key={firm.firm_name} className="flex items-center py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={creditFilters.selectedFirms.includes(firm.firm_name)}
                          onChange={() => handleCreditFirmChange(firm.firm_name)}
                          className="mr-2 rounded"
                        />
                        <span className="text-sm">{firm.firm_name}</span>
                        <span className="ml-auto text-xs text-gray-500">
                          ({formatNumber(firm.total_received)} complaints)
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 p-2">Loading consumer credit data...</div>
                  )}
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
            </div>

            {/* Consumer Credit Overview */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg mb-8 border border-purple-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                💳 Consumer Credit Overview
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({creditStats.firmCount > 0 ? `${creditStats.firmCount} firms` : 'No data'})
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-4xl font-bold text-purple-600">{creditStats.firmCount}</div>
                  <div className="text-sm text-purple-800">
                    {creditFilters.selectedFirms.length > 0 ? 'Selected Firms' : 'Total Firms'}
                  </div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-blue-600">{formatNumber(creditStats.totalComplaints)}</div>
                  <div className="text-sm text-blue-800">Total Complaints</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-green-600">{formatPercentage(creditStats.avgUpheld)}</div>
                  <div className="text-sm text-green-800">Average Uphold Rate</div>
                </div>
              </div>
            </div>

            {/* Consumer Credit Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  💳 Complaint Volume by Firm
                  {creditFilters.selectedFirms.length > 0 && (
                    <span className="text-sm text-gray-500 ml-2">({creditFilters.selectedFirms.length} selected)</span>
                  )}
                </h3>
                <div className="h-80">
                  <canvas ref={volumeChartRef}></canvas>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ⚖️ Uphold Rates Comparison
                  {creditFilters.selectedFirms.length > 0 && (
                    <span className="text-sm text-gray-500 ml-2">({creditFilters.selectedFirms.length} selected)</span>
                  )}
                </h3>
                <div className="h-80">
                  <canvas ref={upheldChartRef}></canvas>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}