'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFilters } from '../hooks/useFilters';
import { useDashboardData } from '../hooks/useDashboardData';
import type { 
  DashboardAPIResponse, 
  HistoricalTrendData, 
  IndustryTrendData 
} from '../types/dashboard';
// ✅ NEW: Import dynamic scaling utilities
import { 
  applyDynamicScaling, 
  extractChartValues, 
  shouldApplyDynamicScaling 
} from '../utils/chartHelpers';
// ✅ NEW: Import trend analysis utilities
import { 
  processFirmTrends,
  calculateIndustryTrends,
  formatTrendDisplay
} from '../utils/trendAnalysis';
// ✅ NEW: Import multi-firm comparison component
import MultiFirmComparison from '../components/MultiFirmComparison';

// Define Chart.js types
type ChartInstance = any;

interface ChartInstances {
  [key: string]: ChartInstance;
}

// ✅ UPDATED: Interface using imported types from dashboard.ts
interface DashboardData {
  kpis: {
    total_complaints: number;
    total_closed: number;
    avg_uphold_rate: number;
    total_firms?: number;
    
    // ✅ NEW: Replace banking_avg_percentage with avg_percentage_upheld
    avg_percentage_upheld?: number;
    
    // ✅ NEW: 8-weeks KPI
    avg_closed_within_8_weeks?: number;
    
    sector_uphold_averages?: {[key: string]: number};
    sector_closure_averages?: {[key: string]: number};
    
    // ✅ NEW: All sector averages for Product Analysis
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
  
  // ✅ NEW: Use imported types instead of inline definitions
  historicalTrends?: HistoricalTrendData[];
  industryTrends?: IndustryTrendData[];
}

interface CreditFilters {
  selectedFirms: string[];
}

export default function Dashboard() {
  // ✅ Use the filter and data hooks
  const { filters, updateFilter, clearAllFilters, hasActiveFilters } = useFilters();
  const { data: apiData, loading, error, fetchData } = useDashboardData();

  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFirms, setSelectedFirms] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState(''); // ✅ FIXED: Initialize as empty string
  const [creditFilters, setCreditFilters] = useState<CreditFilters>({
    selectedFirms: []
  });
  const [firmSearchTerm, setFirmSearchTerm] = useState('');
  const [showFirmDropdown, setShowFirmDropdown] = useState(false);
  
  // ✅ NEW: Multi-firm comparison state
  const [showMultiFirmComparison, setShowMultiFirmComparison] = useState(false);
  const [processedTrends, setProcessedTrends] = useState<any>(null);
  
  const [charts, setCharts] = useState<ChartInstances>({});

  // ✅ UPDATED: Transform API data with new field mapping
  const data: DashboardData | null = apiData ? {
    kpis: {
      total_complaints: apiData.data?.kpis?.total_complaints || 0,
      total_closed: apiData.data?.kpis?.total_complaints || 0,
      avg_uphold_rate: apiData.data?.kpis?.avg_upheld_rate || 0,
      total_firms: apiData.data?.kpis?.total_firms || 0,
      
      // ✅ NEW: Use new average percentage upheld field (with type assertion as fallback)
      avg_percentage_upheld: (apiData.data?.kpis as any)?.avg_percentage_upheld || 0,
      
      // ✅ NEW: 8-weeks KPI (with type assertion as fallback)
      avg_closed_within_8_weeks: (apiData.data?.kpis as any)?.avg_closed_within_8_weeks || 0,
      
      sector_uphold_averages: apiData.data?.kpis?.sector_uphold_averages || {},
      sector_closure_averages: apiData.data?.kpis?.sector_closure_averages || {},
      
      // ✅ NEW: All sector averages for Product Analysis (with type assertion as fallback)
      all_sector_averages: (apiData.data?.kpis as any)?.all_sector_averages || {}
    },
    topPerformers: (apiData.data?.topPerformers || []).map((item: any) => ({
      firm_name: item.firm_name,
      avg_uphold_rate: item.avg_uphold_rate || item.avg_upheld_rate || 0,
      avg_closure_rate: Math.min(item.avg_closure_rate || 0, 95), // ✅ Cap at 95% to prevent chart overflow
      complaint_count: item.complaint_count || 0
    })),
    // ✅ FIXED: Consumer Credit data mapping - now uses actual volumes from correct table
    consumerCredit: (apiData.data?.consumerCredit || []).map((item: any) => ({
      firm_name: item.firm_name,
      total_received: item.total_received || 0, // ✅ Now contains actual complaint volumes!
      avg_upheld_pct: item.avg_upheld_pct || item.avg_uphold_rate || 0,
      avg_closure_rate: Math.min(item.avg_closure_rate || 0, 95)
    })),
    categoryData: (apiData.data.productCategories || []).map((item: any) => ({
      category_name: item.category_name || item.product_category,
      complaint_count: item.complaint_count || 0,
      avg_uphold_rate: item.avg_uphold_rate || item.avg_upheld_rate || 0,
      avg_closure_rate: Math.min(item.avg_closure_rate || 0, 95)
    })),
    industryComparison: (apiData.data.industryComparison || []).map((item: any) => ({
      firm_name: item.firm_name,
      avg_uphold_rate: item.avg_uphold_rate || item.avg_upheld_rate || 0,
      avg_closure_rate: Math.min(item.avg_closure_rate || 0, 95),
      complaint_count: item.complaint_count || 0
    })),
    allFirms: (apiData.data?.allFirms || [])
  .filter(firm => firm?.firm_name && typeof firm.firm_name === 'string' && firm.firm_name.trim().length > 0)
  .sort((a: any, b: any) => 
    (a.firm_name || '').localeCompare(b.firm_name || '')
  ),
    
    // ✅ NEW: Historical trend data
    historicalTrends: apiData.data.historicalTrends || [],
    industryTrends: apiData.data.industryTrends || []
  } : null;

  // ✅ NEW: Process trend data when API data changes
