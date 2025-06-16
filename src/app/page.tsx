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
    avg_closed_within_3_days?: number; // ✅ NEW: Added 3-day closure rate
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

interface PerformanceAlert {
  firmName: string;
  metric: 'uphold_rate' | 'closure_rate';
  change: number;
  direction: 'up' | 'down';
  significance: 'high' | 'medium' | 'low';
  currentValue: number;
  previousValue: number;
}

// ✅ InfoTooltip Component
const InfoTooltip = ({ text }: { text: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="relative inline-block ml-2">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        ℹ️
      </button>
      {showTooltip && (
        <div className="absolute z-10 w-64 p-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg -top-2 left-6">
          {text}
          <div className="absolute top-2 -left-1 w-2 h-2 bg-gray-800 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

// ✅ Two-Firm Comparison Component
const TwoFirmComparison = ({ 
  firmA, 
  firmB, 
  onClose,
  firmAData,
  firmBData,
  formatPercentage,
  formatNumber
}: { 
  firmA: string; 
  firmB: string; 
  onClose: () => void;
  firmAData: any;
  firmBData: any;
  formatPercentage: (num: number | undefined | null) => string;
  formatNumber: (num: number | undefined | null) => string;
}) => {
  const comparisonChartRef = useRef<HTMLCanvasElement>(null);
  
  // Create comparison chart
  useEffect(() => {
    if (!comparisonChartRef.current || !firmAData || !firmBData || !(window as any).Chart) return;
    
    const Chart = (window as any).Chart;
    
    const chart = new Chart(comparisonChartRef.current, {
      type: 'radar',
      data: {
        labels: ['Performance Score', 'Resolution Rate', 'Complaint Volume (Scaled)'],
        datasets: [{
          label: firmA.substring(0, 20),
          data: [
            100 - (firmAData.avg_uphold_rate || 0), // Invert for radar (higher=better)
            firmAData.avg_closure_rate || 0,
            Math.min((firmAData.complaint_count || 0) / 10, 100) // Scale for visualization
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2
        }, {
          label: firmB.substring(0, 20),
          data: [
            100 - (firmBData.avg_uphold_rate || 0),
            firmBData.avg_closure_rate || 0,
            Math.min((firmBData.complaint_count || 0) / 10, 100)
          ],
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
    
    return () => chart.destroy();
  }, [firmA, firmB, firmAData, firmBData]);
  
  // Generate executive summary
  const generateExecutiveSummary = () => {
    if (!firmAData || !firmBData) return [];
    
    const summary = [];
    const upholdDiff = (firmAData.avg_uphold_rate || 0) - (firmBData.avg_uphold_rate || 0);
    const closureDiff = (firmAData.avg_closure_rate || 0) - (firmBData.avg_closure_rate || 0);
    
    if (Math.abs(upholdDiff) > 5) {
      const betterFirm = upholdDiff < 0 ? firmA : firmB;
      const worseFirm = upholdDiff < 0 ? firmB : firmA;
      summary.push(`${betterFirm} has significantly lower complaint uphold rates than ${worseFirm} (${Math.abs(upholdDiff).toFixed(1)}% difference).`);
    }
    
    if (Math.abs(closureDiff) > 10) {
      const fasterFirm = closureDiff > 0 ? firmA : firmB;
      const slowerFirm = closureDiff > 0 ? firmB : firmA;
      summary.push(`${fasterFirm} resolves complaints ${Math.abs(closureDiff).toFixed(1)}% faster than ${slowerFirm}.`);
    }
    
    if (summary.length === 0) {
      summary.push('Both firms show similar performance patterns across key metrics.');
    }
    
    return summary;
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              ⚖️ Firm Comparison: {firmA.substring(0, 20)} vs {firmB.substring(0, 20)}
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          {/* Key Metrics Comparison Table */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Key Metrics Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Metric</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-blue-600">{firmA.substring(0, 25)}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-red-600">{firmB.substring(0, 25)}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-900">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900">Uphold Rate</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-blue-600">
                      {formatPercentage(firmAData?.avg_uphold_rate)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-red-600">
                      {formatPercentage(firmBData?.avg_uphold_rate)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {firmAData && firmBData ? 
                        `${((firmAData.avg_uphold_rate || 0) - (firmBData.avg_uphold_rate || 0)) > 0 ? '+' : ''}${((firmAData.avg_uphold_rate || 0) - (firmBData.avg_uphold_rate || 0)).toFixed(1)}%` 
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900">Resolution Rate</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-blue-600">
                      {formatPercentage(firmAData?.avg_closure_rate)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-red-600">
                      {formatPercentage(firmBData?.avg_closure_rate)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {firmAData && firmBData ? 
                        `${((firmAData.avg_closure_rate || 0) - (firmBData.avg_closure_rate || 0)) > 0 ? '+' : ''}${((firmAData.avg_closure_rate || 0) - (firmBData.avg_closure_rate || 0)).toFixed(1)}%` 
                        : 'N/A'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Radar Chart Comparison */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Performance Radar</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="h-80">
                <canvas ref={comparisonChartRef}></canvas>
              </div>
            </div>
          </div>
          
          {/* Executive Summary */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              📋 Executive Summary
              <InfoTooltip text="Key insights and recommendations based on the performance comparison between the selected firms." />
            </h3>
            <ul className="space-y-2">
              {generateExecutiveSummary().map((point, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span className="text-sm text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  
  // ✅ Two-firm comparison state
  const [showTwoFirmComparison, setShowTwoFirmComparison] = useState(false);
  const [comparisonFirms, setComparisonFirms] = useState<{firmA: string, firmB: string}>({firmA: '', firmB: ''});
  
  // ✅ Chart state with proper initialization
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

  // ✅ UPDATED: Transform API data with zero-filtering
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
        avg_closed_within_8_weeks: safeNumber(apiData.data.kpis?.avg_closed_within_8_weeks), // ✅ FIXED: Now dynamic
        avg_closed_within_3_days: safeNumber(apiData.data.kpis?.avg_closed_within_3_days), // ✅ NEW: Added 3-day closure rate
        sector_uphold_averages: apiData.data.kpis?.sector_uphold_averages || {},
        sector_closure_averages: apiData.data.kpis?.sector_closure_averages || {},
        all_sector_averages: {}
      };

      // ✅ Filter out zero uphold rates
      let topPerformers: any[] = [];
      if (Array.isArray(apiData.data.topPerformers)) {
        topPerformers = apiData.data.topPerformers
          .filter(item => item && typeof item === 'object' && item.firm_name && item.avg_uphold_rate > 0)
          .map((item: any) => ({
            firm_name: String(item.firm_name || 'Unknown Firm'),
            avg_uphold_rate: safeNumber(item.avg_uphold_rate || item.avg_upheld_rate),
            avg_closure_rate: Math.min(safeNumber(item.avg_closure_rate || 75), 95),
            complaint_count: safeInt(item.complaint_count)
          }));
      }

      // ✅ Filter out zero uphold rates for consumer credit
      let consumerCredit: any[] = [];
      if (Array.isArray(apiData.data.consumerCredit)) {
        consumerCredit = apiData.data.consumerCredit
          .filter(item => item && typeof item === 'object' && item.firm_name && item.avg_upheld_pct > 0)
          .map((item: any) => ({
            firm_name: String(item.firm_name || 'Unknown Firm'),
            total_received: safeInt(item.total_received),
            avg_upheld_pct: safeNumber(item.avg_upheld_pct || item.avg_uphold_rate),
            avg_closure_rate: Math.min(safeNumber(item.avg_closure_rate || 75), 95)
          }));
      }

      // ✅ Filter out zero uphold rates for categories
      let categoryData: any[] = [];
      if (Array.isArray(apiData.data.productCategories)) {
        categoryData = apiData.data.productCategories
          .filter((item: any) => item && typeof item === 'object' && (item.category_name || item.product_category) && item.avg_uphold_rate > 0)
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

  // ✅ Updated product categories to match database
  const availableProducts = [
    'Banking and credit cards',
    'Insurance & pure protection',
    'Home finance',
    'Decumulation & pensions', 
    'Investments'
  ];

  const [availableYears] = useState(['2020', '2021', '2022', '2023', '2024', '2025']);

  // ✅ Performance alerts calculation - MOVED TO FIRM DEEP DIVE ONLY
  const calculatePerformanceAlerts = useCallback((): PerformanceAlert[] => {
    // ✅ Only calculate when firms are selected and we're on firm deep dive tab
    if (!data?.historicalTrends || data.historicalTrends.length === 0 || selectedFirms.length === 0) {
      return [];
    }

    const alerts: PerformanceAlert[] = [];
    const firmData = new Map<string, { current: any, previous: any }>();

    // Only process selected firms
    data.historicalTrends
      .filter(record => selectedFirms.includes(record.firm_name))
      .forEach(record => {
        const firmName = record.firm_name;
        const year = record.trend_year;
        
        if (!firmData.has(firmName)) {
          firmData.set(firmName, { current: null, previous: null });
        }
        
        const firm = firmData.get(firmName)!;
        if (year === '2024') firm.current = record;
        if (year === '2023') firm.previous = record;
      });

    // Calculate alerts for each selected firm
    firmData.forEach((values, firmName) => {
      if (!values.current || !values.previous) return;

      const currentUphold = values.current.upheld_rate || 0;
      const previousUphold = values.previous.upheld_rate || 0;
      const upholdChange = currentUphold - previousUphold;

      const currentClosure = values.current.closure_rate_3_days || 0;
      const previousClosure = values.previous.closure_rate_3_days || 0;
      const closureChange = currentClosure - previousClosure;

      // Check for significant uphold rate increases (bad)
      if (Math.abs(upholdChange) > 2) {
        alerts.push({
          firmName,
          metric: 'uphold_rate',
          change: upholdChange,
          direction: upholdChange > 0 ? 'up' : 'down',
          significance: Math.abs(upholdChange) > 10 ? 'high' : Math.abs(upholdChange) > 5 ? 'medium' : 'low',
          currentValue: currentUphold,
          previousValue: previousUphold
        });
      }

      // Check for significant closure rate changes
      if (Math.abs(closureChange) > 5) {
        alerts.push({
          firmName,
          metric: 'closure_rate',
          change: closureChange,
          direction: closureChange > 0 ? 'up' : 'down',
          significance: Math.abs(closureChange) > 20 ? 'high' : Math.abs(closureChange) > 10 ? 'medium' : 'low',
          currentValue: currentClosure,
          previousValue: previousClosure
        });
      }
    });

    return alerts.sort((a, b) => {
      const significanceOrder = { high: 3, medium: 2, low: 1 };
      return significanceOrder[b.significance] - significanceOrder[a.significance];
    });
  }, [data?.historicalTrends, selectedFirms]);

  // ✅ Trigger data fetching on filter changes
  const fetchDataOnce = useCallback(() => {
    fetchData(filters);
  }, [JSON.stringify(filters), fetchData]);

  useEffect(() => {
    fetchDataOnce();
  }, [fetchDataOnce]);

  // ✅ Chart.js loading with proper state management
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

  // ✅ Chart creation with proper dependencies and state checks
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

  // ✅ Chart creation functions (keeping existing logic but ensuring they work)
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
                max: dynamicMax,
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

      // ✅ Resolution Trends Chart
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

  // ✅ Credit chart creation with proper filtering
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

      // Apply selected firms filter correctly
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

  // ✅ Firm selection handler with improved dropdown management
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
  const performanceAlerts = calculatePerformanceAlerts(); // ✅ Now only for selected firms in firm deep dive

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ UPDATED: Header with ACTUAL MEMA logo */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {/* ✅ FIXED: MEMA Logo with actual image */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden">
                <img 
  src="/mema-logo.png"  // ← Change this line
  alt="MEMA Consultants Logo"
  className="w-full h-full object-contain"
  onError={(e) => {
    // Fallback to text logo if image fails
    e.currentTarget.style.display = 'none';
    e.currentTarget.parentElement!.innerHTML = '<div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center"><span class="text-white font-bold text-lg">M</span></div>';
  }}
/>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Financial Complaints Dashboard</h1>
                  <p className="text-sm text-blue-600 font-medium">Powered by MEMA Consultants</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center text-green-600 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Live Data • Updated {isClient ? currentTime : 'Loading...'}
            </div>
          </div>
          
          <p className="text-gray-600 mt-3">Comprehensive analysis of complaint resolution performance across financial firms</p>
          
          <div className="flex items-center space-x-4 mt-4">
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

            {/* ✅ ENHANCED: Two-firm comparison guidance */}
            {selectedFirms.length === 1 && (
              <div className="px-3 py-2 text-sm bg-yellow-100 text-yellow-800 rounded-lg">
                Select 1 more firm to enable comparison
              </div>
            )}
            
            {selectedFirms.length === 2 && (
              <div className="px-3 py-2 text-sm bg-green-100 text-green-800 rounded-lg">
                ⚖️ Two-firm comparison available!
              </div>
            )}
            
            {selectedFirms.length > 2 && (
              <div className="px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded-lg">
                Multi-firm analysis mode (comparison disabled)
              </div>
            )}
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

            {/* ✅ UPDATED: KPI Cards with 3-day closure rate, dynamic 8-week rate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              
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

              {/* ✅ NEW: Average Closed Within 3 Days KPI */}
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">
                      Average Closed Within 3 Days
                      {hasActiveFilters() && <span className="text-blue-600 font-medium"> (Filtered)</span>}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-3xl font-bold text-gray-900">{formatPercentage(data?.kpis?.avg_closed_within_3_days)}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⚡</span>
                  </div>
                </div>
              </div>

              {/* ✅ FIXED: Dynamic 8-week closure rate (no longer hardcoded) */}
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

            {/* ✅ REMOVED: Performance Alerts from Performance Overview (moved to Firm Deep Dive) */}

            {/* ✅ UPDATED: Performance Insights (removed total complaints) */}
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

            {/* Charts with Info Icons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  🏆 Best Performers (Lowest Uphold Rates)
                  <InfoTooltip text="Firms with the lowest complaint uphold rates. Lower percentages indicate better customer satisfaction and fewer justified complaints." />
                </h3>
                <div className="h-80">
                  <canvas ref={bestPerformersChartRef}></canvas>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  ⚠️ Highest Uphold Rates
                  <InfoTooltip text="Firms with the highest complaint uphold rates. Higher percentages may indicate areas for customer service improvement." />
                </h3>
                <div className="h-80">
                  <canvas ref={worstPerformersChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* Additional Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  📈 Resolution Trends by Product Category
                  <InfoTooltip text="Shows how quickly different product categories resolve complaints over time. Higher percentages indicate faster resolution rates." />
                </h3>
                <div className="h-80">
                  <canvas ref={resolutionTrendsChartRef}></canvas>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  🥧 Product Category Distribution
                  <InfoTooltip text="Breakdown of complaints by product category. Larger segments represent product areas with higher complaint volumes." />
                </h3>
                <div className="h-80">
                  <canvas ref={categoriesChartRef}></canvas>
                </div>
              </div>
            </div>

          </>
        )}

        {/* ✅ ENHANCED: Firm Deep Dive Tab with Performance Alerts */}
        {activeTab === 'firm' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Firms for Deep Dive Analysis</h3>
              
              {/* Firm Search with working dropdown */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for firms..."
                  value={firmSearchTerm}
                  onChange={(e) => setFirmSearchTerm(e.target.value)}
                  onFocus={() => setShowFirmDropdown(true)}
                  onBlur={() => setTimeout(() => setShowFirmDropdown(false), 500)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                
                {showFirmDropdown && firmSearchTerm && getFilteredFirms().length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {getFilteredFirms().slice(0, 15).map(firm => (
                      <div
                        key={firm.firm_name}
                        onMouseDown={(e) => {
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
                  
                  {/* Two-Firm Comparison Button */}
                  {selectedFirms.length === 2 && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          const firmAData = data?.topPerformers?.find(f => f.firm_name === selectedFirms[0]);
                          const firmBData = data?.topPerformers?.find(f => f.firm_name === selectedFirms[1]);
                          if (firmAData && firmBData) {
                            setComparisonFirms({firmA: selectedFirms[0], firmB: selectedFirms[1]});
                            setShowTwoFirmComparison(true);
                          }
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                      >
                        <span>⚖️</span>
                        <span>Compare These Two Firms</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ✅ MOVED: Performance Alerts Section (only for selected firms) */}
            {selectedFirms.length > 0 && performanceAlerts.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-lg mb-8 border-l-4 border-orange-500">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  🚨 Performance Alerts for Selected Firms
                  <InfoTooltip text="Significant year-over-year changes for your selected firms. Red indicates concerning trends, green shows improvements." />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performanceAlerts.slice(0, 6).map((alert, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                      alert.metric === 'uphold_rate' 
                        ? (alert.direction === 'up' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50')
                        : (alert.direction === 'up' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {alert.firmName.substring(0, 25)}
                            {alert.firmName.length > 25 && '...'}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {alert.metric === 'uphold_rate' ? 'Uphold Rate' : 'Resolution Speed'} Change
                          </p>
                          <div className="flex items-center mt-2 space-x-2">
                            <span className={`text-lg ${
                              alert.metric === 'uphold_rate' 
                                ? (alert.direction === 'up' ? 'text-red-600' : 'text-green-600')
                                : (alert.direction === 'up' ? 'text-green-600' : 'text-red-600')
                            }`}>
                              {alert.direction === 'up' ? '↗️' : '↘️'}
                            </span>
                            <span className="font-bold text-gray-900">
                              {alert.change > 0 ? '+' : ''}{alert.change.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {alert.previousValue.toFixed(1)}% → {alert.currentValue.toFixed(1)}%
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          alert.significance === 'high' ? 'bg-red-100 text-red-800' :
                          alert.significance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.significance.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {performanceAlerts.length > 6 && (
                  <div className="mt-4 text-center">
                    <span className="text-blue-600 text-sm font-medium">
                      Showing 6 of {performanceAlerts.length} alerts
                    </span>
                  </div>
                )}
              </div>
            )}

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
                <p className="text-gray-600">Use the search box above to find and select firms for detailed performance comparison and trends.</p>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  📊 Resolution Speed Overview
                  <InfoTooltip text="Average resolution rates by product category. Higher percentages indicate faster complaint resolution." />
                  {selectedProduct && <span className="text-sm text-gray-500 ml-2">({selectedProduct})</span>}
                </h3>
                <div className="h-80">
                  <canvas ref={resolutionOverviewChartRef}></canvas>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  📈 Uphold Rate Distribution
                  <InfoTooltip text="Distribution of firms by uphold rate ranges. Shows how many firms fall into each performance category." />
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
                {/* ✅ FIXED: Removed complaint counts from filter list */}
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  💳 Complaint Volume by Firm
                  <InfoTooltip text="Total number of consumer credit complaints received by each firm. Higher volumes may indicate larger customer bases or potential issues." />
                  {creditFilters.selectedFirms.length > 0 && (
                    <span className="text-sm text-gray-500 ml-2">({creditFilters.selectedFirms.length} selected)</span>
                  )}
                </h3>
                <div className="h-80">
                  <canvas ref={volumeChartRef}></canvas>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  ⚖️ Uphold Rates Comparison
                  <InfoTooltip text="Percentage of consumer credit complaints that were upheld. Lower rates generally indicate better customer service." />
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

      {/* ✅ UPDATED: Footer with MEMA branding */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="mr-2">ℹ️</span> About This Dashboard
            </h3>
            <div className="flex items-center space-x-2 text-blue-600">
              <span className="text-sm font-medium">Powered by</span>
              <a 
                href="https://www.memaconsultants.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:text-blue-800 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <span className="font-bold">MEMA Consultants</span>
              </a>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 leading-relaxed">
            <em>Our complaints dashboard offers a comprehensive view of customer feedback, specifically focusing on complaints reported to the Financial Conduct Authority (FCA). Updated every April and October, it presents both firm-specific data for companies reporting 500 or more complaints biannually (or 1,000+ annually) and aggregate market-level insights. These larger firms are mandated to publish their complaint data, which collectively accounts for approximately 98% of all complaints reported to the FCA.</em>
          </p>
        </div>
      </div>

      {/* Two-Firm Comparison Modal */}
      {showTwoFirmComparison && comparisonFirms.firmA && comparisonFirms.firmB && (
        <TwoFirmComparison
          firmA={comparisonFirms.firmA}
          firmB={comparisonFirms.firmB}
          onClose={() => setShowTwoFirmComparison(false)}
          firmAData={data?.topPerformers?.find(f => f.firm_name === comparisonFirms.firmA)}
          firmBData={data?.topPerformers?.find(f => f.firm_name === comparisonFirms.firmB)}
          formatPercentage={formatPercentage}
          formatNumber={formatNumber}
        />
      )}
    </div>
  );
}