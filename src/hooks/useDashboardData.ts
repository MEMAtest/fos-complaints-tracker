import { useState, useEffect, useCallback } from 'react';
import { FilterParams } from '../types/dashboard';

// Type definitions for the API response
export interface DashboardKPIs {
  total_complaints: number;
  total_firms: number;
  avg_upheld_rate: number;
  total_rows: number;
}

export interface FirmData {
  firm_name: string;
  complaint_count: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface ProductData {
  category_name: string;
  complaint_count: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface DashboardResponse {
  success: boolean;
  filters: FilterParams;
  data: {
    kpis: DashboardKPIs;
    topPerformers: FirmData[];
    productCategories: ProductData[];
    industryComparison: FirmData[];
    consumerCredit: FirmData[];
    allFirms: { firm_name: string }[];
  };
  debug: {
    timestamp: string;
    dataSource: string;
    executionTime: string;
    appliedFilters: FilterParams;
  };
}

// API fetch function
export const fetchDashboardData = async (filters: FilterParams): Promise<DashboardResponse> => {
  // Build query parameters
  const params = new URLSearchParams();
  
  if (filters.years && filters.years.length > 0) {
    params.append('years', filters.years.join(','));
  }
  
  if (filters.firms && filters.firms.length > 0) {
    params.append('firms', filters.firms.join(','));
  }
  
  if (filters.products && filters.products.length > 0) {
    params.append('products', filters.products.join(','));
  }

  const url = `/api/dashboard${params.toString() ? `?${params.toString()}` : ''}`;
  
  console.log('🚀 Fetching dashboard data with filters:', filters);
  console.log('🔗 API URL:', url);

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: DashboardResponse = await response.json();
  console.log('✅ Received dashboard data:', data.debug);
  return data;
};

// Main hook for dashboard data management
export const useDashboardData = () => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (filters: FilterParams) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchDashboardData(filters);
      setData(response);
      
      console.log('✅ Dashboard data updated with filters:', response.filters);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      console.error('❌ Dashboard data fetch failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchData };
};
