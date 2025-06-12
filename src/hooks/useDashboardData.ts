// ✅ ENHANCED: Dashboard data fetching with improved caching and error handling

import { useState, useCallback, useRef } from 'react';
import { FilterParams, DashboardAPIResponse, APIErrorResponse } from '../types/dashboard';

interface UseDashboardDataReturn {
  data: DashboardAPIResponse | null;
  loading: boolean;
  error: string | null;
  fetchData: (filters: FilterParams) => Promise<void>;
  refresh: () => Promise<void>;
  lastFetchTime: number | null;
}

// ✅ Simple cache implementation
interface CacheEntry {
  data: DashboardAPIResponse;
  timestamp: number;
  filters: FilterParams;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

export function useDashboardData(): UseDashboardDataReturn {
  const [data, setData] = useState<DashboardAPIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const lastFiltersRef = useRef<FilterParams>({});

  // ✅ ENHANCED: Generate cache key from filters
  const generateCacheKey = useCallback((filters: FilterParams): string => {
    return JSON.stringify({
      years: filters.years?.sort() || [],
      firms: filters.firms?.sort() || [],
      products: filters.products?.sort() || []
    });
  }, []);

  // ✅ ENHANCED: Check if filters have changed significantly
  const filtersChanged = useCallback((newFilters: FilterParams): boolean => {
    const lastFilters = lastFiltersRef.current;
    
    return (
      JSON.stringify(newFilters.years?.sort()) !== JSON.stringify(lastFilters.years?.sort()) ||
      JSON.stringify(newFilters.firms?.sort()) !== JSON.stringify(lastFilters.firms?.sort()) ||
      JSON.stringify(newFilters.products?.sort()) !== JSON.stringify(lastFilters.products?.sort())
    );
  }, []);

  // ✅ ENHANCED: Build query string from filters
  const buildQueryString = useCallback((filters: FilterParams): string => {
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
    
    return params.toString();
  }, []);

  // ✅ ENHANCED: Fetch data with caching and error handling
  const fetchData = useCallback(async (filters: FilterParams): Promise<void> => {
    const startTime = Date.now();
    console.log('📡 Fetching dashboard data with filters:', filters);

    // Check cache first
    const cacheKey = generateCacheKey(filters);
    const cachedEntry = cache.get(cacheKey);
    
    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_DURATION) {
      console.log('📦 Using cached data:', cacheKey);
      setData(cachedEntry.data);
      setError(null);
      setLastFetchTime(cachedEntry.timestamp);
      return;
    }

    // Skip fetch if filters haven't changed and we have recent data
    if (!filtersChanged(filters) && data && lastFetchTime && (Date.now() - lastFetchTime) < 30000) {
      console.log('⏭️ Skipping fetch - filters unchanged and data is recent');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString(filters);
      const url = `/api/dashboard${queryString ? `?${queryString}` : ''}`;
      
      console.log('🔗 Fetching from URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // ✅ Add cache control
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const fetchTime = Date.now();
      
      console.log('📡 API Response received:', {
        success: result.success,
        executionTime: result.debug?.executionTime,
        dataKeys: Object.keys(result.data || {}),
        totalTime: `${fetchTime - startTime}ms`
      });

      if (!result.success) {
        const errorResult = result as APIErrorResponse;
        throw new Error(errorResult.error || 'Failed to fetch data');
      }

      const apiResponse = result as DashboardAPIResponse;
      
      // ✅ ENHANCED: Validate response structure
      if (!apiResponse.data) {
        throw new Error('Invalid response structure: missing data');
      }

      // ✅ Log data summary for debugging
      console.log('📊 Data Summary:', {
        totalComplaints: apiResponse.data.kpis?.total_complaints,
        totalFirms: apiResponse.data.kpis?.total_firms,
        topPerformers: apiResponse.data.topPerformers?.length,
        consumerCredit: apiResponse.data.consumerCredit?.length,
        bankingPercentage: apiResponse.data.kpis?.banking_avg_percentage,
        sectorAverages: Object.keys(apiResponse.data.kpis?.sector_uphold_averages || {}).length
      });

      // ✅ Cache the result
      cache.set(cacheKey, {
        data: apiResponse,
        timestamp: fetchTime,
        filters
      });

      // ✅ Clean old cache entries (keep only last 10)
      if (cache.size > 10) {
        const oldestKey = Array.from(cache.keys())[0];
        cache.delete(oldestKey);
      }

      setData(apiResponse);
      setLastFetchTime(fetchTime);
      lastFiltersRef.current = filters;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Dashboard data fetch error:', errorMessage);
      setError(errorMessage);
      
      // ✅ Don't clear existing data on error, just show error state
      if (!data) {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [data, lastFetchTime, generateCacheKey, filtersChanged, buildQueryString]);

  // ✅ Refresh function (bypasses cache)
  const refresh = useCallback(async (): Promise<void> => {
    console.log('🔄 Force refreshing dashboard data');
    
    // Clear cache for current filters
    const cacheKey = generateCacheKey(lastFiltersRef.current);
    cache.delete(cacheKey);
    
    // Reset last fetch time to force new fetch
    setLastFetchTime(null);
    
    await fetchData(lastFiltersRef.current);
  }, [fetchData, generateCacheKey]);

  return {
    data,
    loading,
    error,
    fetchData,
    refresh,
    lastFetchTime
  };
}
